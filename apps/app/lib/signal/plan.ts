// Regras do plano de medição da iniciativa (SG-PO-02/03/05, decisões
// provisórias do Norte de 2026-09-29).
//
// Puro, sem banco nem sessão: a action e a tela leem a MESMA resposta para "quem
// pode fazer o quê" e "para onde vai o estado". O banco garante só o que é
// invariante (primária única, meta imutável depois de FROZEN); a máquina de
// estados e quem a move é regra daqui.

import { SignalRuleError } from "./errors";

export type PlanState =
  | "PROPOSED"
  | "NO_SOURCE"
  | "MEASURING"
  | "PAUSED"
  | "FROZEN";

export type PlanRole = "PRIMARY" | "GUARD" | "ADOPTION" | "VALUE";

export type PlanAction =
  | "propose"
  | "approve"
  | "pause"
  | "resume"
  | "requestTargetReview"
  | "edit";

type Tone = "neutral" | "amber" | "green" | "blue" | "purple";

export const PLAN_STATE_META: Record<PlanState, { label: string; tone: Tone }> =
  {
    PROPOSED: { label: "Proposta", tone: "amber" },
    NO_SOURCE: { label: "Sem fonte", tone: "neutral" },
    MEASURING: { label: "Medindo", tone: "green" },
    PAUSED: { label: "Pausada", tone: "amber" },
    FROZEN: { label: "Congelada", tone: "blue" },
  };

/** Papéis de métrica e a regra que cada um carrega (correcoes.pdf §03). */
export const PLAN_ROLE_META: Record<PlanRole, { label: string; rule: string }> =
  {
    PRIMARY: { label: "Primária", rule: "Decide o veredito." },
    GUARD: { label: "Guarda", rule: "Nunca piora para a primária melhorar." },
    ADOPTION: {
      label: "Adoção",
      rule: "Sem uso, o resultado não é da IA.",
    },
    VALUE: { label: "Valor", rule: "Componente em R$ do retorno." },
  };

export const PLAN_ROLE_ORDER: readonly PlanRole[] = [
  "PRIMARY",
  "GUARD",
  "ADOPTION",
  "VALUE",
];

/** Ações que não se fazem sem dizer por quê (SG-PO-02/03). */
export const COMMENT_REQUIRED: readonly PlanAction[] = [
  "pause",
  "resume",
  "requestTargetReview",
];

/**
 * Estado seguinte, ou nulo se a ação não vale no estado atual.
 *
 * Sem fonte → Medindo e → Congelada não estão aqui de propósito: quem move é o
 * sistema (conexão saudável; evento de baseline congelado), nunca uma pessoa.
 */
export function nextStateFor(
  state: PlanState,
  action: PlanAction
): PlanState | null {
  switch (action) {
    case "approve":
      return state === "PROPOSED" ? "NO_SOURCE" : null;
    case "pause":
      return state === "MEASURING" ? "PAUSED" : null;
    case "resume":
      return state === "PAUSED" ? "MEASURING" : null;
    case "requestTargetReview":
      return state === "FROZEN" ? "FROZEN" : null;
    default:
      return null;
  }
}

const DECIDERS = new Set(["OWNER", "ANALYST"]);

const ROLE_LABEL: Record<string, string> = {
  VIEWER: "Leitor",
  OWNER: "Dono de iniciativa",
  ANALYST: "Analista",
  ADMIN: "Administrador",
};

/**
 * Motivo da negativa, ou nulo se o papel pode agir no plano.
 *
 * ADMIN fica de fora de propósito (SG-PO-03): administrar acesso não é decidir.
 * Isso não cabe na matriz de permissões, onde o ADMIN tem tudo, e por isso vive
 * aqui, junto da regra de estado.
 */
export function planActionDenial(
  role: string,
  _action: PlanAction
): string | null {
  if (DECIDERS.has(role)) {
    return null;
  }
  return `Seu papel (${ROLE_LABEL[role] ?? role}) não move o plano de medição. Isso é do Dono da iniciativa ou do Analista.`;
}

/** Meta congelada não se edita: vira pedido de revisão ao Scaffold. */
export function targetEditable(state: PlanState): boolean {
  return state !== "FROZEN";
}

/** Proposta não entra no veredito nem no ROI até ser aprovada (SG-PO-05). */
export function countsInVerdict(state: PlanState): boolean {
  return state !== "PROPOSED";
}

export function filterPlan<
  T extends { role: PlanRole | string; state: PlanState | string },
>(
  rows: readonly T[],
  filter: { role?: PlanRole | string; state?: PlanState | string }
): T[] {
  return rows.filter(
    (r) =>
      (!filter.role || r.role === filter.role) &&
      (!filter.state || r.state === filter.state)
  );
}

const NUMBER_FMT = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 4,
});

export function formatMetricValue(value: number | null): string {
  return value === null ? "—" : NUMBER_FMT.format(value);
}

export type MetricEditInput = {
  name?: string;
  formula?: string;
  targetValue?: number | null;
  ownerId?: string | null;
};

type MetricCurrent = {
  state: PlanState;
  name: string;
  formula: string;
  targetValue: unknown;
  ownerId: string | null;
  version: number;
};

const show = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

/**
 * O que uma edição muda de fato: `patch` para gravar e `changes` no formato
 * [campo, antes, depois] do histórico. Só o que difere do valor atual conta.
 *
 * Aqui mora a regra de que meta congelada não se edita (aceite SG-DEV-05): o
 * banco também barra por trigger, mas a mensagem daqui aponta o caminho certo
 * (pedir revisão ao Scaffold). Valor igual ao atual não é edição, de modo que a
 * tela pode reenviar o formulário inteiro sem tropeçar na meta congelada.
 */
export function diffMetricEdit(
  current: MetricCurrent,
  input: MetricEditInput
): { patch: Record<string, unknown>; changes: [string, string, string][] } {
  const patch: Record<string, unknown> = {};
  const changes: [string, string, string][] = [];
  const currentTarget =
    current.targetValue === null || current.targetValue === undefined
      ? null
      : Number(current.targetValue);

  const rows: [keyof MetricEditInput, string, unknown, unknown][] = [
    ["name", "Nome", current.name, input.name],
    ["formula", "Fórmula", current.formula, input.formula],
    ["ownerId", "Responsável", current.ownerId, input.ownerId],
    ["targetValue", "Meta", currentTarget, input.targetValue],
  ];
  for (const [key, label, before, after] of rows) {
    if (after === undefined || after === before) {
      continue;
    }
    if (key === "targetValue" && !targetEditable(current.state)) {
      throw new SignalRuleError(
        "plan.target.frozen",
        "A meta desta métrica está congelada. Peça a revisão da meta ao Scaffold em vez de editar aqui."
      );
    }
    patch[key] = after;
    changes.push([label, show(before), show(after)]);
  }

  if (changes.length === 0) {
    throw new SignalRuleError(
      "plan.edit.empty",
      "Nada mudou. Edição só existe se houver diferença: cada uma cria uma versão nova."
    );
  }
  changes.push(["Versão", `v${current.version}`, `v${current.version + 1}`]);
  return { patch, changes };
}

/** Formas de trabalho (WorkForm) na ordem dos modelos, com o nome que a tela usa. */
export const WORK_FORM_OPTIONS = [
  { value: "CONVERSATIONAL", label: "Conversacional" },
  { value: "ANALYSIS", label: "Análise e priorização" },
  { value: "DOC_REVIEW", label: "Revisão de documentos" },
  { value: "TRIAGE", label: "Triagem" },
  { value: "REPORTING", label: "Relatórios recorrentes" },
] as const;

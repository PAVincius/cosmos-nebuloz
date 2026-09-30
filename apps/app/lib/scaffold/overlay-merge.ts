// Overlay de template — ST-02.
//
// O overlay é uma LISTA DE OPERAÇÕES contra uma versão base, não uma cópia da
// árvore. A diferença é a feature inteira:
//
//   • Cópia é FORK. Um fork não sabe dizer o que mudou, então publicar uma
//     versão nova do método nunca chegaria a quem customizou — e o SRD §5 é
//     explícito em não fazer isso.
//   • Operações se REAPLICAM. Publicar a v4 roda o mesmo overlay contra a base
//     nova; o que reaplica limpo sobrevive ao upgrade, e o que colide vira
//     conflito explícito.
//
// Merge de três vias em JSON resolveria mais casos e produziria conflitos que
// ninguém sabe ler. Aqui o conflito é sempre "esta operação, sobre esta chave,
// por este motivo" — legível por quem vai resolvê-lo, que é uma consultora e
// não um engenheiro.
//
// Lógica PURA: sem Prisma, sem I/O.

export type TemplateItem = {
  key: string;
  /** Enunciado do passo ou do critério; título, no entregável. */
  statement: string;
  required?: boolean;
  expectedArtefact?: string;
  evaluationType?: string;
  /** Só no entregável: código do passo que o produz ("B1"). */
  stepCode?: string;
  /** Só no entregável: REMOVE dispensa em vez de apagar, e este é o motivo. */
  dispensedReason?: string;
};

export type TemplateShape = {
  steps: TemplateItem[];
  criteria: TemplateItem[];
  /** Chave do entregável é o código ("B1.1"). Ausente em forma antiga. */
  deliverables?: TemplateItem[];
};

export type OverlayTarget = "step" | "criterion" | "deliverable";

export type OverlayOp = {
  op: "ADD" | "REMOVE" | "REPLACE";
  target: OverlayTarget;
  key: string;
  /** Campos a definir (ADD) ou mesclar (REPLACE). Ausente em REMOVE. */
  patch?: Partial<Omit<TemplateItem, "key">>;
  /** Por que a operação existe. Obrigatório em REMOVE de entregável: quem lê a
   *  trilha depois precisa saber por que a entrega não existe. */
  reason?: string;
};

export type ConflictReason =
  /** A operação mexe num item que a versão nova não tem mais. */
  | "TARGET_REMOVED"
  /** ADD de uma chave que a versão nova passou a definir por conta própria. */
  | "TARGET_ADDED_UPSTREAM"
  /** Overlay e versão nova editaram o mesmo campo do mesmo item. */
  | "BOTH_EDITED";

export type OverlayConflict = {
  op: OverlayOp["op"];
  target: OverlayTarget;
  targetKey: string;
  /** Campo em disputa, quando houver um só. */
  field: string | null;
  reason: ConflictReason;
  /** Frase que a consultora lê para decidir. Nomeia os DOIS lados: sem isso, o
   *  conflito parece erro do sistema em vez de discordância entre duas
   *  decisões legítimas. */
  note: string;
};

function listOf(shape: TemplateShape, target: OverlayTarget): TemplateItem[] {
  if (target === "step") {
    return shape.steps;
  }
  if (target === "criterion") {
    return shape.criteria;
  }
  return shape.deliverables ?? [];
}

const TARGET_LABEL: Record<OverlayTarget, string> = {
  step: "passo",
  criterion: "critério",
  deliverable: "entregável",
};

/**
 * Aplica as operações sobre a base e devolve a forma resolvida.
 *
 * Não muta a base: a mesma versão publicada serve a N tenants ao mesmo tempo, e
 * um overlay que mutasse a árvore vazaria a customização de um cliente para
 * todos os outros.
 *
 * Operação sobre chave inexistente é IGNORADA em vez de lançar. Quem detecta
 * essa situação é `detectConflicts`, na publicação; falhar aqui deixaria a
 * trilha do cliente sem passos por causa de um conflito que já tem dono.
 */
export function applyOverlay(
  base: TemplateShape,
  ops: readonly OverlayOp[]
): TemplateShape {
  const out: TemplateShape = {
    steps: base.steps.map((s) => ({ ...s })),
    criteria: base.criteria.map((c) => ({ ...c })),
  };
  // Forma antiga (sem entregáveis) sai como entrou: só ganha a lista se a base a
  // tem ou se uma operação mira nela.
  if (base.deliverables || ops.some((o) => o.target === "deliverable")) {
    out.deliverables = (base.deliverables ?? []).map((d) => ({ ...d }));
  }

  for (const op of ops) {
    const list = listOf(out, op.target);
    const i = list.findIndex((x) => x.key === op.key);

    if (op.op === "ADD") {
      if (i === -1) {
        list.push({ key: op.key, statement: "", ...op.patch });
      }
      continue;
    }
    if (i === -1) {
      continue;
    }
    if (op.op === "REMOVE") {
      if (op.target === "deliverable") {
        // Não some: a trilha mostra o entregável dispensado, com o motivo. Sumir
        // em silêncio é o gate virando formalidade (D-24 §7.7).
        list[i] = {
          ...(list[i] as TemplateItem),
          required: false,
          dispensedReason: (op.reason ?? "").trim(),
        };
      } else {
        list.splice(i, 1);
      }
      continue;
    }
    // REPLACE mescla: campo não citado no patch fica como na base. Substituir o
    // item inteiro obrigaria o overlay a repetir tudo que não muda, e essa
    // repetição é o que faz overlay virar fork sem ninguém perceber.
    list[i] = { ...(list[i] as TemplateItem), ...op.patch };
  }

  return out;
}

const FIELDS: (keyof TemplateItem)[] = [
  "statement",
  "required",
  "expectedArtefact",
  "evaluationType",
  "stepCode",
];

/** Campos que o patch toca E que mudaram entre a base e a versão nova. */
function contestedFields(
  before: TemplateItem,
  after: TemplateItem,
  patch: Partial<TemplateItem> | undefined
): string[] {
  if (!patch) {
    return [];
  }
  return FIELDS.filter((f) => f in patch && before[f] !== after[f]) as string[];
}

/**
 * Reaplica o overlay contra uma versão nova e devolve o que NÃO reaplica limpo.
 *
 * Lista vazia significa que a customização sobreviveu ao upgrade — a primeira
 * metade de ST-02. Cada item da lista é a segunda metade: um conflito
 * explícito, para resolução humana, em vez de sobrescrita silenciosa.
 *
 * `REMOVE` sobre item que a versão nova também removeu não é conflito: as duas
 * pontas concordam, e levantar conflito aqui obrigaria alguém a resolver uma
 * discordância que não existe.
 */
export function detectConflicts(
  base: TemplateShape,
  next: TemplateShape,
  ops: readonly OverlayOp[]
): OverlayConflict[] {
  const conflicts: OverlayConflict[] = [];

  for (const op of ops) {
    const inBase = listOf(base, op.target).find((x) => x.key === op.key);
    const inNext = listOf(next, op.target).find((x) => x.key === op.key);
    const what = TARGET_LABEL[op.target];

    if (op.op === "ADD") {
      if (inNext) {
        conflicts.push({
          op: op.op,
          target: op.target,
          targetKey: op.key,
          field: null,
          reason: "TARGET_ADDED_UPSTREAM",
          note: `O overlay acrescenta o ${what} "${op.key}", e a versão nova passou a defini-lo por conta própria. Decida qual enunciado vale.`,
        });
      }
      continue;
    }

    if (!inNext) {
      // REMOVE concordante não é conflito.
      if (op.op === "REMOVE") {
        continue;
      }
      conflicts.push({
        op: op.op,
        target: op.target,
        targetKey: op.key,
        field: null,
        reason: "TARGET_REMOVED",
        note: `O overlay altera o ${what} "${op.key}", que a versão nova removeu. Decida se a customização ainda faz sentido.`,
      });
      continue;
    }

    if (op.op === "REPLACE" && inBase) {
      const fields = contestedFields(inBase, inNext, op.patch);
      for (const field of fields) {
        conflicts.push({
          op: op.op,
          target: op.target,
          targetKey: op.key,
          field,
          reason: "BOTH_EDITED",
          note: `O overlay e a versão nova mudaram "${field}" do ${what} "${op.key}". Decida qual prevalece.`,
        });
      }
    }
  }

  return conflicts;
}

export type OverlayViolationCode =
  | "REQUIRED_DELIVERABLE_REMOVAL_NOT_CONSULTANT"
  | "REMOVAL_WITHOUT_REASON"
  | "STEP_ORPHANS_REQUIRED_DELIVERABLE";

export type OverlayViolation = {
  code: OverlayViolationCode;
  key: string;
  note: string;
  /** Só em STEP_ORPHANS_REQUIRED_DELIVERABLE: os entregáveis que ficam sem passo. */
  deliverables?: string[];
};

export const MIN_REMOVAL_REASON = 12;

/**
 * O que o overlay pode fazer com o gate (D-24 §7.7).
 *
 * O entregável obrigatório trava o gate. Remover um, ou afrouxá-lo para
 * opcional, tira da fase uma exigência do método, e por isso só o CONSULTANT
 * faz, com motivo. Nem ele faz sumir: `applyOverlay` dispensa, e a trilha
 * mostra o motivo. Quem não é consultor só remove o que não era obrigatório.
 *
 * Remover um passo que é o único produtor de um entregável obrigatório deixaria
 * o gate sem saída; só passa se o mesmo overlay dispensa o entregável.
 *
 * As checagens de papel olham a BASE: entregável que o próprio overlay
 * acrescentou é do cliente e ele pode desfazer.
 */
export function validateOverlay(
  base: TemplateShape,
  ops: readonly OverlayOp[],
  actor: { role: string }
): { blocking: OverlayViolation[] } {
  const blocking: OverlayViolation[] = [];
  const isConsultant = actor.role === "CONSULTANT";
  const isRequired = (key: string) =>
    (base.deliverables ?? []).some(
      (d) => d.key === key && d.required !== false
    );

  for (const op of ops) {
    if (op.target !== "deliverable") {
      continue;
    }
    const dropsRequired =
      isRequired(op.key) &&
      (op.op === "REMOVE" ||
        (op.op === "REPLACE" && op.patch?.required === false));
    if (dropsRequired && !isConsultant) {
      blocking.push({
        code: "REQUIRED_DELIVERABLE_REMOVAL_NOT_CONSULTANT",
        key: op.key,
        note: `O entregável "${op.key}" é obrigatório e trava o gate da fase. Só o consultor da Nebuloz o dispensa, com motivo.`,
      });
    }
    if (
      op.op === "REMOVE" &&
      (op.reason ?? "").trim().length < MIN_REMOVAL_REASON
    ) {
      blocking.push({
        code: "REMOVAL_WITHOUT_REASON",
        key: op.key,
        note: `Remover o entregável "${op.key}" pede um motivo de ${MIN_REMOVAL_REASON} caracteres ou mais — quem lê a trilha depois precisa saber por que ele não vale.`,
      });
    }
  }

  const live = (applyOverlay(base, ops).deliverables ?? []).filter(
    (d) => d.required !== false
  );
  for (const op of ops) {
    if (op.op !== "REMOVE" || op.target !== "step") {
      continue;
    }
    const orphans = live.filter((d) => d.stepCode === op.key).map((d) => d.key);
    if (orphans.length > 0) {
      blocking.push({
        code: "STEP_ORPHANS_REQUIRED_DELIVERABLE",
        key: op.key,
        deliverables: orphans,
        note: `Remover o passo "${op.key}" deixa sem produtor o entregável obrigatório ${orphans.map((k) => `"${k}"`).join(", ")}. Dispense o entregável no mesmo overlay, ou mantenha o passo.`,
      });
    }
  }

  return { blocking };
}

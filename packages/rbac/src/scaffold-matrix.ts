// Scaffold — matriz de permissões do framework de adoção.
//
// Transcrição de `specs/002-scaffold-adoption/spec.md` SN-05. Célula vazia da
// tabela = negado. Nada é implícito.
//
// Mesma ausência deliberada de coringa "*" do Charter e do Meridian: o ADMIN do
// tenant NÃO herda permissão de Scaffold. A razão aqui é a mais forte das três
// — quem registra um override de gate precisa ser nomeável, e o SRD trata
// fechamento sem atribuição como defeito de correção, não como conveniência.
// Admin gerencia ScaffoldMembership; para decidir um gate precisa de papel.
//
// Duas permissões merecem nota porque a separação não é óbvia:
//
//   • `gate.close` e `gate.override` são distintas. Fechar com critérios
//     atendidos é rotina de quem conduz. Passar por cima de critério não
//     atendido é decisão de risco, e o PRD §7 nomeia "gate vira formalidade que
//     todo mundo waiva" como o risco número um do produto. Dar as duas ao mesmo
//     papel por padrão apagaria a distinção que o produto existe para manter.
//
//   • `businesscase.sign` é do patrocinador, não de quem redige. Quem escreve o
//     caso de negócio não pode assiná-lo — é a mesma separação que faz o gate
//     da Fase 1 valer alguma coisa (SG-04).

import type { ScaffoldRole } from "@repo/database";

export type ScaffoldPermission =
  | "track.manage"
  | "step.complete"
  | "artefact.read"
  | "gate.close"
  | "gate.override"
  | "businesscase.write"
  | "businesscase.sign"
  | "template.publish"
  | "portfolio.read";

export const SCAFFOLD_PERMISSIONS: readonly ScaffoldPermission[] = [
  "track.manage",
  "step.complete",
  "artefact.read",
  "gate.close",
  "gate.override",
  "businesscase.write",
  "businesscase.sign",
  "template.publish",
  "portfolio.read",
] as const;

/** Rótulo pt-BR de cada permissão, para o motivo visível no controle
 *  desabilitado. */
export const SCAFFOLD_PERMISSION_LABEL: Record<ScaffoldPermission, string> = {
  "track.manage": "Criar, ajustar e cancelar trilhas",
  "step.complete": "Concluir passo e anexar artefato",
  "artefact.read": "Ler artefato anexado",
  "gate.close": "Fechar gate com critérios atendidos",
  "gate.override": "Fechar gate por override, com justificativa",
  "businesscase.write": "Redigir e editar o caso de negócio",
  "businesscase.sign": "Assinar ou contestar o caso de negócio",
  "template.publish": "Publicar versão de template e resolver overlay",
  "portfolio.read": "Ler o portfólio de trilhas",
};

export const SCAFFOLD_ROLE_LABEL: Record<ScaffoldRole, string> = {
  TEAM_MEMBER: "Membro do time",
  PROCESS_OWNER: "Dono do processo",
  TRANSFORMATION_LEAD: "Líder de transformação",
  CONSULTANT: "Consultor",
  ADMIN: "Administrador",
};

/** Tom de cada papel na UI. Categoria, não estado — por isso nada de verde,
 *  âmbar ou vermelho. */
export const SCAFFOLD_ROLE_TONE: Record<
  ScaffoldRole,
  "accent" | "blue" | "purple" | "neutral"
> = {
  TEAM_MEMBER: "blue",
  PROCESS_OWNER: "purple",
  TRANSFORMATION_LEAD: "purple",
  CONSULTANT: "accent",
  ADMIN: "neutral",
};

export const SCAFFOLD_MATRIX: Record<
  ScaffoldRole,
  readonly ScaffoldPermission[]
> = {
  // Executa o trabalho guiado. Não decide gate, não assina promessa.
  TEAM_MEMBER: ["step.complete", "artefact.read", "portfolio.read"],
  // Assina o caso de negócio e fecha gate com critérios atendidos — é a
  // contraparte do cliente que o PRD chama de "decide se a mudança é segura
  // para tornar permanente". Não faz override: passar por cima do próprio
  // critério esvazia a assinatura.
  PROCESS_OWNER: [
    "step.complete",
    "artefact.read",
    "gate.close",
    "businesscase.sign",
    "portfolio.read",
  ],
  // Enxerga a organização inteira e conduz trilhas, mas a decisão de risco
  // continua com quem tem pele no processo.
  TRANSFORMATION_LEAD: [
    "track.manage",
    "step.complete",
    "artefact.read",
    "gate.close",
    "businesscase.write",
    "portfolio.read",
  ],
  // Supervisiona. É o único papel com override — e o override é sempre
  // atribuído a ele, nominalmente, na trilha de auditoria.
  CONSULTANT: [
    "track.manage",
    "step.complete",
    "artefact.read",
    "gate.close",
    "gate.override",
    "businesscase.write",
    "template.publish",
    "portfolio.read",
  ],
  // Administra papéis e configuração. Deliberadamente SEM gate.close,
  // gate.override e businesscase.sign: administrar acesso não é decidir risco.
  ADMIN: [
    "track.manage",
    "artefact.read",
    "template.publish",
    "portfolio.read",
  ],
} as const;

export function hasScaffoldPermission(
  role: ScaffoldRole,
  permission: ScaffoldPermission
): boolean {
  return SCAFFOLD_MATRIX[role].includes(permission);
}

/** Papéis que concedem a permissão — usado para escrever o motivo visível no
 *  controle desabilitado. */
export function scaffoldRolesGranting(
  permission: ScaffoldPermission
): ScaffoldRole[] {
  return (Object.keys(SCAFFOLD_MATRIX) as ScaffoldRole[]).filter((role) =>
    hasScaffoldPermission(role, permission)
  );
}

/** Motivo em pt-BR para o tooltip do controle desabilitado. Esconder o botão
 *  não basta: quem não pode agir precisa saber a quem pedir. */
export function scaffoldDenialReason(permission: ScaffoldPermission): string {
  const labels = scaffoldRolesGranting(permission).map(
    (r) => SCAFFOLD_ROLE_LABEL[r]
  );
  const last = labels.pop();
  const list = labels.length ? `${labels.join(", ")} ou ${last}` : last;
  return `Requer papel ${list} — ${SCAFFOLD_PERMISSION_LABEL[permission]}`;
}

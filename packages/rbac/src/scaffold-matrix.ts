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
  | "overlay.manage"
  | "membership.manage"
  | "product.metrics"
  | "portfolio.read"
  | "deliverable.read"
  | "deliverable.work"
  | "deliverable.review"
  | "deliverable.reopen"
  | "deliverable.add";

export const SCAFFOLD_PERMISSIONS: readonly ScaffoldPermission[] = [
  "track.manage",
  "step.complete",
  "artefact.read",
  "gate.close",
  "gate.override",
  "businesscase.write",
  "businesscase.sign",
  "template.publish",
  "overlay.manage",
  "membership.manage",
  "product.metrics",
  "portfolio.read",
  "deliverable.read",
  "deliverable.work",
  "deliverable.review",
  "deliverable.reopen",
  "deliverable.add",
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
  "template.publish":
    "Publicar versão do método (global; só a organização interna)",
  "overlay.manage": "Salvar overlay e resolver conflito da organização",
  "membership.manage": "Atribuir papel de adoção às pessoas da organização",
  "product.metrics": "Ler as métricas de produto do Scaffold",
  "portfolio.read": "Ler o portfólio de trilhas",
  "deliverable.read": "Ler e baixar entregável",
  "deliverable.work":
    "Iniciar, anexar versão, enviar e editar resumo do entregável",
  "deliverable.review": "Aprovar ou pedir ajuste em entregável",
  "deliverable.reopen": "Reabrir entregável aprovado",
  "deliverable.add": "Adicionar entregável fora do template",
};

export const SCAFFOLD_ROLE_LABEL: Record<ScaffoldRole, string> = {
  TEAM_MEMBER: "Membro do time",
  PROCESS_OWNER: "Dono do processo",
  TRANSFORMATION_LEAD: "Líder de transformação",
  CONSULTANT: "Consultor",
  ADMIN: "Administrador",
  SPONSOR: "Patrocinador",
  TEAM_LEAD: "Líder do time",
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
  SPONSOR: "neutral",
  TEAM_LEAD: "neutral",
};

export const SCAFFOLD_MATRIX: Record<
  ScaffoldRole,
  readonly ScaffoldPermission[]
> = {
  // Executa o trabalho guiado. Não decide gate, não assina promessa.
  TEAM_MEMBER: [
    "step.complete",
    "artefact.read",
    "portfolio.read",
    "deliverable.read",
    "deliverable.work",
  ],
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
    "deliverable.read",
    "deliverable.work",
    "deliverable.review",
    "deliverable.reopen",
    "deliverable.add",
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
    "deliverable.read",
    "deliverable.work",
    "deliverable.review",
    "deliverable.reopen",
    "deliverable.add",
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
    "overlay.manage",
    "membership.manage",
    "product.metrics",
    "portfolio.read",
    "deliverable.read",
    "deliverable.work",
    "deliverable.review",
    "deliverable.reopen",
    "deliverable.add",
  ],
  // Administra papéis e configuração. Deliberadamente SEM gate.close,
  // gate.override e businesscase.sign: administrar acesso não é decidir risco.
  ADMIN: [
    "track.manage",
    "artefact.read",
    "overlay.manage",
    "membership.manage",
    "product.metrics",
    "portfolio.read",
    "deliverable.read",
  ],
  // Só leem (SC-PO-04, SC-DEV-07): o backend devolve 403 em qualquer escrita.
  // O sponsor não assina: businesscase.sign fica com o dono do processo.
  SPONSOR: ["artefact.read", "portfolio.read", "deliverable.read"],
  TEAM_LEAD: ["artefact.read", "portfolio.read", "deliverable.read"],
} as const;

// As permissões `deliverable.*` dizem o que o PAPEL pode fazer. Três regras de
// instância ficam nas actions, porque dependem do entregável e não do papel
// (seção d, "Regras de instância"):
//   • `work` de TEAM_MEMBER e PROCESS_OWNER só vale se ele for o responsável;
//   • `review` só vale se ele for o aprovador, e ninguém aprova o que é seu;
//   • ADMIN não mexe em entregável: administrar acesso não é decidir risco.

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

/**
 * Quem pode conceder ou retirar qual papel de adoção (SA-05).
 *
 * `membership.manage` sozinha deixaria o consultor conceder ADMIN a si ou a
 * outro e rebaixar administrador. A regra, sem hierarquia nova além da matriz:
 *   - ADMIN é o topo: só ADMIN concede ou retira ADMIN, e gere qualquer papel;
 *   - CONSULTANT gere só o que está abaixo dele: nem ADMIN nem outro
 *     CONSULTANT, na concessão ou na retirada. Papéis futuros do cliente
 *     (patrocinador, líder de time) entram abaixo sem mudar esta função;
 *   - quem não tem `membership.manage` não atribui nada.
 * Vale para o papel novo E para o atual da pessoa: rebaixar é retirar.
 */
export function canAssignScaffoldRole(
  actor: ScaffoldRole,
  current: ScaffoldRole | null,
  next: ScaffoldRole
): boolean {
  if (!hasScaffoldPermission(actor, "membership.manage")) {
    return false;
  }
  if (actor === "ADMIN") {
    return true;
  }
  const belowConsultant = (r: ScaffoldRole | null) =>
    r === null || (r !== "ADMIN" && r !== "CONSULTANT");
  return belowConsultant(current) && belowConsultant(next);
}

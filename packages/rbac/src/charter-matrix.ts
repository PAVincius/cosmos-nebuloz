// Charter — matriz de permissões de governança.
//
// Transcrição literal de `design_handoff_charter/DATA-MODEL.md §3`. Célula
// vazia da tabela = negado. Nada é implícito: uma permissão ausente da tabela
// não existe.
//
// Diferença deliberada em relação a PERMISSION_MATRIX (SAFe): aqui não há
// coringa "*". O ADMIN do tenant NÃO herda permissão de Charter — governança
// que o admin de plataforma contorna não é evidência de auditoria. Admin
// gerencia CharterMembership; para decidir um caso precisa de papel de
// governança.

import type { CharterRole } from "@repo/database";

export type CharterPermission =
  | "policy.edit"
  | "policy.publish"
  | "case.submit"
  | "case.decide"
  | "risk.score"
  | "vendor.approve"
  | "clause.manage"
  | "onboarding.publish"
  | "audit.read"
  | "audit.export";

export const CHARTER_PERMISSIONS: readonly CharterPermission[] = [
  "policy.edit",
  "policy.publish",
  "case.submit",
  "case.decide",
  "risk.score",
  "vendor.approve",
  "clause.manage",
  "onboarding.publish",
  "audit.read",
  "audit.export",
] as const;

/** Rótulo pt-BR de cada permissão, para o tooltip de ação desabilitada e para
 *  a matriz em leitura de /settings (FR-12.2). */
export const CHARTER_PERMISSION_LABEL: Record<CharterPermission, string> = {
  "policy.edit": "Editar política",
  "policy.publish": "Publicar versão de política",
  "case.submit": "Submeter caso de uso",
  "case.decide": "Decidir caso de uso",
  "risk.score": "Pontuar risco e criar mitigação",
  "vendor.approve": "Aprovar fornecedor / mudar tier",
  "clause.manage": "Gerir cláusulas contratuais",
  "onboarding.publish": "Publicar trilha de onboarding",
  "audit.read": "Ler trilha de auditoria",
  "audit.export": "Exportar pacote de evidência",
};

export const CHARTER_ROLE_LABEL: Record<CharterRole, string> = {
  COMPLIANCE: "Compliance",
  LEGAL: "Legal",
  SECURITY: "Segurança",
  HR: "People Ops",
  REQUESTER: "Requester",
  EXEC: "Executivo",
  AUDITOR: "Auditor",
};

/** Tom de cada papel na UI. Categoria, não estado — por isso nada de verde,
 *  âmbar ou vermelho (DESIGN.md §3). */
export const CHARTER_ROLE_TONE: Record<
  CharterRole,
  "accent" | "blue" | "purple"
> = {
  COMPLIANCE: "accent",
  LEGAL: "purple",
  SECURITY: "blue",
  HR: "purple",
  REQUESTER: "accent",
  EXEC: "blue",
  AUDITOR: "accent",
};

export const CHARTER_MATRIX: Record<CharterRole, readonly CharterPermission[]> =
  {
    COMPLIANCE: [
      "policy.edit",
      "policy.publish",
      "case.submit",
      "case.decide",
      "risk.score",
      "vendor.approve",
      "clause.manage",
      "onboarding.publish",
      "audit.read",
      "audit.export",
    ],
    LEGAL: [
      "policy.edit",
      "case.submit",
      "case.decide",
      "clause.manage",
      "audit.read",
      "audit.export",
    ],
    SECURITY: [
      "case.submit",
      "case.decide",
      "risk.score",
      "vendor.approve",
      "audit.read",
    ],
    HR: ["onboarding.publish"],
    REQUESTER: ["case.submit"],
    // Exec e Auditor leem e exportam, mas não decidem nada — Auditor é o papel
    // de leitura forense.
    EXEC: ["audit.read", "audit.export"],
    AUDITOR: ["audit.read", "audit.export"],
  } as const;

export function hasCharterPermission(
  role: CharterRole,
  permission: CharterPermission
): boolean {
  return CHARTER_MATRIX[role].includes(permission);
}

/** Papéis que concedem a permissão — usado para escrever o motivo visível no
 *  controle desabilitado ("Requer papel Compliance ou Segurança"). */
export function rolesGranting(permission: CharterPermission): CharterRole[] {
  return (Object.keys(CHARTER_MATRIX) as CharterRole[]).filter((role) =>
    hasCharterPermission(role, permission)
  );
}

/** Motivo em pt-BR para o tooltip do controle desabilitado. A UI não pode
 *  apenas esconder o botão: o SRD pede motivo visível (NFR-1.3). */
export function denialReason(permission: CharterPermission): string {
  const labels = rolesGranting(permission).map((r) => CHARTER_ROLE_LABEL[r]);
  const last = labels.pop();
  const list = labels.length ? `${labels.join(", ")} ou ${last}` : last;
  return `Requer papel ${list} — ${CHARTER_PERMISSION_LABEL[permission]}`;
}

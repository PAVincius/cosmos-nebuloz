// Meridian — matriz de permissões do diagnóstico.
//
// Transcrição de `specs/001-meridian-diagnose/research.md` R-02. Célula vazia
// da tabela = negado. Nada é implícito.
//
// Mesma diferença deliberada do Charter em relação a PERMISSION_MATRIX (SAFe):
// aqui não há coringa "*". O ADMIN do tenant NÃO herda permissão de Meridian —
// quem registra um override precisa ser nomeável, e um admin que contorna o
// papel de consultor invalida a trilha. Admin gerencia MeridianMembership;
// para decidir um score precisa de papel de diagnóstico.

import type { MeridianRole } from "@repo/database";

export type MeridianPermission =
  | "assessment.manage"
  | "scoring.run"
  | "override.write"
  | "gap.write"
  | "gap.promote"
  | "evidence.read"
  | "report.read";

export const MERIDIAN_PERMISSIONS: readonly MeridianPermission[] = [
  "assessment.manage",
  "scoring.run",
  "override.write",
  "gap.write",
  "gap.promote",
  "evidence.read",
  "report.read",
] as const;

/** Rótulo pt-BR de cada permissão, para o motivo visível no controle
 *  desabilitado. */
export const MERIDIAN_PERMISSION_LABEL: Record<MeridianPermission, string> = {
  "assessment.manage": "Conduzir assessment (criar, atribuir, fechar coleta)",
  "scoring.run": "Executar o scoring",
  "override.write": "Registrar override de score",
  "gap.write": "Criar e ajustar gaps e dependências",
  "gap.promote": "Promover gap para outro produto",
  "evidence.read": "Ler evidência anexada",
  "report.read": "Ler o relatório",
};

export const MERIDIAN_ROLE_LABEL: Record<MeridianRole, string> = {
  CONSULTANT: "Consultor",
  REVIEWER: "Revisor",
  VIEWER: "Leitor",
};

/** Tom de cada papel na UI. Categoria, não estado — por isso nada de verde,
 *  âmbar ou vermelho. */
export const MERIDIAN_ROLE_TONE: Record<
  MeridianRole,
  "accent" | "blue" | "purple"
> = {
  CONSULTANT: "accent",
  REVIEWER: "purple",
  VIEWER: "blue",
};

export const MERIDIAN_MATRIX: Record<
  MeridianRole,
  readonly MeridianPermission[]
> = {
  CONSULTANT: [
    "assessment.manage",
    "scoring.run",
    "override.write",
    "gap.write",
    "gap.promote",
    "evidence.read",
    "report.read",
  ],
  // Revisor decide número contestado e lê a evidência que fundamenta a decisão,
  // mas não conduz a coleta nem promove trabalho para outro produto.
  REVIEWER: ["override.write", "evidence.read", "report.read"],
  VIEWER: ["report.read"],
} as const;

export function hasMeridianPermission(
  role: MeridianRole,
  permission: MeridianPermission
): boolean {
  return MERIDIAN_MATRIX[role].includes(permission);
}

/** Papéis que concedem a permissão — usado para escrever o motivo visível no
 *  controle desabilitado. */
export function meridianRolesGranting(
  permission: MeridianPermission
): MeridianRole[] {
  return (Object.keys(MERIDIAN_MATRIX) as MeridianRole[]).filter((role) =>
    hasMeridianPermission(role, permission)
  );
}

/** Motivo em pt-BR para o tooltip do controle desabilitado. Esconder o botão
 *  não basta: quem não pode agir precisa saber a quem pedir. */
export function meridianDenialReason(permission: MeridianPermission): string {
  const labels = meridianRolesGranting(permission).map(
    (r) => MERIDIAN_ROLE_LABEL[r]
  );
  const last = labels.pop();
  const list = labels.length ? `${labels.join(", ")} ou ${last}` : last;
  return `Requer papel ${list} — ${MERIDIAN_PERMISSION_LABEL[permission]}`;
}

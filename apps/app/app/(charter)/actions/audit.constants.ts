// Constantes da trilha de auditoria.
//
// Vivem fora de `audit.ts` porque aquele arquivo é `"use server"`, e um módulo
// de server actions só pode exportar funções async — exportar um objeto de lá
// quebra em runtime com "A 'use server' file can only export async functions".
// Mesmo padrão de `*.constants.ts` já usado nas actions do Cosmos.

export const CHARTER_ENTITY_TYPES = [
  "charter.policy",
  "charter.section",
  "charter.usecase",
  "charter.decision",
  "charter.risk",
  "charter.mitigation",
  "charter.vendor",
  "charter.clause",
  "charter.track",
  "charter.export",
  "charter.settings",
] as const;

/** Agrupa entityType em categoria de artefato — é assim que o auditor filtra,
 *  não por tabela. */
export const AUDIT_CATEGORY: Record<string, string> = {
  "charter.policy": "policy",
  "charter.section": "policy",
  "charter.usecase": "decision",
  "charter.decision": "decision",
  "charter.risk": "risk",
  "charter.mitigation": "risk",
  "charter.vendor": "vendor",
  "charter.clause": "vendor",
  "charter.track": "onboarding",
  "charter.export": "export",
  "charter.settings": "settings",
};

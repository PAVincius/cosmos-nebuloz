// Constantes da trilha de auditoria.
//
// Vivem fora de `audit.ts` porque aquele arquivo é `"use server"`, e um módulo
// de server actions só pode exportar funções async — exportar um objeto de lá
// quebra em runtime com "A 'use server' file can only export async functions".
// Mesmo padrão de `*.constants.ts` já usado nas actions do Cosmos.

import type { CharterEntity } from "./_shared";

/**
 * Agrupa entityType em categoria de artefato — é assim que o auditor filtra,
 * não por tabela.
 *
 * Tipado `Record<CharterEntity, string>`, não `Record<string, string>`, de
 * propósito: isto é a fonte exaustiva. Adicionar um membro a `CharterEntity`
 * sem entrada aqui não compila mais — antes compilava, e foi exatamente isso
 * que deixou os vínculos de política (`charter.policylink`, RFP §4.1.4/§4.3.2)
 * invisíveis em `listAudit`/`exportEvidence`: o tipo frouxo não acusava nada.
 */
const AUDIT_CATEGORY_BY_ENTITY: Record<CharterEntity, string> = {
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
  "charter.policylink": "policy",
  "charter.requirementset": "compliance",
  "charter.coverage": "compliance",
};

// Exportado mais largo que a fonte acima de propósito: os call-sites em
// audit.ts indexam por `entityType` vindo direto do banco — uma string
// qualquer, não garantidamente um CharterEntity — e já tratam chave
// desconhecida com fallback ("policy"). A checagem exaustiva fica só na
// definição de AUDIT_CATEGORY_BY_ENTITY; alargar aqui não perde isso.
export const AUDIT_CATEGORY: Record<string, string> = AUDIT_CATEGORY_BY_ENTITY;

// Derivado das chaves de AUDIT_CATEGORY_BY_ENTITY, não mais mantido à mão —
// é isso que impede este array de divergir de CharterEntity de novo: para
// entrar aqui, um entityType precisa antes ter categoria (o Record acima
// exige), e uma vez lá, aparece aqui automaticamente.
export const CHARTER_ENTITY_TYPES = Object.keys(
  AUDIT_CATEGORY_BY_ENTITY
) as CharterEntity[];

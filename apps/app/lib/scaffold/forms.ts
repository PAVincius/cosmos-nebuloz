// As 5 formas do trabalho (Norte, seção c). Um lugar só: o rótulo vivia em três
// telas e cobria 3 das 5, então o seletor mostrava o código cru.

export const WORK_FORMS = [
  "CONVERSATIONAL",
  "ANALYSIS",
  "DOC_REVIEW",
  "TRIAGE",
  "REPORTING",
] as const;

export type WorkFormCode = (typeof WORK_FORMS)[number];

export const WORK_FORM_LABEL: Record<WorkFormCode, string> = {
  CONVERSATIONAL: "Assistente conversacional",
  ANALYSIS: "Análise e priorização",
  DOC_REVIEW: "Revisão de documentos",
  TRIAGE: "Triagem de demanda",
  REPORTING: "Relatórios recorrentes",
};

/** Rótulo da forma; o código quando ela for nova e ainda sem rótulo, e vazio
 *  quando a trilha não tem forma. */
export function workFormLabel(form: string | null | undefined): string {
  if (!form) {
    return "";
  }
  return WORK_FORM_LABEL[form as WorkFormCode] ?? form;
}

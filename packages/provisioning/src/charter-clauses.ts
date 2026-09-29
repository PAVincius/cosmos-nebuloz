/** Catálogo único das 8 cláusulas contratuais do Charter (CL-01–CL-08).
 *  Fonte única para `bootstrapCharter` e para `apps/app/scripts/seed-charter.ts`
 *  — nenhum dos dois mantém cópia própria (FR-002). Conteúdo extraído sem
 *  alteração do array `CLAUSES` que só o seed de demonstração mantinha. */
export const CHARTER_CLAUSES: {
  code: string;
  name: string;
  critical: boolean;
}[] = [
  {
    code: "CL-01",
    name: "Proibição de treinamento com dados do cliente",
    critical: true,
  },
  { code: "CL-02", name: "Retenção zero de prompt e resposta", critical: true },
  { code: "CL-03", name: "Notificação de incidente em 24h", critical: true },
  {
    code: "CL-04",
    name: "Lista de sub-processadores e direito de objeção",
    critical: true,
  },
  {
    code: "CL-05",
    name: "Localidade de processamento definida contratualmente",
    critical: false,
  },
  { code: "CL-06", name: "Direito de auditoria anual", critical: false },
  { code: "CL-07", name: "Indenização por violação de PI", critical: false },
  { code: "CL-08", name: "BAA / adendo de dado de saúde", critical: true },
];

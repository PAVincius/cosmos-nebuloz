import { AXIS_IDS } from "@/lib/meridian/axes";

// Opções do seletor de assessment da "Nova trilha" (D-27). Puro: o que o
// seletor mostra, e quais assessments ele pode oferecer.

/** Só o assessment com pontuação nos cinco eixos serve de origem: sem ela a
 *  trilha não tem o relatório, o baseline nem a leitura de confiança do A2. */
export function hasFullScoring(axes: readonly string[]): boolean {
  const pontuados = new Set(axes);
  return AXIS_IDS.every((a) => pontuados.has(a));
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  COLLECTING: "Em coleta",
  REVIEW: "Em revisão",
  FINALISED: "Finalizado",
};

/** dd/mm/aaaa em UTC: o rótulo não muda com o fuso de quem renderiza. */
function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export type AssessmentOption = {
  id: string;
  /** "AS-120". */
  code: string;
  orgName: string;
  status: string;
  /** Fechamento, ou a abertura quando ainda não fechou. */
  date: Date;
};

export function assessmentOptionLabel(
  a: Pick<AssessmentOption, "code" | "orgName" | "status" | "date">
): string {
  return [
    a.code,
    a.orgName,
    formatDate(a.date),
    STATUS_LABEL[a.status] ?? a.status,
  ].join(" · ");
}

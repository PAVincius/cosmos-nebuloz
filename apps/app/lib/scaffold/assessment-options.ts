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

/** dd/mm/aaaa em America/Sao_Paulo, o mesmo fuso do relatório do assessment: em
 *  UTC, um assessment fechado às 23h de Brasília sairia com o dia seguinte. Fixo,
 *  e não o fuso de quem renderiza, para o rótulo ser o mesmo em todo lugar. */
const DATE_BR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDate = (d: Date) => DATE_BR.format(d);

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

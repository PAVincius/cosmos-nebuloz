import { AXIS_IDS } from "@/lib/meridian/axes";
import { RELIABILITY_MIN } from "@/lib/meridian/readiness-bands";

// Regras da trilha de prontidão que leem o diagnóstico do Meridian (D-24, D-27).
// Puras: recebem o que o assessment de origem já tem.

/** Ata do workshop liderança–operação: só vale com eixo de confiança baixa. */
export const LOW_CONFIDENCE_WORKSHOP_CODE = "A2.1";

export type SourceAssessmentReading = {
  code: string;
  /** Confiança (0–1) de cada eixo já pontuado. */
  confidences: number[];
};

/**
 * Motivo para o A2.1 nascer DISPENSADO, ou null quando ele nasce obrigatório.
 *
 * Dispensa só com certeza: os cinco eixos lidos e nenhum com confiança abaixo de
 * 0,6 (0,60 vale, o limiar é estritamente menor). Sem leitura, ou com leitura
 * incompleta, o A2.1 nasce obrigatório e a consultora dispensa à mão — o lado
 * mais seguro é pedir o workshop, nunca esquecê-lo por omissão.
 */
export function workshopDispensation(
  assessment: SourceAssessmentReading | null
): string | null {
  if (!assessment || assessment.confidences.length < AXIS_IDS.length) {
    return null;
  }
  if (assessment.confidences.some((c) => c < RELIABILITY_MIN)) {
    return null;
  }
  return `Nenhum eixo do diagnóstico ${assessment.code} tem confiança abaixo de 0,6; não há o que revalidar no workshop. Dispensado pelo sistema.`;
}

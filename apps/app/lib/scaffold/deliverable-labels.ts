import type { DeliverableStatus } from "./deliverable-machine";

// Vocabulário do entregável (Norte, seção c.0): tipo e produtor, por extenso.

export const KIND_LABEL = {
  DOCUMENT: "Documento",
  SPREADSHEET: "Planilha",
  DATASET: "Conjunto de dados",
  CONFIGURATION: "Configuração",
  SIGNATURE: "Assinatura",
  TRAINING: "Treinamento",
  REPORT: "Relatório",
  PACKAGE: "Pacote",
} as const;

export const PRODUCER_LABEL = {
  OWNER: "Dono do processo",
  CONSULTANT: "Consultoria",
  TECHNICAL: "Área técnica",
  LEGAL: "Jurídico",
} as const;

export type DeliverableKindCode = keyof typeof KIND_LABEL;
export type DeliverableProducerCode = keyof typeof PRODUCER_LABEL;

export const KINDS = Object.keys(KIND_LABEL) as DeliverableKindCode[];
export const PRODUCERS = Object.keys(
  PRODUCER_LABEL
) as DeliverableProducerCode[];

/** Estado do entregável por extenso e o tom que o acompanha. Cor nunca é o único
 *  sinal: a lista, o canvas e o painel escrevem a palavra ao lado. */
export const STATUS: Record<
  DeliverableStatus,
  { label: string; tone: "neutral" | "accent" | "amber" | "red" | "green" }
> = {
  NOT_STARTED: { label: "Não iniciado", tone: "neutral" },
  IN_PROGRESS: { label: "Em elaboração", tone: "accent" },
  IN_REVIEW: { label: "Em revisão", tone: "amber" },
  ADJUSTMENT_REQUESTED: { label: "Ajuste pedido", tone: "red" },
  APPROVED: { label: "Aprovado", tone: "green" },
  REOPENED: { label: "Reaberto", tone: "amber" },
};

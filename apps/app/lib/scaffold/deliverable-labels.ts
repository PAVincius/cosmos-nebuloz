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

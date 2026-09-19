// policy-copy.ts — copy estática do Policy Builder (FR-2). Saiu de
// `policy.tsx` (que está na catraca de tamanho): são listas de texto que a
// tela só percorre, sem estado nem ação.

import type { IconName } from "@repo/design-system/cosmos/icons";

/** O que a seção passa a exigir na prática, em cada superfície do Charter.
 *  Torna visível que política não é documento — é regra que muda o sistema. */
export const DERIVED_RULES: { icon: IconName; t: string; d: string }[] = [
  {
    icon: "inbox",
    t: "Intake de caso de uso",
    d: "Campos obrigatórios e caminho de aprovação recalculados",
  },
  {
    icon: "plug",
    t: "Elegibilidade de fornecedor",
    d: "Classe máxima de dado permitida por fornecedor",
  },
  {
    icon: "userCheck",
    t: "Trilha de onboarding",
    d: "Módulos e aceite revinculados à nova versão",
  },
  {
    icon: "history",
    t: "Trilha de auditoria",
    d: "Diff de campo e aprovador registrados por versão",
  },
];

export const VERSION_DISCIPLINE = [
  "Toda publicação exige resumo de mudança — não existe versão sem justificativa.",
  "Aceite de colaborador guarda a versão que ele leu, não apenas a data.",
  "Reabrir seção publicada não altera a versão vigente até nova aprovação.",
  "Exceção concedida expira em 90 dias e volta ao Comitê.",
];

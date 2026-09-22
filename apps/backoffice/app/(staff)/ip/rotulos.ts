import type { Licenca, Procedencia, TipoDeAtivo } from "@/lib/ip/regua";

/**
 * Rótulos e notas do cadastro de ativo de IP, fora de `registrar.tsx` para o
 * formulário caber no teto de tamanho. `biblioteca.tsx` usa os mesmos rótulos
 * nas badges da linha do ativo — uma segunda cópia divergiria no primeiro
 * ajuste de texto.
 */

export const ROTULO_MATURIDADE: Record<"RASCUNHO" | "COMPROVADO", string> = {
  RASCUNHO: "Rascunho",
  COMPROVADO: "Comprovado",
};

export const ROTULO_TIPO: Record<TipoDeAtivo, string> = {
  ACELERADOR: "Acelerador",
  PLAYBOOK: "Playbook",
  TEMPLATE: "Template",
  EVAL_HARNESS: "Eval harness",
  MODELO_BPMN: "Modelo BPMN",
  DOCUMENTO: "Documento",
};

export const ROTULO_PROCEDENCIA: Record<Procedencia, string> = {
  INTERNO: "Investimento interno",
  ENGAJAMENTO: "Engajamento de cliente",
  LAB: "LAB",
  TERCEIRO: "Base de terceiro",
};

export const NOTA_PROCEDENCIA: Record<Procedencia, string> = {
  INTERNO: "Construído em tempo não faturado. Reuso livre.",
  ENGAJAMENTO: "Nasceu em entrega paga. Exige cláusula de reuso no contrato.",
  LAB: "Saída de pesquisa interna. Verificar licença do dataset de origem.",
  TERCEIRO: "Adaptação de material de fora. A licença manda.",
};

export const ROTULO_LICENCA: Record<Licenca, string> = {
  NENHUMA: "Nenhuma",
  PERMISSIVA: "Permissiva",
  COPYLEFT: "Copyleft",
  COMERCIAL: "Licenciada",
  NAO_RESOLVIDA: "Não resolvida",
};

export const NOTA_LICENCA: Record<Licenca, string> = {
  NENHUMA: "Nada de terceiro dentro do ativo.",
  PERMISSIVA: "MIT, Apache-2.0, BSD. Reuso comercial liberado com atribuição.",
  COPYLEFT:
    "GPL, AGPL. Contamina o entregável do cliente — revisar antes de vender.",
  COMERCIAL: "Metodologia ou software pago. Exige número de licença.",
  NAO_RESOLVIDA:
    "Bloqueia o registro. Sem licença conhecida não existe direito de reuso.",
};

/** As duas licenças que só valem com componente e versão escritos. */
export const PLACEHOLDER_REFERENCIA: Partial<Record<Licenca, string>> = {
  COPYLEFT: "bpmn-js AGPL-3.0",
  COMERCIAL: "Prosci ADKAR — LIC-2026-014",
};

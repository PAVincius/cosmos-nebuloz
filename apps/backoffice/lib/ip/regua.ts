/**
 * Régua de aceitação do catálogo de IP.
 *
 * Puro de propósito: o servidor é a autoridade sobre a régua, e o painel
 * lateral do formulário precisa espelhá-la enquanto a pessoa digita. Duas
 * cópias da mesma lista divergiriam no primeiro ajuste de texto, e a divergente
 * seria justamente a que a pessoa lê antes de clicar.
 */

export const TIPOS_DE_ATIVO = [
  "ACELERADOR",
  "PLAYBOOK",
  "TEMPLATE",
  "EVAL_HARNESS",
  "MODELO_BPMN",
  "DOCUMENTO",
] as const;
export type TipoDeAtivo = (typeof TIPOS_DE_ATIVO)[number];

export const PROCEDENCIAS = [
  "INTERNO",
  "ENGAJAMENTO",
  "LAB",
  "TERCEIRO",
] as const;
export type Procedencia = (typeof PROCEDENCIAS)[number];

export const LICENCAS = [
  "NENHUMA",
  "PERMISSIVA",
  "COPYLEFT",
  "COMERCIAL",
  "NAO_RESOLVIDA",
] as const;
export type Licenca = (typeof LICENCAS)[number];

/** Licenças que só valem com o componente e a versão escritos. */
const EXIGEM_REFERENCIA: readonly Licenca[] = ["COPYLEFT", "COMERCIAL"];

const MIN_NOME = 3;
/** O mínimo da IP-R2 — exportado para o contador da tela de cadastro. */
export const MIN_DESCRICAO = 40;
const MIN_LINK = 4;
const MIN_REFERENCIA = 3;

/** A partir de quantos reusos o ativo deixa de ser rascunho. */
export const LIMITE_COMPROVADO = 2;

export type EntradaDeAtivo = {
  nome: string;
  descricao: string;
  link: string;
  /** O ativo mora no editor do próprio catálogo, e não num endereço externo. */
  viveAqui: boolean;
  servicos: string[];
  procedencia: Procedencia;
  origemEngagementId: string | null;
  reusoConfirmado: boolean;
  licenca: Licenca;
  licencaRef: string;
};

export type Criterio = {
  id: string;
  texto: string;
  ok: boolean;
};

/**
 * Os seis critérios, sempre na mesma ordem e sempre todos — a lista é a mesma
 * atendida ou não, porque ela também é o que a pessoa lê para saber o que falta.
 */
export function avaliarRegua(e: EntradaDeAtivo): Criterio[] {
  const licencaResolvida =
    e.licenca !== "NAO_RESOLVIDA" &&
    (!EXIGEM_REFERENCIA.includes(e.licenca) ||
      e.licencaRef.trim().length >= MIN_REFERENCIA);

  // Cláusula de reuso é de um contrato específico: confirmar sem dizer qual
  // não confirma nada.
  const procedenciaResolvida =
    e.procedencia !== "ENGAJAMENTO" ||
    (e.reusoConfirmado && Boolean(e.origemEngagementId));

  return [
    {
      id: "IP-R1",
      texto: "Nome que outra pessoa acha na busca",
      ok: e.nome.trim().length >= MIN_NOME,
    },
    {
      id: "IP-R2",
      texto: "Problema que ele resolve, em uma frase",
      ok: e.descricao.trim().length >= MIN_DESCRICAO,
    },
    {
      id: "IP-R3",
      texto: "Endereço onde o ativo vive de verdade",
      ok: e.viveAqui || e.link.trim().length >= MIN_LINK,
    },
    {
      id: "IP-R4",
      texto: "Pelo menos um serviço que ele encurta",
      ok: e.servicos.length > 0,
    },
    {
      id: "IP-R5",
      texto: "Direito de reuso confirmado na procedência",
      ok: procedenciaResolvida,
    },
    {
      id: "IP-R6",
      texto: "Licença de terceiro resolvida e referenciada",
      ok: licencaResolvida,
    },
  ];
}

export function criteriosPendentes(criterios: Criterio[]): Criterio[] {
  return criterios.filter((c) => !c.ok);
}

/**
 * Maturidade não é escolhida em lugar nenhum: é função da contagem de reuso.
 * O ativo vira comprovado quando o SEGUNDO reuso é registrado — o primeiro
 * ainda é o uso que o criou.
 */
export function maturidadeDe(reusos: number): "RASCUNHO" | "COMPROVADO" {
  return reusos >= LIMITE_COMPROVADO ? "COMPROVADO" : "RASCUNHO";
}

import type { EntradaDeAtivo, Licenca, TipoDeAtivo } from "@/lib/ip/regua";

/**
 * O estado do formulário de cadastro é a entrada da régua mais o que a régua
 * não julga: tipo e dono não entram em critério nenhum, mas entram no ativo.
 */
export type Formulario = EntradaDeAtivo & {
  tipo: TipoDeAtivo;
  donoPersonId: string;
};

/** Licenças que só valem — e só devem ser enviadas — com referência escrita. */
const LICENCAS_QUE_EXIGEM_REFERENCIA: readonly Licenca[] = [
  "COPYLEFT",
  "COMERCIAL",
];

/**
 * Monta o payload de criação a partir do estado visível do formulário.
 *
 * Um campo condicional some da tela quando a pessoa troca de procedência ou
 * de licença, mas o estado que o gerou não é limpo — o rascunho sobrevive a
 * ela voltar atrás. É aqui, no envio, que o que não está mais visível deixa
 * de ser enviado: `origemEngagementId`/`reusoConfirmado` só saem com
 * `procedencia === "ENGAJAMENTO"`, e `licencaRef` só com uma licença que
 * ainda exige referência. Sem isso, um ativo pode ficar gravado com uma
 * origem paga e uma procedência interna ao mesmo tempo — a contradição que a
 * régua existe para impedir.
 */
export function montarPayloadDeCriacao(form: Formulario) {
  const licencaExigeReferencia = LICENCAS_QUE_EXIGEM_REFERENCIA.includes(
    form.licenca
  );
  const nasceuDeEngajamento = form.procedencia === "ENGAJAMENTO";

  return {
    nome: form.nome,
    tipo: form.tipo,
    descricao: form.descricao,
    // Derivado do nome, como o formulário anterior já fazia: o corpo do
    // ativo nasce com o título e cresce no editor.
    conteudo: `# ${form.nome}\n\n`,
    link: form.viveAqui ? undefined : form.link,
    viveAqui: form.viveAqui,
    donoPersonId: form.donoPersonId || undefined,
    servicoIds: form.servicos,
    procedencia: form.procedencia,
    origemEngagementId: nasceuDeEngajamento
      ? (form.origemEngagementId ?? undefined)
      : undefined,
    reusoConfirmado: nasceuDeEngajamento ? form.reusoConfirmado : undefined,
    licenca: form.licenca,
    licencaRef: licencaExigeReferencia
      ? form.licencaRef || undefined
      : undefined,
  };
}

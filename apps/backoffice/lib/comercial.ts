/**
 * Constantes do comercial.
 *
 * Moram fora de `app/actions/proposals.ts` porque um módulo `"use server"` só
 * pode exportar função async — exportar uma const de lá quebra o build inteiro
 * do app, não só a action. Mesmo motivo de `lib/client-queries.ts`.
 */

/**
 * Acima deste percentual, a proposta não é enviada no clique: entra na fila de
 * PlatformApproval.
 *
 * Exportado porque a TELA também precisa dele — mostrar o limite enquanto a
 * pessoa monta a proposta evita descobrir o gate só no clique de enviar, depois
 * de o desconto já ter sido combinado com o cliente.
 *
 * Um número só, lido pelos dois lados. Duplicar entre tela e action é como o
 * gate se afrouxa sem ninguém decidir afrouxá-lo.
 */
export const LIMITE_DESCONTO_SEM_APROVACAO = 15;

/**
 * Base do gerador de identificador de documento: prefixo + timestamp em
 * base36. Não exportada — `gerarNumeroProposta` e `gerarCodigoEngajamento` são
 * a mesma lógica com prefixo diferente, e duas rotinas gerando número por
 * lógicas diferentes seria dois jeitos de quebrar um identificador que precisa
 * ser exato.
 */
function gerarCodigoDocumento(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Número da proposta.
 *
 * Mora aqui, e não em `app/actions/proposals.ts`, pelo motivo no topo deste
 * arquivo: módulo `"use server"` só exporta função async, e esta é síncrona de
 * propósito — é cálculo puro, não tem ida ao banco para justificar `async`.
 * Declarada lá, derrubava o build inteiro do back-office.
 *
 * Extraída porque `converterEmProposta`, em `app/actions/leads.ts`, também
 * cria uma `Proposal` — e duas rotinas gerando número por lógicas diferentes
 * seria dois jeitos de quebrar um identificador que precisa ser exato.
 */
export function gerarNumeroProposta(): string {
  return gerarCodigoDocumento("P");
}

/**
 * Código do engajamento que `materializarEngajamento`
 * (`app/actions/scaffold.ts`) cria ao aterrissar uma promoção de Scaffold.
 * Mesmo espírito de `gerarNumeroProposta`: `createEngagementAction` aceita
 * código digitado à mão, mas aqui não há humano decidindo o código — a
 * materialização parte de uma lacuna do Meridian, não de um formulário livre.
 */
export function gerarCodigoEngajamento(): string {
  return gerarCodigoDocumento("ENG");
}

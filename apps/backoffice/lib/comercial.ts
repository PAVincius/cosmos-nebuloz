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
  return `P-${Date.now().toString(36).toUpperCase()}`;
}

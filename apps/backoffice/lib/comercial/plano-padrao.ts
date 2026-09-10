/**
 * Qual plano vem marcado numa proposta nova.
 *
 * Existe como função, e não como índice solto na tela, porque a regra tem duas
 * partes que um `planos[1]` esconde:
 *
 * 1. **Plano de piso zero nunca é padrão.** Ele existe para cotar serviço
 *    avulso — um diagnóstico, por exemplo — sem arrastar assinatura junto.
 *    Quem quer cotar assim escolhe deliberadamente; ninguém cai nisso por
 *    descuido.
 * 2. **O padrão é o segundo plano de plataforma**, não o primeiro. É uma
 *    decisão comercial: a proposta abre no plano do meio, não no mais barato.
 *
 * Antes disto a tela lia `catalogo.planos[1]`, o que só significava "o do
 * meio" enquanto o catálogo tivesse exatamente três planos nessa ordem.
 * Acrescentar o plano de diagnóstico teria trocado o padrão de toda proposta
 * nova em silêncio.
 */

type PlanoEscolhivel = {
  slug: string;
  minimoAssentos: number;
};

/** Plano de piso zero é veículo de serviço avulso, não assinatura. */
function ehDePlataforma(plano: PlanoEscolhivel): boolean {
  return plano.minimoAssentos > 0;
}

/**
 * O slug que uma proposta nova abre marcado. String vazia quando não há plano
 * de plataforma nenhum no catálogo — a tela trata isso como "escolha um".
 */
export function planoPadrao(planos: PlanoEscolhivel[]): string {
  const plataforma = planos.filter(ehDePlataforma);
  return plataforma[1]?.slug ?? plataforma[0]?.slug ?? "";
}

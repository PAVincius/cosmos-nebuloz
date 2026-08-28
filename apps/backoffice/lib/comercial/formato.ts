/**
 * Dinheiro entra e sai da tela por aqui.
 *
 * Morava dentro de `app/(staff)/servicos/catalogo.tsx`, e a tela de propostas
 * importava de lá — uma tela dependendo de outra por um helper. Fora das duas,
 * as duas podem mudar sem se puxar.
 *
 * A regra que justifica `paraCentavos` existir: pt-BR usa `.` como separador de
 * milhar, então `Number.parseFloat("406.873")` devolve `406.873` — erro de
 * 1000× exatamente onde ele custa dinheiro. Aqui só os dígitos importam, e os
 * dois últimos são os centavos, qualquer que tenha sido o separador digitado.
 */

const NAO_DIGITO = /[^\d]/g;

export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** "1.250,00" ou "1250" → 125000. */
export function paraCentavos(texto: string): number {
  const so = texto.replace(NAO_DIGITO, "");
  return so ? Number.parseInt(so, 10) : 0;
}

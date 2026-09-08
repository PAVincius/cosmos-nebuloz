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

/** Texto de um campo editável de dinheiro, sem separador de milhar —
 *  `lancamento-dialog.tsx`, `caixa.tsx` e `cac/painel.tsx` formatavam essa
 *  mesma coisa cada um do seu jeito, dois deles já sem separador. Esse é o
 *  formato que `paraCentavos` lê de volta sem ambiguidade: com separador de
 *  milhar, "1.250" vira 1250 lido de volta, não 125000 — o mesmo problema de
 *  fuso do `.` que justifica `paraCentavos` existir, só que na direção
 *  inversa. `toFixed` preserva o sinal sozinho. */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/** "1.250,00" ou "1250" → 125000; "-1.250,00" → -125000. O sinal só sobrevive
 *  quando o texto começa com "-" — sem isso, uma linha migrada com valor
 *  negativo (livro-razão antigo não exigia positividade) troca de sinal no
 *  round-trip por `centavosParaTexto`/`paraCentavos`, e o DRE anda o dobro do
 *  valor sem aviso nenhum. */
export function paraCentavos(texto: string): number {
  const negativo = texto.trim().startsWith("-");
  const so = texto.replace(NAO_DIGITO, "");
  const valor = so ? Number.parseInt(so, 10) : 0;
  return negativo ? -valor : valor;
}

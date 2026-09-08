import { rotear } from "./rotear-memoria.mts";
import type { Roteamento } from "./tipos.mts";

export const TAMANHO_DICA_CORPO = 600;

/**
 * Política de roteamento de um documento inteiro. Nome e título decidem
 * (spec §3.2); o corpo entra só como fallback, quando os dois não casam
 * nada — um ADR que só nomeia o produto em "Contexto de origem" ainda chega
 * ao produto certo, mas um nome explícito nunca é sobreposto por uma menção
 * de passagem no corpo.
 */
export function rotearDocumento(
  arquivo: string,
  titulo: string,
  corpo: string
): Roteamento {
  const primeiro = rotear(arquivo, titulo);
  if (primeiro.destino !== "compartilhado") {
    return primeiro;
  }
  return rotear(arquivo, `${titulo} ${corpo.slice(0, TAMANHO_DICA_CORPO)}`);
}

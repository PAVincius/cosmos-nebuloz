import { PALAVRAS_CHAVE } from "./produtos.mts";
import type { Roteamento } from "./tipos.mts";

/**
 * Decide o produto de um arquivo de memória pelo nome e, se houver, título.
 *
 * Regra da spec §3.2: a primeira lista de PALAVRAS_CHAVE que casar decide, e
 * dentro dela o primeiro termo que casar é o motivo. A ordem das listas em
 * produtos.mts é significativa — produto específico antes de genérico — e é
 * o que faz "story-034-lgpd" ir para plataforma e não para cosmos.
 *
 * Sem termo nenhum: "compartilhado", com motivo explícito para a note do
 * Maestro listar.
 */
export function rotear(nomeArquivo: string, titulo = ""): Roteamento {
  const alvo = `${nomeArquivo} ${titulo}`.toLowerCase();
  for (const { produto, termos } of PALAVRAS_CHAVE) {
    const termo = termos.find((t) => alvo.includes(t));
    if (termo !== undefined) {
      return { destino: produto, motivo: termo };
    }
  }
  return { destino: "compartilhado", motivo: "sem palavra-chave" };
}

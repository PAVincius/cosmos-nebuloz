// paginacao.test.ts — o teto das leituras de lista.
//
// Nenhuma listagem do painel sai do banco sem `take`: 1000 leads viravam
// 1000 cards arrastáveis numa tela só. A janela pede um a mais que a página
// para saber se há próxima sem uma segunda consulta de contagem; a listagem
// devolve a lista de sempre quando ninguém pediu página, e `{ itens, temMais }`
// quando pediu.
import { describe, expect, it } from "vitest";
import {
  janela,
  listagem,
  paginasCarregadas,
  TETO_DA_LISTA,
} from "../lib/paginacao";

describe("janela", () => {
  it("sem opções: primeira página, teto mais um para saber se há próxima", () => {
    expect(janela()).toEqual({ skip: 0, take: TETO_DA_LISTA + 1 });
  });

  it("página 3 pula duas páginas inteiras", () => {
    expect(janela({ pagina: 3 })).toEqual({
      skip: 2 * TETO_DA_LISTA,
      take: TETO_DA_LISTA + 1,
    });
  });

  it("porPagina não passa do teto nem fica abaixo de 1", () => {
    expect(janela({ porPagina: 5000 }).take).toBe(TETO_DA_LISTA + 1);
    expect(janela({ porPagina: 0 }).take).toBe(2);
    expect(janela({ pagina: 0 }).skip).toBe(0);
  });
});

describe("listagem", () => {
  const linhas = Array.from({ length: TETO_DA_LISTA + 1 }, (_, i) => i);

  it("sem opções devolve a lista de sempre, cortada no teto", () => {
    const lista = listagem(linhas, undefined);
    expect(Array.isArray(lista)).toBe(true);
    expect(lista).toHaveLength(TETO_DA_LISTA);
  });

  it("com página devolve itens e temMais — a linha extra é o sinal, não item", () => {
    const pagina = listagem(linhas, { pagina: 1 });
    expect(pagina.itens).toHaveLength(TETO_DA_LISTA);
    expect(pagina.temMais).toBe(true);
  });

  it("página cheia sem linha extra: temMais false", () => {
    const pagina = listagem(linhas.slice(0, TETO_DA_LISTA), { pagina: 1 });
    expect(pagina.itens).toHaveLength(TETO_DA_LISTA);
    expect(pagina.temMais).toBe(false);
  });

  it("respeita porPagina menor", () => {
    const pagina = listagem([1, 2, 3, 4], { pagina: 1, porPagina: 3 });
    expect(pagina.itens).toEqual([1, 2, 3]);
    expect(pagina.temMais).toBe(true);
  });
});

describe("paginasCarregadas", () => {
  it("relê as páginas 1..N em paralelo e concatena, mantendo temMais da última", async () => {
    const ler = async (pagina: number) => ({
      itens: [pagina * 10, pagina * 10 + 1],
      temMais: pagina < 3,
    });
    const tudo = await paginasCarregadas(ler, 3);
    expect(tudo.itens).toEqual([10, 11, 20, 21, 30, 31]);
    expect(tudo.temMais).toBe(false);
  });
});

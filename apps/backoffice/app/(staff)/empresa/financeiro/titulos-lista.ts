"use client";

import { useCallback, useState } from "react";
import type { ContaView } from "@/app/actions/empresa/financeiro";
import { listarTitulos } from "@/app/actions/empresa/titulos";
import type { TituloRow } from "@/lib/empresa/livro";
import { anexar, paginasCarregadas } from "@/lib/paginacao";

export type TitulosPayload = {
  titulos: TituloRow[];
  contas: ContaView[];
  /** A primeira página parou no teto e há mais. */
  temMais?: boolean;
};

/**
 * A lista viva da aba Títulos: até o teto, com "Mostrar mais" e o recorte de
 * 90 dias ligável. `usePaginas` não serve aqui porque trocar o recorte
 * recomeça da página 1 — e o hook não tem como zerar a contagem de páginas.
 *
 * Toda escrita relê as páginas que já estavam na tela (`recarregar`), com o
 * mesmo recorte: quem abriu três páginas e baixou um título da terceira não
 * vê a lista encolher de volta.
 */
export function useListaDeTitulos(inicial: TitulosPayload) {
  const [dados, setDados] = useState({
    contas: inicial.contas,
    titulos: inicial.titulos,
  });
  const [antigos, setAntigos] = useState(false);
  const [paginas, setPaginas] = useState(1);
  const [temMais, setTemMais] = useState(inicial.temMais ?? false);
  const [carregando, setCarregando] = useState(false);
  const [erroDaLista, setErroDaLista] = useState<string | null>(null);

  /** Relê as páginas 1..`ate` com o recorte dado. Devolve o erro, ou `null`. */
  const ler = useCallback(
    async (comAntigos: boolean, ate: number): Promise<string | null> => {
      let falha: string | null = null;
      let contas: ContaView[] | null = null;
      const tudo = await paginasCarregadas(async (pagina) => {
        const res = await listarTitulos({ antigos: comAntigos, pagina });
        if (!res.ok) {
          falha = res.error;
          return { itens: [], temMais: false };
        }
        contas = res.data.contas;
        return { itens: res.data.titulos, temMais: res.data.temMais };
      }, ate);
      if (falha !== null) {
        return falha;
      }
      setDados((atual) => ({
        contas: contas ?? atual.contas,
        titulos: tudo.itens,
      }));
      setTemMais(tudo.temMais);
      return null;
    },
    []
  );

  const recarregar = useCallback(
    () => ler(antigos, paginas),
    [ler, antigos, paginas]
  );

  const mostrarMais = useCallback(async () => {
    setErroDaLista(null);
    setCarregando(true);
    try {
      const res = await listarTitulos({ antigos, pagina: paginas + 1 });
      if (!res.ok) {
        setErroDaLista(res.error);
        return;
      }
      setDados((atual) => ({
        ...atual,
        titulos: anexar(atual.titulos, res.data.titulos),
      }));
      setPaginas(paginas + 1);
      setTemMais(res.data.temMais);
    } finally {
      setCarregando(false);
    }
  }, [antigos, paginas]);

  const alternarAntigos = useCallback(async () => {
    const novo = !antigos;
    setErroDaLista(null);
    setCarregando(true);
    try {
      const falha = await ler(novo, 1);
      if (falha !== null) {
        setErroDaLista(falha);
        return;
      }
      setAntigos(novo);
      setPaginas(1);
    } finally {
      setCarregando(false);
    }
  }, [antigos, ler]);

  return {
    alternarAntigos,
    antigos,
    carregando,
    dados,
    erroDaLista,
    mostrarMais,
    recarregar,
    temMais,
  };
}

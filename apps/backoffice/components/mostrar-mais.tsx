"use client";

import { useCallback, useState } from "react";
import { BotaoSecundario, Erro } from "@/components/campo";
import { type Pagina, paginasCarregadas, TETO_DA_LISTA } from "@/lib/paginacao";
import type { Result } from "@/lib/safe-action";

/**
 * "Mostrar mais" das listas que chegam do servidor até o teto
 * (`lib/paginacao.ts`) e crescem no cliente, uma página por clique.
 *
 * A primeira página chega pela forma antiga (array) nas telas cujo
 * `page.tsx` chama a action sem argumento; `temMaisInicial` é, nesses casos,
 * "a página veio cheia" — um teto exato custaria uma contagem a mais no
 * banco, e página cheia sem mais nada é o caso raro (o clique responde
 * "acabou" e o botão some). Da segunda página em diante a action diz
 * `temMais` de verdade.
 *
 * `reler` é para depois de uma escrita: relê as páginas que já estavam na
 * tela, não só a primeira — quem carregou três páginas e mudou um item da
 * terceira não pode ver a lista encolher de volta.
 */
export function usePaginas<T>(
  ler: (pagina: number) => Promise<Result<Pagina<T>>>,
  temMaisInicial: boolean
) {
  const [paginas, setPaginas] = useState(1);
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** A próxima página, ou `null` se falhou — o motivo fica em `erro`. */
  const proxima = useCallback(async (): Promise<T[] | null> => {
    setErro(null);
    setCarregando(true);
    try {
      const res = await ler(paginas + 1);
      if (!res.ok) {
        setErro(res.error);
        return null;
      }
      setPaginas(paginas + 1);
      setTemMais(res.data.temMais);
      return res.data.itens;
    } finally {
      setCarregando(false);
    }
  }, [ler, paginas]);

  const reler = useCallback(async (): Promise<Result<T[]>> => {
    const lidas: Pagina<T>[] = [];
    let falha: string | null = null;
    const tudo = await paginasCarregadas(async (pagina) => {
      const res = await ler(pagina);
      if (!res.ok) {
        falha = res.error;
        return { itens: [], temMais: false };
      }
      lidas.push(res.data);
      return res.data;
    }, paginas);
    if (falha !== null) {
      return { error: falha, ok: false };
    }
    setTemMais(tudo.temMais);
    return { data: tudo.itens, ok: true };
  }, [ler, paginas]);

  return { carregando, erro, proxima, reler, temMais };
}

/** O botão e o erro da página que não veio, no pé da lista. Some quando não
 *  há mais — um botão que responde "acabou" é pior que nenhum. */
export function BotaoMostrarMais({
  temMais,
  carregando,
  erro,
  onClick,
}: {
  temMais: boolean;
  carregando: boolean;
  erro: string | null;
  onClick: () => void;
}) {
  if (!temMais) {
    return null;
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <BotaoSecundario disabled={carregando} onClick={onClick}>
        {carregando ? "Carregando…" : `Mostrar mais ${TETO_DA_LISTA}`}
      </BotaoSecundario>
      {erro ? <Erro>{erro}</Erro> : null}
    </div>
  );
}

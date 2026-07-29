"use client";

import { useCallback, useEffect, useState } from "react";
import type { Result } from "@/app/actions/_base";

// Busca de dados de tela com os três estados obrigatórios do NFR-4.
//
// O protótipo cobre loading e empty; erro de rede não é simulado lá e é
// responsabilidade desta implementação. Por isso `error` é cidadão de primeira
// classe aqui, não um catch silencioso: uma tela de governança que mostra lista
// vazia quando a query falhou mente para o auditor.

export type ScreenState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * `fetcher` DEVE vir de `useCallback` na tela, com os filtros nas deps — é a
 * identidade dele que dispara o refetch quando um filtro muda. `nonce` é o
 * segundo gatilho, para o `reload()` manual após uma mutação.
 *
 * Nota: um autofix já removeu `nonce` das deps deste efeito uma vez. Sem ele o
 * `reload()` não recarrega nada e a tela fica mostrando dado velho depois de
 * uma decisão — falha silenciosa. Se o lint reclamar, o `biome-ignore` abaixo é
 * a resposta, não remover a dependência.
 */
export function useCharterData<T>(
  fetcher: () => Promise<Result<T>>
): ScreenState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // `nonce` é gatilho de reload, não valor lido dentro do efeito — por isso o
  // linter o vê como dependência supérflua. Removê-lo faz `reload()` parar de
  // recarregar, e a tela segue mostrando dado velho depois de uma decisão
  // registrada. Falha silenciosa num produto de evidência: não remover.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce é gatilho de refetch, não valor lido — remover quebra reload()
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => {
        if (!alive) {
          return;
        }
        if (res.ok) {
          setData(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(
            e instanceof Error ? e.message : "Falha de rede ao carregar a tela."
          );
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [fetcher, nonce]);

  return { data, loading, error, reload };
}

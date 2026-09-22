"use client";

import { useEffect, useState } from "react";
import { Erro } from "@/components/campo";
import { type Pagina, TETO_DA_LISTA } from "@/lib/paginacao";
import type { Result } from "@/lib/safe-action";

/**
 * Busca que vai ao servidor quando a lista da tela não é a lista inteira.
 *
 * A carteira e as propostas chegam até o teto (`lib/paginacao.ts`). Filtrar
 * no navegador achava só o que já estava carregado: com 140 clientes, o 101º
 * não existia para a busca. Quem monta decide quando perguntar ao servidor
 * (`buscar` nulo = a lista inteira está na tela, filtra no navegador) e o que
 * mostrar enquanto a resposta não vem.
 *
 * Uma pergunta por pausa na digitação, não uma por tecla — cada uma passa
 * pelo guard e pelo teto de requisições do staff. E resposta de um termo que
 * já mudou não pinta a lista do termo novo: o mesmo `valendo` da paleta
 * (`components/paleta-lista.tsx`).
 */

export const ESPERA_DA_DIGITACAO = 250;

export type BuscaNoServidor<T> =
  | { estado: "ociosa" }
  | { estado: "buscando" }
  | { estado: "pronta"; itens: T[]; temMais: boolean }
  | { estado: "falhou"; motivo: string };

export type Buscar<T> = (termo: string) => Promise<Result<Pagina<T>>>;

export function useBuscaNoServidor<T>(
  termo: string,
  buscar: Buscar<T> | null
): BuscaNoServidor<T> {
  const [busca, setBusca] = useState<BuscaNoServidor<T>>({ estado: "ociosa" });
  useEffect(() => {
    const limpo = termo.trim();
    if (!buscar || limpo === "") {
      setBusca({ estado: "ociosa" });
      return;
    }
    let valendo = true;
    setBusca({ estado: "buscando" });
    const espera = setTimeout(async () => {
      let proxima: BuscaNoServidor<T>;
      try {
        const res = await buscar(limpo);
        proxima = res.ok
          ? {
              estado: "pronta",
              itens: res.data.itens,
              temMais: res.data.temMais,
            }
          : { estado: "falhou", motivo: res.error };
      } catch {
        proxima = {
          estado: "falhou",
          motivo: "Sem resposta do servidor. Verifique a conexão.",
        };
      }
      if (valendo) {
        setBusca(proxima);
      }
    }, ESPERA_DA_DIGITACAO);
    return () => {
      valendo = false;
      clearTimeout(espera);
    };
  }, [termo, buscar]);
  return busca;
}

/** Os itens que a tela mostra: a resposta do servidor quando há, senão o
 *  filtro do que já está carregado — provisório enquanto a busca corre, e o
 *  que resta quando ela falha (a frase de `SituacaoDaBusca` diz isso). */
export function visiveisDaBusca<T>(
  busca: BuscaNoServidor<T>,
  carregados: T[]
): T[] {
  return busca.estado === "pronta" ? busca.itens : carregados;
}

/** A linha sob a busca: o que ela está fazendo, dito. `onde` é o universo
 *  ("toda a carteira", "todas as propostas"). */
export function SituacaoDaBusca({
  busca,
  termo,
  onde,
}: {
  busca: BuscaNoServidor<unknown>;
  termo: string;
  onde: string;
}) {
  if (busca.estado === "falhou") {
    return (
      <Erro>{`Não foi possível buscar em ${onde}: ${busca.motivo} A lista abaixo é só a que já estava carregada.`}</Erro>
    );
  }
  let texto: string | null = null;
  if (busca.estado === "buscando") {
    texto = `Buscando “${termo.trim()}” em ${onde}…`;
  } else if (busca.estado === "pronta" && busca.temMais) {
    texto = `Mostrando os ${TETO_DA_LISTA} primeiros resultados — refine a busca para ver o resto.`;
  }
  // Nada a dizer, nada na tela: o contador da `Busca` já anuncia o resultado.
  if (texto === null) {
    return null;
  }
  return (
    <p
      style={{
        margin: 0,
        fontSize: "var(--fs-nota)",
        color: "var(--ink-faint)",
      }}
    >
      {texto}
    </p>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Estado de trabalho na URL, não em `useState`.
 *
 * Item aberto, aba ativa, filtro escolhido — tudo isso morre no F5 e não cabe
 * num link quando vive só em memória. Na URL, o operador recarrega e volta ao
 * mesmo lugar, e "aba Usuários do cliente X" vira um link que se cola num
 * ticket.
 *
 * Dois modos, e o padrão é o **raso**: `window.history.replaceState`, que o
 * Next integra ao roteador — `useSearchParams` acompanha — sem refetch de
 * RSC. Antes todo `setValor` era `router.replace`, e `router.replace` no App
 * Router é navegação: o servidor re-renderiza a rota e o `loading.tsx` entra
 * no lugar da tela. Trocar de aba no detalhe do cliente passava pelo esqueleto
 * inteiro para ler três coisas que já estavam na página.
 *
 * `{ servidor: true }` é para o param que muda o que o servidor lê (filtro que
 * a página consulta no banco): aí a navegação é o que se quer, mas dentro de
 * `startTransition`, e o hook expõe `pendente` para o controle dizer que está
 * esperando (`aria-busy`) em vez de a tela inteira cair no esqueleto.
 *
 * Diferenças deliberadas em relação ao `audit/filtros.tsx`: `replace` em vez
 * de `push`, porque trocar de item não é uma página nova e encher o histórico
 * faria a seta de voltar percorrer cada clique; e `scroll: false`, porque a
 * pessoa está no meio da tela e o item aberto fica logo abaixo.
 */

export type OpcoesDeUrl = {
  /** O param muda o que o servidor lê: navega (`router.replace`) numa
   *  transição em vez de só trocar a URL. */
  servidor?: boolean;
};

function proximaUrl(
  pathname: string,
  params: URLSearchParams,
  mudancas: Record<string, string>
): string {
  const proximos = new URLSearchParams(params.toString());
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor) {
      proximos.set(chave, valor);
    } else {
      proximos.delete(chave);
    }
  }
  const consulta = proximos.toString();
  return consulta ? `${pathname}?${consulta}` : pathname;
}

/** O par `[substituir, pendente]` que os dois hooks públicos compartilham.
 *  Valor vazio apaga o param; os params que não estão em `mudancas` ficam
 *  como estavam. Dois `replace` seguidos no mesmo tick se sobrescreveriam —
 *  cada um parte do snapshot anterior de `useSearchParams` — por isso a forma
 *  em lote. */
function useSubstituir(
  servidor: boolean
): [(mudancas: Record<string, string>) => void, boolean] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendente, iniciarTransicao] = useTransition();

  const substituir = useCallback(
    (mudancas: Record<string, string>) => {
      const url = proximaUrl(pathname, params, mudancas);
      if (servidor) {
        iniciarTransicao(() => {
          router.replace(url, { scroll: false });
        });
        return;
      }
      // `null` como estado: o Next copia os próprios campos internos por cima
      // (`__NA`, árvore da rota) — é a forma documentada de atualização rasa.
      window.history.replaceState(null, "", url);
    },
    [params, pathname, router, servidor]
  );

  return [substituir, pendente];
}

/** Aplica várias mudanças numa troca só de URL. */
export function useSubstituirParams(
  opcoes: OpcoesDeUrl = {}
): (mudancas: Record<string, string>) => void {
  const [substituir] = useSubstituir(opcoes.servidor === true);
  return substituir;
}

/**
 * `[valor, setValor, pendente]` para um param só. Sem o param na URL, `valor`
 * é o `padrao`; definir o padrão de volta remove o param, para a URL limpa
 * continuar sendo a forma canônica do estado inicial. `pendente` só liga com
 * `{ servidor: true }` — no modo raso não há o que esperar.
 */
export function useParamState(
  nome: string,
  padrao = "",
  opcoes: OpcoesDeUrl = {}
): [string, (valor: string) => void, boolean] {
  const params = useSearchParams();
  const [substituir, pendente] = useSubstituir(opcoes.servidor === true);

  const valor = params.get(nome) ?? padrao;

  const setValor = useCallback(
    (novo: string) => {
      substituir({ [nome]: novo === padrao ? "" : novo });
    },
    [nome, padrao, substituir]
  );

  return [valor, setValor, pendente];
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Estado de trabalho na URL, não em `useState`.
 *
 * Item aberto, aba ativa, filtro escolhido — tudo isso morre no F5 e não cabe
 * num link quando vive só em memória. Na URL, o operador recarrega e volta ao
 * mesmo lugar, e "aba Usuários do cliente X" vira um link que se cola num
 * ticket.
 *
 * Mesma semântica de `app/(staff)/audit/filtros.tsx` (que não é reutilizável
 * de lá: o `definir` é um callback interno). Diferenças deliberadas: `replace`
 * em vez de `push`, porque trocar de item não é uma página nova e encher o
 * histórico faria a seta de voltar percorrer cada clique; e `scroll: false`,
 * porque a pessoa está no meio da tela e o item aberto fica logo abaixo.
 */

/** Aplica várias mudanças num `replace` só. Valor vazio apaga o param; os
 *  params que não estão em `mudancas` ficam como estavam. Dois `replace`
 *  seguidos no mesmo tick se sobrescreveriam — cada um parte do snapshot
 *  anterior de `useSearchParams` — por isso existe a forma em lote. */
export function useSubstituirParams(): (
  mudancas: Record<string, string>
) => void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return useCallback(
    (mudancas: Record<string, string>) => {
      const proximos = new URLSearchParams(params.toString());
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor) {
          proximos.set(chave, valor);
        } else {
          proximos.delete(chave);
        }
      }
      const consulta = proximos.toString();
      router.replace(consulta ? `${pathname}?${consulta}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router]
  );
}

/**
 * `[valor, setValor]` para um param só. Sem o param na URL, `valor` é o
 * `padrao`; definir o padrão de volta remove o param, para a URL limpa
 * continuar sendo a forma canônica do estado inicial.
 */
export function useParamState(
  nome: string,
  padrao = ""
): [string, (valor: string) => void] {
  const params = useSearchParams();
  const substituir = useSubstituirParams();

  const valor = params.get(nome) ?? padrao;

  const setValor = useCallback(
    (novo: string) => {
      substituir({ [nome]: novo === padrao ? "" : novo });
    },
    [nome, padrao, substituir]
  );

  return [valor, setValor];
}

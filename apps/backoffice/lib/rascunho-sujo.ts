"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Rascunho sujo não some em silêncio.
 *
 * Estúdio e Biblioteca trocavam de item e jogavam fora a edição pendente sem
 * perguntar (crítica, heurística 3; persona Riley: "trocar de diagrama com XML
 * sujo e perder tudo"). Aqui mora o pedaço comum às duas telas: segurar o
 * clique enquanto está sujo, guardar o alvo pendente até a pessoa responder, e
 * avisar o navegador antes de fechar a aba. A pergunta em si é da tela — ela
 * sabe o nome do item e onde a pergunta cabe.
 */

/** Enquanto `sujo`, fechar ou recarregar a aba passa pelo diálogo nativo do
 *  navegador. Registrado e limpo no efeito para não sobrar listener depois
 *  que a tela sai. */
export function useAvisoAoSair(sujo: boolean): void {
  useEffect(() => {
    if (!sujo) {
      return;
    }
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sujo]);
}

/**
 * Guarda entre o clique e a troca de item.
 *
 * `abrir(id)` abre direto quando não há nada a perder; sujo, guarda o `id` em
 * `pendente` e devolve a decisão à tela. `descartar()` abre o pendente;
 * `voltar()` esquece o pendente e mantém tudo como está. Clicar no próprio
 * item aberto nunca pergunta — não há troca.
 */
export function useGuardaDeRascunho({
  sujo,
  abertoId,
  abrirDeFato,
}: {
  sujo: boolean;
  abertoId: string | undefined;
  abrirDeFato: (id: string) => void;
}): {
  abrir: (id: string) => void;
  pendente: string | null;
  descartar: () => void;
  voltar: () => void;
} {
  const [pendente, setPendente] = useState<string | null>(null);
  useAvisoAoSair(sujo);

  const abrir = useCallback(
    (id: string) => {
      if (sujo && id !== abertoId) {
        setPendente(id);
        return;
      }
      abrirDeFato(id);
    },
    [sujo, abertoId, abrirDeFato]
  );

  const descartar = useCallback(() => {
    if (pendente === null) {
      return;
    }
    setPendente(null);
    abrirDeFato(pendente);
  }, [pendente, abrirDeFato]);

  const voltar = useCallback(() => setPendente(null), []);

  return { abrir, descartar, pendente, voltar };
}

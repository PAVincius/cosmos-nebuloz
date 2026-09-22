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

/**
 * Os rascunhos sujos montados agora — uma marca por `useAvisoAoSair(true)`
 * vivo. É o que o menu lateral, o wordmark e a paleta consultam antes de
 * navegar: navegação do App Router não descarrega a página, então o
 * `beforeunload` não via o clique no menu e a edição sumia calada.
 *
 * Módulo, e não contexto: quem registra é qualquer tela, em qualquer ponto da
 * árvore (inclusive dentro de portal de diálogo), e quem consulta é o shell —
 * nenhum provider para esquecer de montar. Só efeito escreve aqui, e efeito
 * não roda no servidor, então o conjunto não vaza entre requisições.
 */
const sujos = new Set<symbol>();

/** Há alguma edição não salva na tela agora? */
export function haRascunhoSujo(): boolean {
  return sujos.size > 0;
}

/** Enquanto `sujo`, fechar ou recarregar a aba passa pelo diálogo nativo do
 *  navegador, e o menu do shell pergunta antes de trocar de tela. Registrado
 *  e limpo no efeito para não sobrar listener nem marca depois que a tela
 *  sai. */
export function useAvisoAoSair(sujo: boolean): void {
  useEffect(() => {
    if (!sujo) {
      return;
    }
    const marca = Symbol("rascunho");
    sujos.add(marca);
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => {
      sujos.delete(marca);
      window.removeEventListener("beforeunload", avisar);
    };
  }, [sujo]);
}

/**
 * Guarda da saída da tela: o par do registro acima, para quem navega (o menu,
 * o wordmark, a paleta) e não sabe se a tela aberta tem edição pendente.
 *
 * `segurar(href)` devolve `true` quando segurou — há rascunho sujo, e o
 * destino fica em `pendente` até a pessoa responder; `false` quando não há o
 * que perder e quem chamou segue navegando do jeito dele (o `<Link>` segue
 * sozinho). `descartar()` navega para o pendente; `voltar()` esquece.
 */
export function useSaidaGuardada(navegar: (href: string) => void): {
  segurar: (href: string) => boolean;
  pendente: string | null;
  descartar: () => void;
  voltar: () => void;
} {
  const [pendente, setPendente] = useState<string | null>(null);

  const segurar = useCallback((href: string) => {
    if (!haRascunhoSujo()) {
      return false;
    }
    setPendente(href);
    return true;
  }, []);

  const descartar = useCallback(() => {
    if (pendente === null) {
      return;
    }
    setPendente(null);
    navegar(pendente);
  }, [pendente, navegar]);

  const voltar = useCallback(() => setPendente(null), []);

  return { descartar, pendente, segurar, voltar };
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

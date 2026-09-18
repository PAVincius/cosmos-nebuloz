import { useMemo, useSyncExternalStore } from "react";
import { vi } from "vitest";

/**
 * `next/navigation` de mentira para teste de componente.
 *
 * As telas que guardam estado na URL (`lib/url-state.ts`) leem de
 * `useSearchParams` e escrevem, no modo raso, com `history.replaceState` —
 * que o Next integra ao roteador — ou, com `{ servidor: true }`, com
 * `router.replace`. Um mock estático (`useSearchParams: () => new
 * URLSearchParams("...")`) prova que a escrita foi chamada, mas a tela nunca
 * reage — e o teste antigo que clica num nó e espera o painel abrir
 * quebraria. Aqui as duas escritas atualizam a URL e avisam os hooks, que
 * re-renderizam via `useSyncExternalStore`: o teste vê o mesmo que o operador
 * vê depois que o Next processa a troca.
 *
 * Uso: `vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"))`
 * e, no `beforeEach`, `zerarRoteador("/rota", "a=1")`.
 */

let pathname = "/";
let search = "";
const ouvintes = new Set<() => void>();

function notificar(): void {
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function irPara(href: string): void {
  const [caminho, consulta = ""] = href.split("?");
  pathname = caminho;
  search = consulta;
  notificar();
}

/** Coloca a URL num estado conhecido e limpa as chamadas gravadas. */
export function zerarRoteador(caminho = "/", consulta = ""): void {
  replaceMock.mockClear();
  replaceStateMock.mockClear();
  pushMock.mockClear();
  pathname = caminho;
  search = consulta;
  notificar();
}

export const replaceMock = vi.fn((href: string) => irPara(href));
export const pushMock = vi.fn((href: string) => irPara(href));

/** A troca rasa de URL. O Next faz `history.replaceState` chegar a
 *  `useSearchParams`; aqui é o mesmo caminho, e a chamada fica gravada para o
 *  teste afirmar `(null, "", url)` — a assinatura documentada. */
export const replaceStateMock = vi.fn(
  (_estado: unknown, _titulo: string, url?: string | URL | null) => {
    if (url !== undefined && url !== null) {
      irPara(String(url));
    }
  }
);
window.history.replaceState =
  replaceStateMock as unknown as History["replaceState"];

export function usePathname(): string {
  return useSyncExternalStore(
    assinar,
    () => pathname,
    () => pathname
  );
}

export function useSearchParams(): URLSearchParams {
  const atual = useSyncExternalStore(
    assinar,
    () => search,
    () => search
  );
  return useMemo(() => new URLSearchParams(atual), [atual]);
}

type Roteador = {
  back: () => void;
  forward: () => void;
  prefetch: (href: string) => void;
  push: (href: string, opcoes?: { scroll?: boolean }) => void;
  refresh: () => void;
  replace: (href: string, opcoes?: { scroll?: boolean }) => void;
};

export function useRouter(): Roteador {
  return {
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: pushMock,
    refresh: vi.fn(),
    replace: replaceMock,
  };
}

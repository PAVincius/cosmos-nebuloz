/** @vitest-environment jsdom */
// url-state-servidor.test.tsx — `{ servidor: true }` em `useParamState`: para
// param que muda o que o servidor lê (filtro que a página consulta no banco),
// o `router.replace` continua, mas dentro de `startTransition`, e o hook
// expõe `pendente` para o controle dizer que está esperando (`aria-busy`)
// em vez de a tela inteira cair no esqueleto.
//
// `useTransition` é mockado: o `isPending` real só liga quando a navegação
// de fato suspende, e com `router.replace` de mentira ela nunca suspende.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useParamState } from "@/lib/url-state";

const { replaceMock, transicao, url } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  transicao: { pendente: false, iniciar: vi.fn((fn: () => void) => fn()) },
  url: { pathname: "/audit", search: "" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => url.pathname,
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(url.search),
}));

vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useTransition: () => [transicao.pendente, transicao.iniciar] as const,
  };
});

const replaceState = vi.spyOn(window.history, "replaceState");

beforeEach(() => {
  replaceMock.mockReset();
  transicao.iniciar.mockClear();
  transicao.pendente = false;
  replaceState.mockClear();
  url.search = "";
});

describe("useParamState com servidor: true", () => {
  it("definir chama router.replace dentro de startTransition, não history.replaceState", () => {
    url.search = "q=vanta";
    const { result } = renderHook(() =>
      useParamState("tenant", "", { servidor: true })
    );

    act(() => result.current[1]("t-1"));

    expect(transicao.iniciar).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/audit?q=vanta&tenant=t-1", {
      scroll: false,
    });
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("pendente reflete a transição", () => {
    transicao.pendente = true;
    const { result } = renderHook(() =>
      useParamState("tenant", "", { servidor: true })
    );

    expect(result.current[2]).toBe(true);
  });
});

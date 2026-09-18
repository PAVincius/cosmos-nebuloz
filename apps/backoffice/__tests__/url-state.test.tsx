/** @vitest-environment jsdom */
// url-state.test.tsx — o helper que põe estado de trabalho na URL
// (`lib/url-state.ts`). Lê de `useSearchParams`, preserva os outros params,
// remove o param quando o valor volta ao padrão e não rola a página.
//
// O modo padrão é **raso**: `window.history.replaceState`, que o Next integra
// ao roteador (`useSearchParams` acompanha) sem refetch de RSC — trocar de
// aba ou abrir um item não passa mais pelo `loading.tsx`. `router.replace`
// fica para `{ servidor: true }` (ver url-state-servidor.test.tsx).
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useParamState, useSubstituirParams } from "@/lib/url-state";

const { replaceMock, url } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  url: { pathname: "/ferramentas/bpmn", search: "" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => url.pathname,
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(url.search),
}));

const replaceState = vi.spyOn(window.history, "replaceState");

beforeEach(() => {
  replaceMock.mockReset();
  replaceState.mockClear();
  url.pathname = "/ferramentas/bpmn";
  url.search = "";
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("useParamState", () => {
  it("sem o param na URL, devolve o padrão", () => {
    const { result } = renderHook(() => useParamState("aba", "resumo"));
    expect(result.current[0]).toBe("resumo");
  });

  it("com o param na URL, devolve o valor da URL", () => {
    url.search = "aba=usuarios";
    const { result } = renderHook(() => useParamState("aba", "resumo"));
    expect(result.current[0]).toBe("usuarios");
  });

  it("definir um valor é raso: history.replaceState preservando os outros params, sem router.replace", () => {
    url.search = "pagina=2&q=vanta";
    const { result } = renderHook(() => useParamState("aba", "resumo"));

    act(() => result.current[1]("audit"));

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/ferramentas/bpmn?pagina=2&q=vanta&aba=audit"
    );
    expect(replaceMock).not.toHaveBeenCalled();
    // Raso não tem transição de servidor: nunca fica pendente.
    expect(result.current[2]).toBe(false);
  });

  it("voltar ao padrão remove o param e mantém os demais", () => {
    url.search = "aba=audit&q=vanta";
    const { result } = renderHook(() => useParamState("aba", "resumo"));

    act(() => result.current[1]("resumo"));

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/ferramentas/bpmn?q=vanta"
    );
  });

  it("sem nenhum param sobrando, a URL fica só com o pathname (sem '?')", () => {
    url.search = "diagrama=d1";
    const { result } = renderHook(() => useParamState("diagrama"));

    act(() => result.current[1](""));

    expect(replaceState).toHaveBeenCalledWith(null, "", "/ferramentas/bpmn");
  });
});

describe("useSubstituirParams", () => {
  it("aplica várias mudanças num replaceState só — vazio apaga, valor define", () => {
    url.search = "novo=Funil&q=x";
    const { result } = renderHook(() => useSubstituirParams());

    act(() => result.current({ diagrama: "d9", novo: "" }));

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/ferramentas/bpmn?q=x&diagrama=d9"
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

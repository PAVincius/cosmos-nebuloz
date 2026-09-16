/** @vitest-environment jsdom */
// url-state.test.tsx — o helper que põe estado de trabalho na URL
// (`lib/url-state.ts`). Mesma semântica de `audit/filtros.tsx`: lê de
// `useSearchParams`, escreve com `router.replace` preservando os outros
// params, remove o param quando o valor volta ao padrão e não rola a página.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  replaceMock.mockReset();
  url.pathname = "/ferramentas/bpmn";
  url.search = "";
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

  it("definir um valor faz router.replace preservando os outros params, sem rolar", () => {
    url.search = "pagina=2&q=vanta";
    const { result } = renderHook(() => useParamState("aba", "resumo"));

    act(() => result.current[1]("audit"));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      "/ferramentas/bpmn?pagina=2&q=vanta&aba=audit",
      { scroll: false }
    );
  });

  it("voltar ao padrão remove o param e mantém os demais", () => {
    url.search = "aba=audit&q=vanta";
    const { result } = renderHook(() => useParamState("aba", "resumo"));

    act(() => result.current[1]("resumo"));

    expect(replaceMock).toHaveBeenCalledWith("/ferramentas/bpmn?q=vanta", {
      scroll: false,
    });
  });

  it("sem nenhum param sobrando, a URL fica só com o pathname (sem '?')", () => {
    url.search = "diagrama=d1";
    const { result } = renderHook(() => useParamState("diagrama"));

    act(() => result.current[1](""));

    expect(replaceMock).toHaveBeenCalledWith("/ferramentas/bpmn", {
      scroll: false,
    });
  });
});

describe("useSubstituirParams", () => {
  it("aplica várias mudanças num replace só — vazio apaga, valor define", () => {
    url.search = "novo=Funil&q=x";
    const { result } = renderHook(() => useSubstituirParams());

    act(() => result.current({ diagrama: "d9", novo: "" }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      "/ferramentas/bpmn?q=x&diagrama=d9",
      { scroll: false }
    );
  });
});

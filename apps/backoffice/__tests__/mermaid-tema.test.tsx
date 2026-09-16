/** @vitest-environment jsdom */
// mermaid-tema.test.tsx — o preview do Mermaid segue o tema do painel.
//
// `theme: "dark"` estava fixo: no tema claro o diagrama vinha com fundo e
// traços do escuro, ilegível sobre superfície branca. O painel alterna por
// `next-themes` (`resolvedTheme`); o editor lê o mesmo valor — "dark" no
// escuro, "default" no claro — e re-renderiza quando o tema muda.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MermaidEditor } from "@/components/mermaid-editor";

const { initializeMock, temaMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  temaMock: vi.fn<() => string | undefined>(() => "dark"),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMock,
    render: vi.fn(async () => ({ svg: "<svg />" })),
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: temaMock() }),
}));

async function montarERenderizar() {
  render(
    <MermaidEditor
      onSalvar={async () => null}
      podeEscrever
      sourceInicial="flowchart LR"
    />
  );
  // O render espera o debounce de 400 ms; o import dinâmico do mermaid
  // resolve em microtasks depois disso.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("MermaidEditor — tema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initializeMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("no escuro, inicializa o mermaid com theme dark", async () => {
    temaMock.mockReturnValue("dark");

    await montarERenderizar();

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dark" })
    );
  });

  it("no claro, inicializa com theme default", async () => {
    temaMock.mockReturnValue("light");

    await montarERenderizar();

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "default" })
    );
    expect(initializeMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dark" })
    );
  });
});

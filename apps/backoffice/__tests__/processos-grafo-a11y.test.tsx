/** @vitest-environment jsdom */
// processos-grafo-a11y.test.tsx — o grafo não sequestra a página.
//
// 1. A roda do mouse fazia pan e chamava `preventDefault` sempre: num canvas
//    de 640px no meio da página, rolar a página parava ali. Regra: a roda só
//    faz pan/zoom com o canvas focado (clique nele; `tabIndex=0`) ou com
//    Ctrl/⌘; caso contrário, a página rola.
// 2. `Escape` no listener global limpava a seleção mesmo com o
//    `ProcessoDialog` aberto — a pessoa fechava o diálogo e perdia o painel.
// 3. Arrastar um nó parece persistir e some no reload: não há action de
//    posição em `app/actions/processos.ts`, então a dica avisa.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Grafo } from "@/app/(staff)/ferramentas/processos/grafo";
import { ProcessoDialog } from "@/app/(staff)/ferramentas/processos/processo-dialog";

const PROCESSOS = [
  {
    id: "a",
    codigo: "PZ-01",
    nome: "Funil de leads",
    descricao: "",
    dominio: "COMERCIAL" as const,
    nivel: 2 as const,
    tipo: "CORE" as const,
    donoNome: null,
    revisadoEm: null,
    tags: [],
    diagramId: null,
    docUrl: null,
    diagram: null,
  },
];

function montar(onSelecionar = vi.fn()) {
  const utils = render(
    <Grafo
      ligacoes={[]}
      onExportar={vi.fn()}
      onSelecionar={onSelecionar}
      processos={PROCESSOS}
      quente={null}
      selecionado="a"
    />
  );
  const svg = utils.container.querySelector("svg") as SVGSVGElement;
  return { ...utils, onSelecionar, svg };
}

describe("Grafo — roda só com foco ou modificador", () => {
  it("sem foco e sem Ctrl/⌘, a roda não chama preventDefault (a página rola)", () => {
    const { svg } = montar();

    const naoPrevenido = fireEvent.wheel(svg, { deltaY: 10 });

    expect(naoPrevenido).toBe(true);
  });

  it("com o canvas focado, a roda faz pan e chama preventDefault", () => {
    const { svg } = montar();
    const canvas = svg.closest("[tabindex]") as HTMLElement;
    expect(canvas).toBeTruthy();
    canvas.focus();
    expect(document.activeElement).toBe(canvas);

    const naoPrevenido = fireEvent.wheel(svg, { deltaY: 10 });

    expect(naoPrevenido).toBe(false);
  });

  it("com Ctrl/⌘ e sem foco, a roda dá zoom e chama preventDefault", () => {
    const { svg } = montar();

    const naoPrevenido = fireEvent.wheel(svg, { ctrlKey: true, deltaY: 10 });

    expect(naoPrevenido).toBe(false);
  });

  it("a dica diz para clicar no mapa e que a posição do nó não é salva", () => {
    montar();

    expect(
      screen.getByText(/clique no mapa para navegar com a roda/i)
    ).toBeTruthy();
    expect(screen.getByText(/posição não é salva/i)).toBeTruthy();
  });
});

describe("Grafo — Escape respeita o diálogo aberto", () => {
  it("sem diálogo, Escape limpa a seleção", () => {
    const { onSelecionar } = montar();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onSelecionar).toHaveBeenCalledWith(null);
  });

  it("com o ProcessoDialog aberto, Escape fecha o diálogo e não limpa a seleção", () => {
    const onSelecionar = vi.fn();
    const onFechar = vi.fn();
    render(
      <>
        <Grafo
          ligacoes={[]}
          onExportar={vi.fn()}
          onSelecionar={onSelecionar}
          processos={PROCESSOS}
          quente={null}
          selecionado="a"
        />
        <ProcessoDialog
          aberto
          diagramas={[]}
          onFechar={onFechar}
          onSalvar={vi.fn()}
          processo={null}
        />
      </>
    );
    const dialogo = screen.getByRole("dialog");
    expect(dialogo.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "Escape",
    });

    expect(onFechar).toHaveBeenCalled();
    expect(onSelecionar).not.toHaveBeenCalled();
  });
});

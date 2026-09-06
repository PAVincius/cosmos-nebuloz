/** @vitest-environment jsdom */
// processos-grafo.test.tsx — Grafo é apresentacional puro (Task 4): o que se
// prova aqui é a superfície mínima de contrato (um nó por processo, clique
// seleciona, exportar dispara o callback, contagem do rodapé) e o filtro de
// arestas quando um dos lados sumiu do conjunto visível — o resto (pan, zoom,
// arrastar) é interação de mouse/roda sem cobertura de jsdom.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Grafo } from "@/app/(staff)/ferramentas/processos/grafo";

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
    diagramId: "d1",
    docUrl: null,
    diagram: null,
  },
  {
    id: "b",
    codigo: "PZ-02",
    nome: "Gate de fase",
    descricao: "",
    dominio: "DELIVERY" as const,
    nivel: 3 as const,
    tipo: "CORE" as const,
    donoNome: null,
    revisadoEm: null,
    tags: [],
    diagramId: null,
    docUrl: null,
    diagram: null,
  },
];
const LIGACOES = [{ id: "e1", deId: "a", paraId: "b", rotulo: "exige" }];

describe("Grafo", () => {
  it("desenha um nó por processo, rotulado por código e nome", () => {
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={vi.fn()}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    expect(screen.getByLabelText("PZ-01 Funil de leads")).toBeTruthy();
    expect(screen.getByLabelText("PZ-02 Gate de fase")).toBeTruthy();
  });

  it("clicar num nó o seleciona", () => {
    const onSelecionar = vi.fn();
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={onSelecionar}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));
    expect(onSelecionar).toHaveBeenCalledWith("a");
  });

  it("o botão de exportar chama onExportar", () => {
    const onExportar = vi.fn();
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={onExportar}
        onSelecionar={vi.fn()}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\.canvas/i }));
    expect(onExportar).toHaveBeenCalledTimes(1);
  });

  it("conta nós e arestas no rodapé", () => {
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={vi.fn()}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    expect(screen.getByText(/2 NÓS/)).toBeTruthy();
    expect(screen.getByText(/1 ARESTA/)).toBeTruthy();
  });

  it("liga o wheel nativamente com { passive: false }, não via onWheel do React", () => {
    // React 19 registra `onWheel` como listener passivo, o que silenciaria o
    // preventDefault que impede o pinch/scroll da página por baixo do SVG.
    // jsdom não expõe o flag `passive` de volta para leitura, mas expõe a
    // chamada a `addEventListener` — o suficiente para provar que o listener
    // é nativo e não-passivo, em vez de depender da prop JSX.
    const addEventListenerSpy = vi.spyOn(
      EventTarget.prototype,
      "addEventListener"
    );
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={vi.fn()}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    // React também registra um listener de "wheel" próprio (passivo, no
    // container raiz) — por isso procura-se especificamente a chamada não
    // passiva, em vez de assumir a primeira ou única ocorrência.
    const chamadaNaoPassiva = addEventListenerSpy.mock.calls.find(
      ([tipo, , opcoes]) =>
        tipo === "wheel" &&
        typeof opcoes === "object" &&
        opcoes !== null &&
        (opcoes as AddEventListenerOptions).passive === false
    );
    expect(chamadaNaoPassiva).toBeDefined();
    addEventListenerSpy.mockRestore();
  });

  it("aresta cujo nó sumiu do filtro não é desenhada", () => {
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={vi.fn()}
        processos={[PROCESSOS[0]]}
        quente={null}
        selecionado={null}
      />
    );
    expect(screen.getByText(/0 ARESTAS/)).toBeTruthy();
  });
});

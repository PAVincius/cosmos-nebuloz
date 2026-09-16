/** @vitest-environment jsdom */
// foco-visivel.test.tsx — nenhum campo do painel apaga o anel de foco.
//
// O `.cosmos-root :focus-visible` do cosmos.css desenha o anel para todo mundo
// dentro do `<body>`. Um `outline: "none"` inline vence a folha de estilo e
// deixa quem navega por teclado sem saber onde está — a persona Sam travou
// exatamente aí. Estes testes garantem que os campos compartilhados (o `INPUT`
// do kit local e os dois editores de diagrama) não escrevem `outline` inline.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BpmnModeler } from "@/components/bpmn-modeler";
import { INPUT } from "@/components/campo";
import { MermaidEditor } from "@/components/mermaid-editor";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: "<svg />" })),
  },
}));

class ModelerFalso {
  importXML() {
    return Promise.resolve({ warnings: [] });
  }
  saveXML() {
    return Promise.resolve({ xml: "" });
  }
  destroy() {}
  on() {}
}
vi.mock("bpmn-js/lib/Modeler", () => ({ default: ModelerFalso }));
vi.mock("bpmn-js-properties-panel", () => ({
  BpmnPropertiesPanelModule: {},
  BpmnPropertiesProviderModule: {},
}));
vi.mock("diagram-js-minimap", () => ({ default: {} }));
vi.mock("bpmn-js-token-simulation", () => ({ default: {} }));
vi.mock("bpmn-js-color-picker", () => ({ default: {} }));

describe("foco visível — nenhum campo escreve outline inline", () => {
  it("o INPUT compartilhado não apaga o anel", () => {
    render(<input aria-label="campo" style={INPUT} />);

    expect(screen.getByRole("textbox", { name: "campo" }).style.outline).toBe(
      ""
    );
  });

  it("o editor Mermaid não apaga o anel na nota nem na fonte", () => {
    render(
      <MermaidEditor
        onSalvar={async () => null}
        podeEscrever
        sourceInicial="flowchart LR"
      />
    );

    expect(
      screen.getByRole("textbox", { name: "O que mudou nesta revisão" }).style
        .outline
    ).toBe("");
    expect(screen.getByRole("textbox", { name: "Fonte" }).style.outline).toBe(
      ""
    );
  });

  it("o modeler BPMN não apaga o anel na nota", () => {
    render(
      <BpmnModeler
        onSalvar={async () => null}
        podeEscrever
        sourceInicial="<bpmn/>"
      />
    );

    expect(
      screen.getByRole("textbox", { name: "O que mudou nesta revisão" }).style
        .outline
    ).toBe("");
  });
});

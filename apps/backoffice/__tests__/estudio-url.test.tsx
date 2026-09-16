/** @vitest-environment jsdom */
// estudio-url.test.tsx — o diagrama aberto no Estúdio vive em `?diagrama=`.
// F5 reabre o mesmo; link copiado abre no mesmo estado; id que não está na
// lista cai no estado padrão sem erro; clicar noutro item escreve na URL
// preservando os demais params, e é a URL que abre o item.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Estudio } from "@/app/(staff)/ferramentas/estudio";
import type { DiagramDetail, DiagramRow } from "@/app/actions/diagrams";
import { replaceMock, zerarRoteador } from "../vitest-mocks/next-navigation";

const { getDiagramMock } = vi.hoisted(() => ({ getDiagramMock: vi.fn() }));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.mock("@/app/actions/diagrams", () => ({
  createDiagramAction: vi.fn(),
  definirClienteDoDiagramaAction: vi.fn(),
  getDiagram: getDiagramMock,
  updateDiagramAction: vi.fn(),
}));

// O modeler real importa bpmn-js dinamicamente e toca `window`; aqui só
// interessa que o Estúdio montou o editor com a fonte do diagrama certo.
vi.mock("@/components/bpmn-modeler", () => ({
  BPMN_EM_BRANCO: "<bpmn/>",
  BpmnModeler: ({ sourceInicial }: { sourceInicial: string }) => (
    <div>editor:{sourceInicial}</div>
  ),
}));
vi.mock("@/components/mermaid-editor", () => ({
  MERMAID_EXEMPLO: "flowchart",
  MermaidEditor: () => <div>mermaid</div>,
}));

function linha(id: string, name: string): DiagramRow {
  return {
    atualizadoEm: "2026-09-01T00:00:00.000Z",
    criadoPorNome: "Ana",
    descricao: null,
    id,
    kind: "BPMN",
    name,
    slug: id,
    versoes: 1,
  };
}

function detalhe(id: string, name: string): DiagramDetail {
  return {
    ...linha(id, name),
    historico: [],
    sobreTenantId: null,
    sobreTenantNome: null,
    source: `xml-${id}`,
  };
}

const LISTA = [linha("d1", "Diagrama Um"), linha("d2", "Diagrama Dois")];

function montar() {
  return render(
    <Estudio clientes={[]} iniciais={LISTA} kind="BPMN" podeEscrever={true} />
  );
}

beforeEach(() => {
  zerarRoteador("/ferramentas/bpmn");
  getDiagramMock.mockReset().mockImplementation(async (id: string) => ({
    data: detalhe(id, id === "d1" ? "Diagrama Um" : "Diagrama Dois"),
    ok: true,
  }));
});

describe("Estudio — diagrama aberto na URL", () => {
  it("?diagrama=d2 abre o diagrama d2 ao montar", async () => {
    zerarRoteador("/ferramentas/bpmn", "diagrama=d2");
    montar();

    expect(await screen.findByText("editor:xml-d2")).toBeTruthy();
    expect(getDiagramMock).toHaveBeenCalledWith("d2");
  });

  it("sem param, nada está aberto", () => {
    montar();
    expect(screen.getByText("Nenhum diagrama aberto")).toBeTruthy();
    expect(getDiagramMock).not.toHaveBeenCalled();
  });

  it("id que não está na lista cai no estado padrão, sem buscar nem mostrar erro", async () => {
    zerarRoteador("/ferramentas/bpmn", "diagrama=nao-existe");
    montar();

    expect(screen.getByText("Nenhum diagrama aberto")).toBeTruthy();
    await waitFor(() => expect(getDiagramMock).not.toHaveBeenCalled());
  });

  it("clicar num item escreve ?diagrama= preservando os outros params, e a URL abre o item", async () => {
    zerarRoteador("/ferramentas/bpmn", "q=vendas");
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Diagrama Um/ }));

    expect(replaceMock).toHaveBeenCalledWith(
      "/ferramentas/bpmn?q=vendas&diagrama=d1",
      { scroll: false }
    );
    expect(await screen.findByText("editor:xml-d1")).toBeTruthy();
  });
});

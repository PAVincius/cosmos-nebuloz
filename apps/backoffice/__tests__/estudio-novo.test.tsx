/** @vitest-environment jsdom */
// estudio-novo.test.tsx — `?novo=<nome>` (vindo de "Criar diagrama para
// {processo}" no mapa) abre o formulário de criação já com o nome; sem
// permissão de escrita o param é ignorado. Ao criar, o param sai da URL junto
// com a abertura do diagrama novo — senão F5 reabriria o formulário.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Estudio } from "@/app/(staff)/ferramentas/estudio";
import type { DiagramDetail, DiagramRow } from "@/app/actions/diagrams";
import { replaceMock, zerarRoteador } from "../vitest-mocks/next-navigation";

const { getDiagramMock, createDiagramMock } = vi.hoisted(() => ({
  createDiagramMock: vi.fn(),
  getDiagramMock: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.mock("@/app/actions/diagrams", () => ({
  createDiagramAction: createDiagramMock,
  definirClienteDoDiagramaAction: vi.fn(),
  getDiagram: getDiagramMock,
  updateDiagramAction: vi.fn(),
}));

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

const LINHA: DiagramRow = {
  atualizadoEm: "2026-09-01T00:00:00.000Z",
  criadoPorNome: "Ana",
  descricao: null,
  id: "d1",
  kind: "BPMN",
  name: "Diagrama Um",
  slug: "d1",
  versoes: 1,
};

const NOVO: DiagramDetail = {
  ...LINHA,
  historico: [],
  id: "d9",
  name: "Gate de fase",
  slug: "gate-de-fase",
  sobreTenantId: null,
  sobreTenantNome: null,
  source: "xml-d9",
};

function montar(podeEscrever = true) {
  return render(
    <Estudio
      clientes={[]}
      iniciais={[LINHA]}
      kind="BPMN"
      podeEscrever={podeEscrever}
    />
  );
}

beforeEach(() => {
  zerarRoteador("/ferramentas/bpmn", "novo=Gate%20de%20fase");
  createDiagramMock
    .mockReset()
    .mockResolvedValue({ data: { id: "d9", slug: "gate-de-fase" }, ok: true });
  getDiagramMock.mockReset().mockResolvedValue({ data: NOVO, ok: true });
});

describe("Estudio — ?novo= pré-preenche a criação", () => {
  it("abre o formulário com o nome do processo já digitado", () => {
    montar();

    const nome = screen.getByLabelText("Nome") as HTMLInputElement;
    expect(nome.value).toBe("Gate de fase");
    expect(
      screen.getByRole("button", { name: "Criar em branco" })
    ).toBeTruthy();
  });

  it("sem permissão de escrita, ignora o param", () => {
    montar(false);
    expect(screen.queryByLabelText("Nome")).toBeNull();
  });

  it("criar tira ?novo= da URL e abre o diagrama novo num replace só", async () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Criar em branco" }));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        "/ferramentas/bpmn?diagrama=d9",
        {
          scroll: false,
        }
      )
    );
    expect(createDiagramMock).toHaveBeenCalledWith({
      kind: "BPMN",
      name: "Gate de fase",
      source: "<bpmn/>",
    });
    expect(await screen.findByText("editor:xml-d9")).toBeTruthy();
  });
});

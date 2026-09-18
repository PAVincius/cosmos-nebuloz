/** @vitest-environment jsdom */
// estudio-rascunho.test.tsx — trocar de diagrama com XML sujo não descarta
// em silêncio (persona Riley). O outro item não abre; aparece a pergunta
// inline com o nome do diagrama; "Voltar" mantém, "Descartar" troca. E
// enquanto está sujo, fechar a aba passa pelo `beforeunload`.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Estudio } from "@/app/(staff)/ferramentas/estudio";
import type { DiagramDetail, DiagramRow } from "@/app/actions/diagrams";
import {
  replaceStateMock,
  zerarRoteador,
} from "../vitest-mocks/next-navigation";

const { getDiagramMock } = vi.hoisted(() => ({ getDiagramMock: vi.fn() }));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.mock("@/app/actions/diagrams", () => ({
  createDiagramAction: vi.fn(),
  definirClienteDoDiagramaAction: vi.fn(),
  getDiagram: getDiagramMock,
  updateDiagramAction: vi.fn(),
}));

// O editor real é quem sabe se o XML mudou; aqui ele vira um botão que avisa
// o Estúdio pelo mesmo canal (`onSujo`) que o modeler de verdade usa.
vi.mock("@/components/bpmn-modeler", () => ({
  BPMN_EM_BRANCO: "<bpmn/>",
  BpmnModeler: ({
    sourceInicial,
    onSujo,
  }: {
    sourceInicial: string;
    onSujo?: (sujo: boolean) => void;
  }) => (
    <div>
      editor:{sourceInicial}
      <button onClick={() => onSujo?.(true)} type="button">
        Sujar
      </button>
    </div>
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

const PERGUNTA = "Descartar alterações em «Diagrama Um»?";

async function montarComD1Sujo() {
  zerarRoteador("/ferramentas/bpmn", "diagrama=d1");
  render(
    <Estudio clientes={[]} iniciais={LISTA} kind="BPMN" podeEscrever={true} />
  );
  await screen.findByText("editor:xml-d1");
  fireEvent.click(screen.getByRole("button", { name: "Sujar" }));
  replaceStateMock.mockClear();
  getDiagramMock.mockClear();
}

function tentarAbrirD2() {
  fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
  fireEvent.click(screen.getByRole("button", { name: /Diagrama Dois/ }));
}

function dispararBeforeUnload(): Event {
  const evento = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(evento);
  return evento;
}

beforeEach(() => {
  getDiagramMock.mockReset().mockImplementation(async (id: string) => ({
    data: detalhe(id, id === "d1" ? "Diagrama Um" : "Diagrama Dois"),
    ok: true,
  }));
});

describe("Estudio — rascunho sujo", () => {
  it("com XML sujo, clicar noutro diagrama não abre e pergunta com o nome do atual", async () => {
    await montarComD1Sujo();

    tentarAbrirD2();

    expect(screen.getByText(PERGUNTA)).toBeTruthy();
    expect(screen.getByText("editor:xml-d1")).toBeTruthy();
    expect(screen.queryByText("editor:xml-d2")).toBeNull();
    expect(replaceStateMock).not.toHaveBeenCalled();
    expect(getDiagramMock).not.toHaveBeenCalledWith("d2");

    // Voltar vem antes de Descartar: o dedo encontra a saída, não a perda.
    const botoes = screen.getAllByRole("button", {
      name: /^(Voltar|Descartar)$/,
    });
    expect(botoes.map((b) => b.textContent)).toEqual(["Voltar", "Descartar"]);
  });

  it("Descartar abre o outro diagrama", async () => {
    await montarComD1Sujo();
    tentarAbrirD2();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      "/ferramentas/bpmn?diagrama=d2"
    );
    expect(await screen.findByText("editor:xml-d2")).toBeTruthy();
    expect(screen.queryByText(PERGUNTA)).toBeNull();
  });

  it("Voltar mantém o diagrama atual e some com a pergunta", async () => {
    await montarComD1Sujo();
    tentarAbrirD2();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByText(PERGUNTA)).toBeNull();
    expect(screen.getByText("editor:xml-d1")).toBeTruthy();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  it("sem sujeira, trocar de diagrama não pergunta nada", async () => {
    zerarRoteador("/ferramentas/bpmn", "diagrama=d1");
    render(
      <Estudio clientes={[]} iniciais={LISTA} kind="BPMN" podeEscrever={true} />
    );
    await screen.findByText("editor:xml-d1");

    tentarAbrirD2();

    expect(screen.queryByText(PERGUNTA)).toBeNull();
    expect(await screen.findByText("editor:xml-d2")).toBeTruthy();
  });

  it("enquanto está sujo, beforeunload é cancelado; limpo, não", async () => {
    zerarRoteador("/ferramentas/bpmn", "diagrama=d1");
    render(
      <Estudio clientes={[]} iniciais={LISTA} kind="BPMN" podeEscrever={true} />
    );
    await screen.findByText("editor:xml-d1");

    expect(dispararBeforeUnload().defaultPrevented).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Sujar" }));
    await waitFor(() =>
      expect(dispararBeforeUnload().defaultPrevented).toBe(true)
    );
  });
});

// kanban-wip.test.tsx — story-061, segunda metade. O gate de WIP no servidor já
// existe e o board já mostra o contador; faltava poder **mudar** o limite: até
// aqui valiam só os DEFAULT_PORTFOLIO_COLUMNS, e updateWipLimitAction /
// resetKanbanColumns não tinham chamador.
//
// A ação já guarda o papel (ADMIN/STE/RTE). A tela não recria essa regra: ela
// pergunta o papel a getViewerRole e só oferece o controle a quem pode — um
// botão que sempre falha é pior que botão nenhum.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listEpicsMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/kanban", () => ({
  listEpics: (...args: unknown[]) => listEpicsMock(...args),
  moveEpic: vi.fn(),
  createEpic: vi.fn(),
}));

const getPortfolioKanbanConfigMock = vi.fn();
const updateWipLimitActionMock = vi.fn();
const resetKanbanColumnsMock = vi.fn();
const getViewerRoleMock = vi.fn();
vi.mock("@/app/actions/portfolio-kanban", () => ({
  getPortfolioKanbanConfig: (...a: unknown[]) =>
    getPortfolioKanbanConfigMock(...a),
  updateWipLimitAction: (...a: unknown[]) => updateWipLimitActionMock(...a),
  resetKanbanColumns: (...a: unknown[]) => resetKanbanColumnsMock(...a),
  getViewerRole: (...a: unknown[]) => getViewerRoleMock(...a),
}));

const searchEntitiesMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: (...args: unknown[]) => searchEntitiesMock(...args),
}));

import KanbanScreen from "../../components/cosmos/screens/kanban";

const config = (over: Record<string, unknown> = {}) => ({
  columns: [
    { id: "FUNNEL", label: "Funnel", color: "#71717a", wipLimit: 10 },
    { id: "ANALYZING", label: "Analyzing", color: "#8b5cf6", wipLimit: 5 },
    {
      id: "PORTFOLIO_BACKLOG",
      label: "Portfolio Backlog",
      color: "#5e6ad2",
      wipLimit: 5,
    },
    {
      id: "IMPLEMENTING",
      label: "Implementing",
      color: "#0ea5e9",
      wipLimit: 3,
    },
    { id: "DONE", label: "Done", color: "#10b981" },
  ],
  ...over,
});

describe("KanbanScreen — limites de WIP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listEpicsMock.mockResolvedValue({ ok: true, data: [] });
    getPortfolioKanbanConfigMock.mockResolvedValue({
      ok: true,
      data: config(),
    });
    getViewerRoleMock.mockResolvedValue({ ok: true, data: "RTE" });
    searchEntitiesMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("não oferece o controle a quem a ação recusaria", async () => {
    getViewerRoleMock.mockResolvedValue({ ok: true, data: "DEV" });

    render(<KanbanScreen />);
    await waitFor(() => expect(getViewerRoleMock).toHaveBeenCalled());

    expect(
      screen.queryByRole("button", { name: "Configurar limites de WIP" })
    ).toBeNull();
  });

  it("salva o limite novo e recarrega a config", async () => {
    getPortfolioKanbanConfigMock
      .mockResolvedValueOnce({ ok: true, data: config() })
      .mockResolvedValueOnce({
        ok: true,
        data: config({
          columns: [
            {
              id: "IMPLEMENTING",
              label: "Implementing",
              color: "#0ea5e9",
              wipLimit: 7,
            },
          ],
        }),
      });
    updateWipLimitActionMock.mockResolvedValue({ ok: true, data: config() });

    render(<KanbanScreen />);
    const abrir = await screen.findByRole("button", {
      name: "Configurar limites de WIP",
    });
    fireEvent.click(abrir);

    fireEvent.change(await screen.findByLabelText("Limite de Implementing"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

    await waitFor(() =>
      expect(updateWipLimitActionMock).toHaveBeenCalledWith({
        columnId: "IMPLEMENTING",
        wipLimit: 7,
      })
    );
    await waitFor(() =>
      expect(getPortfolioKanbanConfigMock).toHaveBeenCalledTimes(2)
    );
  });

  it("campo vazio remove o limite em vez de virar zero", async () => {
    updateWipLimitActionMock.mockResolvedValue({ ok: true, data: config() });

    render(<KanbanScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Configurar limites de WIP" })
    );

    fireEvent.change(await screen.findByLabelText("Limite de Implementing"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

    await waitFor(() =>
      expect(updateWipLimitActionMock).toHaveBeenCalledWith({
        columnId: "IMPLEMENTING",
        // null é "sem limite". Zero seria uma coluna que não aceita nada.
        wipLimit: null,
      })
    );
  });

  it("só salva as colunas que mudaram", async () => {
    updateWipLimitActionMock.mockResolvedValue({ ok: true, data: config() });

    render(<KanbanScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Configurar limites de WIP" })
    );

    fireEvent.change(await screen.findByLabelText("Limite de Funnel"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));

    await waitFor(() =>
      expect(updateWipLimitActionMock).toHaveBeenCalledTimes(1)
    );
    expect(updateWipLimitActionMock).toHaveBeenCalledWith({
      columnId: "FUNNEL",
      wipLimit: 12,
    });
  });

  it("restaura os limites padrão", async () => {
    resetKanbanColumnsMock.mockResolvedValue({ ok: true, data: config() });

    render(<KanbanScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Configurar limites de WIP" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));

    await waitFor(() => expect(resetKanbanColumnsMock).toHaveBeenCalled());
  });
});

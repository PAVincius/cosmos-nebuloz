// program.test.tsx — Program Board (/cosmos/program). Cobre os critérios da
// story-020 visíveis nesta tela: AC-002 (aviso de capacidade que não bloqueia),
// AC-004 (somente leitura em COMMITTED/CLOSED) e o quadro time × sprint que
// PIPlanFeatureAssignment sempre soube desenhar e nenhuma tela desenhava.
// Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveProgramBoardMock = vi.fn();
const assignFeatureToCellMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/program", () => ({
  getActiveProgramBoard: (...args: unknown[]) =>
    getActiveProgramBoardMock(...args),
  assignFeatureToCell: (...args: unknown[]) => assignFeatureToCellMock(...args),
  createFeature: vi.fn(),
}));

// NewFeatureModal puxa EntityLinkField, que importa a server action
// entity-search no escopo do módulo.
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

import ProgramScreen from "../../components/cosmos/screens/program";

const feature = (over: Record<string, unknown>) => ({
  id: "f1",
  title: "Feature A",
  storyPoints: 5,
  statusId: "IN_PROGRESS",
  milestone: false,
  hasDependency: false,
  ...over,
});

const board = (over: Record<string, unknown>) => ({
  piPlanId: "pi1",
  piPlanName: "PI 2026.3",
  piPlanStatus: "PLANNING",
  readOnly: false,
  sprintCount: 1,
  teams: [
    {
      id: "tm1",
      name: "Squad Atlas",
      cells: [
        {
          sprintId: "sp1",
          sprintName: "Sprint 14",
          features: [feature({ id: "f1", title: "Isolamento de tenant" })],
          assignedSp: 5,
          capacitySp: 40,
          utilizationPct: 13,
          overCapacity: false,
        },
      ],
    },
  ],
  unassigned: [],
  ...over,
});

describe("ProgramScreen", () => {
  beforeEach(() => {
    getActiveProgramBoardMock.mockReset();
    assignFeatureToCellMock.mockReset();
  });

  it("desenha o quadro time × sprint com a carga de cada célula", async () => {
    getActiveProgramBoardMock.mockResolvedValueOnce({
      ok: true,
      data: board({}),
    });

    render(<ProgramScreen />);

    expect(await screen.findByText("Squad Atlas")).toBeTruthy();
    expect(screen.getByText("Sprint 14")).toBeTruthy();
    expect(screen.getByText("Isolamento de tenant")).toBeTruthy();
    expect(screen.getByText("5 / 40 SP")).toBeTruthy();
  });

  it("avisa a célula acima da capacidade sem bloquear nada (AC-002)", async () => {
    getActiveProgramBoardMock.mockResolvedValueOnce({
      ok: true,
      data: board({
        teams: [
          {
            id: "tm1",
            name: "Squad Atlas",
            cells: [
              {
                sprintId: "sp1",
                sprintName: "Sprint 14",
                features: [feature({ id: "f1", storyPoints: 43 })],
                assignedSp: 43,
                capacitySp: 40,
                utilizationPct: 108,
                overCapacity: true,
              },
            ],
          },
        ],
      }),
    });

    render(<ProgramScreen />);

    expect(await screen.findByText("108% da capacidade")).toBeTruthy();
  });

  it("fica somente leitura com o PI COMMITTED (AC-004)", async () => {
    getActiveProgramBoardMock.mockResolvedValueOnce({
      ok: true,
      data: board({
        piPlanStatus: "COMMITTED",
        readOnly: true,
        unassigned: [feature({ id: "f9", title: "Feature pendente" })],
      }),
    });

    render(<ProgramScreen />);

    expect(
      await screen.findByText(
        "Este PI está COMMITTED — o Program Board é somente leitura."
      )
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Alocar Feature pendente/ })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Adicionar Feature" })
    ).toBeNull();
  });

  it("aloca uma feature pendente numa célula e recarrega o quadro", async () => {
    getActiveProgramBoardMock
      .mockResolvedValueOnce({
        ok: true,
        data: board({
          unassigned: [feature({ id: "f9", title: "Feature pendente" })],
        }),
      })
      .mockResolvedValueOnce({ ok: true, data: board({}) });
    assignFeatureToCellMock.mockResolvedValue({
      ok: true,
      data: { featureId: "f9" },
    });

    render(<ProgramScreen />);
    await screen.findByText("Feature pendente");

    fireEvent.click(
      screen.getByRole("button", { name: "Alocar Feature pendente" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Squad Atlas · Sprint 14" })
    );

    await waitFor(() =>
      expect(assignFeatureToCellMock).toHaveBeenCalledWith({
        featureId: "f9",
        teamId: "tm1",
        sprintId: "sp1",
      })
    );
    await waitFor(() =>
      expect(getActiveProgramBoardMock).toHaveBeenCalledTimes(2)
    );
  });

  it("mostra o estado vazio quando não há PI ativo", async () => {
    getActiveProgramBoardMock.mockResolvedValueOnce({ ok: true, data: null });

    render(<ProgramScreen />);

    expect(await screen.findByText("Nenhum PI ativo")).toBeTruthy();
  });

  it("mostra o estado de erro e nenhum time quando a leitura falha", async () => {
    getActiveProgramBoardMock.mockResolvedValueOnce({
      ok: false,
      error: "boom",
    });

    render(<ProgramScreen />);

    await waitFor(() =>
      expect(screen.queryByText("Nenhum PI ativo")).toBeNull()
    );
    expect(document.body.innerHTML).not.toContain("Squad Atlas");
  });
});

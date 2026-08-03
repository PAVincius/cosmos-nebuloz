// capacity.test.tsx — heatmap de utilização do PI (/cosmos/capacity). Cobre os
// critérios da story-057 visíveis na tela: AC-002 (a faixa vem da leitura, a
// tela não redecide), AC-003 (hover com planejado/entregue/utilização) e AC-005
// (vazio e erro sem número fabricado). Asserção sobre conteúdo — sem snapshot.
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listTeamCapacityMock = vi.fn();
const listTeamCapacityAcrossPIMock = vi.fn();
const listCapacityAdjustmentNotesMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/capacity", () => ({
  listTeamCapacity: (...args: unknown[]) => listTeamCapacityMock(...args),
  listTeamCapacityAcrossPI: (...args: unknown[]) =>
    listTeamCapacityAcrossPIMock(...args),
  listCapacityAdjustmentNotes: (...args: unknown[]) =>
    listCapacityAdjustmentNotesMock(...args),
  listTeamSprints: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createCapacityAdjustmentNote: vi.fn(),
}));

import CapacityScreen from "../../components/cosmos/screens/capacity";

const cell = (over: Record<string, unknown>) => ({
  sprintName: "Sprint 1",
  expectedSp: 40,
  actualSp: 36,
  utilizationPct: 90,
  band: "amber",
  ...over,
});

describe("CapacityScreen", () => {
  beforeEach(() => {
    listTeamCapacityMock.mockReset();
    listTeamCapacityAcrossPIMock.mockReset();
    listCapacityAdjustmentNotesMock.mockReset();
    listTeamCapacityMock.mockResolvedValue({ ok: true, data: [] });
    listTeamCapacityAcrossPIMock.mockResolvedValue({ ok: true, data: null });
    listCapacityAdjustmentNotesMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("lê a faixa da action e não redecide o limiar na tela (AC-002/AC-003)", async () => {
    listTeamCapacityAcrossPIMock.mockResolvedValue({
      ok: true,
      data: {
        piPlanId: "pi1",
        piPlanName: "PI 2026.1",
        sprintCount: 3,
        rows: [
          {
            teamId: "tm1",
            teamName: "Squad Atlas",
            cells: [
              cell({ actualSp: 30, utilizationPct: 75, band: "green" }),
              cell({
                sprintName: "Sprint 2",
                actualSp: 40,
                utilizationPct: 100,
                band: "amber",
              }),
              cell({
                sprintName: "Sprint 3",
                actualSp: 44,
                utilizationPct: 110,
                band: "red",
              }),
            ],
          },
        ],
      },
    });

    render(<CapacityScreen />);

    expect(
      await screen.findByTitle(
        "Planejado 40 SP · Entregue 30 SP · Utilização 75% — dentro da capacidade"
      )
    ).toBeTruthy();
    // 100% é o topo da faixa âmbar, não o começo da vermelha (story-032 AC-002).
    expect(
      screen.getByTitle(
        "Planejado 40 SP · Entregue 40 SP · Utilização 100% — no limite da capacidade"
      )
    ).toBeTruthy();
    expect(
      screen.getByTitle(
        "Planejado 40 SP · Entregue 44 SP · Utilização 110% — acima da capacidade"
      )
    ).toBeTruthy();
  });

  it("mostra '—' na célula sem snapshot, sem inferir faixa (AC-001)", async () => {
    listTeamCapacityAcrossPIMock.mockResolvedValue({
      ok: true,
      data: {
        piPlanId: "pi1",
        piPlanName: "PI 2026.1",
        sprintCount: 1,
        rows: [
          {
            teamId: "tm1",
            teamName: "Squad Atlas",
            cells: [
              cell({
                expectedSp: null,
                actualSp: null,
                utilizationPct: null,
                band: null,
              }),
            ],
          },
        ],
      },
    });

    render(<CapacityScreen />);

    await screen.findByText("Squad Atlas");
    expect(screen.getByText("— / — SP")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("dentro da capacidade");
  });

  it("mostra o estado vazio da grade quando não há PI ativo (AC-005)", async () => {
    render(<CapacityScreen />);

    expect(
      await screen.findByText("Sem PI ativo ou sem sprints ainda")
    ).toBeTruthy();
  });

  it("mostra o estado de erro e nenhuma linha de time quando listTeamCapacity falha (AC-005)", async () => {
    listTeamCapacityMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<CapacityScreen />);

    await waitFor(() => expect(screen.queryByText("Carregando...")).toBeNull());
    expect(screen.queryByText("Nenhum time encontrado.")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Squad Atlas");
  });
});

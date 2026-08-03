// piplanning.test.tsx — painel do PI ativo (/cosmos/piplanning). Cobre os
// critérios da story-060 visíveis na tela: AC-001/AC-003 (votar e revelar pela
// tela), AC-004 (histograma só depois da revelação) e AC-005 (sem PI, sem
// rodada e erro, nenhum placar fabricado). Asserção sobre conteúdo — sem
// snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getActivePiPlanningMock = vi.fn();
const castConfidenceVoteMock = vi.fn();
const revealTallyMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/piplanning", () => ({
  getActivePiPlanning: (...args: unknown[]) => getActivePiPlanningMock(...args),
  castConfidenceVote: (...args: unknown[]) => castConfidenceVoteMock(...args),
  revealTally: (...args: unknown[]) => revealTallyMock(...args),
}));

import PiPlanningScreen from "../../components/cosmos/screens/piplanning";

const plan = (over: Record<string, unknown>) => ({
  piPlanName: "PI 2026.3",
  activeSprintName: "Sprint 15",
  objectives: [],
  risks: [],
  confidenceAvg: null,
  confidenceVote: null,
  ...over,
});

const openRound = {
  round: 2,
  status: "OPEN",
  totalVotes: 6,
  participantCount: 10,
  revealed: false,
  histogram: null,
  aggregateScore: null,
};

describe("PiPlanningScreen", () => {
  beforeEach(() => {
    getActivePiPlanningMock.mockReset();
    castConfidenceVoteMock.mockReset();
    revealTallyMock.mockReset();
  });

  it("mostra participação e esconde a distribuição na rodada aberta (AC-004)", async () => {
    getActivePiPlanningMock.mockResolvedValueOnce({
      ok: true,
      data: plan({ confidenceVote: openRound }),
    });

    render(<PiPlanningScreen />);

    expect(await screen.findByText("6 de 10 já votaram")).toBeTruthy();
    expect(
      screen.getByText("Resultado escondido até a revelação")
    ).toBeTruthy();
    expect(screen.queryByText("Distribuição dos votos")).toBeNull();
  });

  it("vota pela tela e recarrega o painel (AC-001)", async () => {
    getActivePiPlanningMock
      .mockResolvedValueOnce({
        ok: true,
        data: plan({ confidenceVote: openRound }),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: plan({
          confidenceVote: { ...openRound, totalVotes: 7 },
        }),
      });
    castConfidenceVoteMock.mockResolvedValue({
      ok: true,
      data: { round: 2, totalVotes: 7 },
    });

    render(<PiPlanningScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Votar 4" }));

    await waitFor(() =>
      expect(castConfidenceVoteMock).toHaveBeenCalledWith({ score: 4 })
    );
    await waitFor(() =>
      expect(getActivePiPlanningMock).toHaveBeenCalledTimes(2)
    );
  });

  it("revela o resultado pela tela e recarrega o painel (AC-003)", async () => {
    getActivePiPlanningMock
      .mockResolvedValueOnce({
        ok: true,
        data: plan({ confidenceVote: openRound }),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: plan({
          confidenceAvg: 3.8,
          confidenceVote: {
            ...openRound,
            status: "TALLYING",
            revealed: true,
            histogram: [0, 1, 1, 3, 1],
            aggregateScore: 3.8,
          },
        }),
      });
    revealTallyMock.mockResolvedValue({
      ok: true,
      data: {
        round: 2,
        aggregateScore: 3.8,
        participationRate: 60,
        histogram: [0, 1, 1, 3, 1],
      },
    });

    render(<PiPlanningScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Revelar resultado" })
    );

    await waitFor(() => expect(revealTallyMock).toHaveBeenCalled());
    expect(await screen.findByText("Distribuição dos votos")).toBeTruthy();
  });

  it("mostra a distribuição e o placar da rodada revelada (AC-004)", async () => {
    getActivePiPlanningMock.mockResolvedValueOnce({
      ok: true,
      data: plan({
        confidenceAvg: 3.8,
        confidenceVote: {
          ...openRound,
          status: "TALLYING",
          revealed: true,
          histogram: [0, 1, 1, 3, 1],
          aggregateScore: 3.8,
        },
      }),
    });

    render(<PiPlanningScreen />);

    expect(await screen.findByText("Distribuição dos votos")).toBeTruthy();
    expect(screen.getByText("Placar 3.8 de 5")).toBeTruthy();
    expect(screen.getByText("3 votos")).toBeTruthy();
    // Rodada revelada não recebe mais voto.
    expect(screen.queryByRole("button", { name: "Votar 4" })).toBeNull();
  });

  it("diz que não há rodada em vez de mostrar placar zerado (AC-005)", async () => {
    getActivePiPlanningMock.mockResolvedValueOnce({
      ok: true,
      data: plan({}),
    });

    render(<PiPlanningScreen />);

    expect(
      await screen.findByText("Nenhuma rodada de confidence vote aberta.")
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Votar 4" })).toBeNull();
  });

  it("mostra o estado sem PI ativo e nenhum controle de voto (AC-005)", async () => {
    getActivePiPlanningMock.mockResolvedValueOnce({ ok: true, data: null });

    render(<PiPlanningScreen />);

    expect(await screen.findByText("Nenhum PI ativo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Votar 4" })).toBeNull();
  });

  it("mostra o estado de erro e nenhum painel quando a leitura falha (AC-005)", async () => {
    getActivePiPlanningMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<PiPlanningScreen />);

    expect(await screen.findByText("boom")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("PI 2026.3");
  });
});

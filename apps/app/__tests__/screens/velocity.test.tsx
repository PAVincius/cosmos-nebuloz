// velocity.test.tsx — Velocity & Capacity Analytics (/cosmos/velocity). Cobre
// os critérios da story-032 visíveis na tela: AC-001 (série comprometido /
// concluído / aceito por sprint e "N/A" sem denominador) e AC-003 (aviso do
// benchmark SAFe de 80% de predictability). Asserção sobre conteúdo — sem
// snapshot.
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRecentSprintsMock = vi.fn();
const listTeamPredictabilityMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/velocity", () => ({
  listRecentSprints: (...args: unknown[]) => listRecentSprintsMock(...args),
  listTeamPredictability: (...args: unknown[]) =>
    listTeamPredictabilityMock(...args),
}));

import VelocityScreen from "../../components/cosmos/screens/velocity";

const sprint = (over: Record<string, unknown>) => ({
  id: "s-x",
  name: "Sprint X",
  capacity: 40,
  velocity: 38,
  completedPoints: 38,
  acceptedPoints: 36,
  predictabilityPct: 90,
  ...over,
});

describe("VelocityScreen", () => {
  beforeEach(() => {
    // mockReset e não clearAllMocks: só o reset esvazia a fila de
    // mockResolvedValueOnce, e um `once` sobrando vaza para o teste seguinte.
    listRecentSprintsMock.mockReset();
    listTeamPredictabilityMock.mockReset();
  });

  it("desenha comprometido, concluído e aceito por sprint (AC-001)", async () => {
    listRecentSprintsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        sprint({ id: "s2", name: "Sprint 13" }),
        sprint({
          id: "s1",
          name: "Sprint 12",
          velocity: 30,
          completedPoints: 30,
          acceptedPoints: 26,
          predictabilityPct: 65,
        }),
      ],
    });
    listTeamPredictabilityMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<VelocityScreen />);

    await waitFor(() =>
      expect(screen.getAllByText("Sprint 13").length).toBeGreaterThan(0)
    );
    // as três séries do AC-001 são nomeadas na legenda — "delivered" sozinho
    // não distingue concluído de aceito, e é a distinção que sustenta o
    // número de predictability
    expect(screen.getByText("Committed")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("Accepted")).toBeTruthy();
  });

  it("avisa quando a predictability média fica abaixo do benchmark SAFe de 80% (AC-003)", async () => {
    listRecentSprintsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        sprint({ id: "s2", name: "Sprint 13" }),
        sprint({
          id: "s1",
          name: "Sprint 12",
          velocity: 30,
          completedPoints: 30,
          acceptedPoints: 26,
          predictabilityPct: 65,
        }),
      ],
    });
    listTeamPredictabilityMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<VelocityScreen />);

    // (90 + 65) / 2 = 77.5 → 78
    await waitFor(
      () =>
        expect(
          screen.getByText("Abaixo do benchmark SAFe de 80% de predictability")
        ).toBeTruthy(),
      { timeout: 3000 }
    );
  });

  it("não avisa quando a predictability média atinge o benchmark (AC-003)", async () => {
    listRecentSprintsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        sprint({ id: "s2", name: "Sprint 13" }),
        sprint({ id: "s1", name: "Sprint 12", predictabilityPct: 82 }),
      ],
    });
    listTeamPredictabilityMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<VelocityScreen />);

    await waitFor(() =>
      expect(screen.getAllByText("Sprint 13").length).toBeGreaterThan(0)
    );
    expect(
      screen.queryByText("Abaixo do benchmark SAFe de 80% de predictability")
    ).toBeNull();
  });

  it("mostra '—' e mantém a sprint sem review fora do gráfico, sem zerar o aceito (AC-001)", async () => {
    listRecentSprintsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        sprint({
          id: "s1",
          name: "Sprint 11",
          completedPoints: null,
          acceptedPoints: null,
          predictabilityPct: null,
        }),
      ],
    });
    listTeamPredictabilityMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<VelocityScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Nenhuma sprint fechada com review registrada")
      ).toBeTruthy()
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("renders per-team predictability from real data", async () => {
    listRecentSprintsMock.mockResolvedValueOnce({ ok: true, data: [] });
    listTeamPredictabilityMock.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          teamId: "team-1",
          teamName: "Squad Atlas",
          predictabilityPct: 92,
          sprintCount: 3,
        },
      ],
    });

    render(<VelocityScreen />);

    await waitFor(() => expect(screen.getByText("Squad Atlas")).toBeTruthy());
    expect(screen.getByText("92%")).toBeTruthy();
  });

  it("shows honest empty states with no closed sprints, not fabricated data", async () => {
    listRecentSprintsMock.mockResolvedValueOnce({ ok: true, data: [] });
    listTeamPredictabilityMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<VelocityScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Nenhuma sprint fechada com review registrada")
      ).toBeTruthy()
    );
    expect(screen.getByText("Sem dados de predictability ainda")).toBeTruthy();
    const html = document.body.innerHTML;
    expect(html).not.toContain("172");
  });
});

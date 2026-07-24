// velocity.test.tsx — mounts VelocityScreen with mocked
// app/(cosmos)/actions/velocity actions (no real DB), verifying the KPI
// row, Committed vs. Delivered chart and per-team predictability panel are
// driven by real action data, and that the honest empty states render when
// there is no closed-sprint data.
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listRecentSprintsMock = vi.fn();
const listTeamPredictabilityMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/velocity", () => ({
  listRecentSprints: (...args: unknown[]) => listRecentSprintsMock(...args),
  listTeamPredictability: (...args: unknown[]) =>
    listTeamPredictabilityMock(...args),
}));

import VelocityScreen from "../../components/cosmos/screens/velocity";

describe("VelocityScreen", () => {
  it("renders KPIs and the committed vs. delivered chart from real sprint data", async () => {
    listRecentSprintsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: "s2",
          name: "Sprint 13",
          capacity: 40,
          velocity: 44,
          sayDoRatioPct: 110,
        },
        {
          id: "s1",
          name: "Sprint 12",
          capacity: 40,
          velocity: 20,
          sayDoRatioPct: 50,
        },
      ],
    });
    listTeamPredictabilityMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<VelocityScreen />);

    await waitFor(() =>
      expect(screen.getAllByText("Sprint 13").length).toBeGreaterThan(0)
    );
    // KpiCard values count up via requestAnimationFrame; wait for the
    // animation's fallback timeout to settle on the real, exact figure.
    // avg velocity = (44 + 20) / 2 = 32
    await waitFor(() => expect(screen.getByText("32")).toBeTruthy(), {
      timeout: 3000,
    });
    // avg predictability = (110 + 50) / 2 = 80
    await waitFor(() => expect(screen.getByText("80")).toBeTruthy(), {
      timeout: 3000,
    });
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
      expect(screen.getByText("Nenhuma sprint fechada ainda")).toBeTruthy()
    );
    expect(screen.getByText("Sem dados de predictability ainda")).toBeTruthy();
    const html = document.body.innerHTML;
    expect(html).not.toContain("172");
  });
});

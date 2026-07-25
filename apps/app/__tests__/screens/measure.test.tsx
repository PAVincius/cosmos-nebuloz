// measure.test.tsx — mounts MeasureScreen with mocked
// app/(cosmos)/actions/measure actions (no real DB), verifying the KPI
// row, radar and per-competency delta column are driven by real action
// data, and that a partial (not-yet-complete) previous cycle degrades the
// radar to current-only instead of fabricating missing prior scores.
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listCompetencyScoresMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/measure", () => ({
  listCompetencyScores: (...args: unknown[]) =>
    listCompetencyScoresMock(...args),
}));

import MeasureScreen from "../../components/cosmos/screens/measure";

const FULL_PREV_CYCLE = [
  {
    competency: "TEAM_TECHNICAL_AGILITY",
    competencyLabel: "Team & Technical Agility",
    score: 4.5,
    prevScore: 4.0,
    delta: 0.5,
    assessedAt: new Date("2026-02-01"),
  },
  {
    competency: "AGILE_PRODUCT_DELIVERY",
    competencyLabel: "Agile Product Delivery",
    score: 2.0,
    prevScore: 2.5,
    delta: -0.5,
    assessedAt: new Date("2026-02-01"),
  },
  {
    competency: "ENTERPRISE_SOLUTION_DELIVERY",
    competencyLabel: "Enterprise Solution Delivery",
    score: 3.0,
    prevScore: 3.0,
    delta: 0,
    assessedAt: new Date("2026-02-01"),
  },
];

describe("MeasureScreen", () => {
  it("renders KPIs and the prev-cycle delta column from real data", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: FULL_PREV_CYCLE,
    });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(
        screen.getAllByText("Team & Technical Agility").length
      ).toBeGreaterThan(0)
    );
    // KpiCard values count up via requestAnimationFrame; wait for the
    // animation's fallback timeout to settle on the real, exact figure.
    // avg maturity = (4.5 + 2.0 + 3.0) / 3 = 3.2 (comma-decimal, matching
    // the codebase's convention for KpiCard's animated decimal values)
    await waitFor(() => expect(screen.getByText("3,2")).toBeTruthy(), {
      timeout: 3000,
    });
    // delta column renders the sign explicitly
    expect(screen.getByText("+0.5")).toBeTruthy();
    expect(screen.getByText("-0.5")).toBeTruthy();
  });

  it("shows the previous-cycle radar overlay when every competency has one", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: FULL_PREV_CYCLE,
    });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(screen.getByText("Ciclo anterior")).toBeTruthy()
    );
  });

  it("degrades to current-only when the previous cycle is partial, not fabricated", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          competency: "TEAM_TECHNICAL_AGILITY",
          competencyLabel: "Team & Technical Agility",
          score: 4.5,
          prevScore: 4.0,
          delta: 0.5,
          assessedAt: new Date("2026-02-01"),
        },
        {
          competency: "AGILE_PRODUCT_DELIVERY",
          competencyLabel: "Agile Product Delivery",
          score: 2.0,
          prevScore: null,
          delta: null,
          assessedAt: new Date("2026-02-01"),
        },
        {
          competency: "ENTERPRISE_SOLUTION_DELIVERY",
          competencyLabel: "Enterprise Solution Delivery",
          score: 3.0,
          prevScore: null,
          delta: null,
          assessedAt: new Date("2026-02-01"),
        },
      ],
    });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(
        screen.getAllByText("Team & Technical Agility").length
      ).toBeGreaterThan(0)
    );
    expect(screen.queryByText("Ciclo anterior")).toBeNull();
    // the honest "—" for a competency with no prior cycle, not a fake 0
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows honest empty states with no assessments, not fabricated data", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(
        screen.getAllByText("Nenhuma avaliação encontrada.").length
      ).toBeGreaterThan(0)
    );
  });
});

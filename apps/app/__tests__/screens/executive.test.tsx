// executive.test.tsx — mounts the Board Snapshot screen with the four
// tenant-scoped mature-layer actions it reuses (getExecutiveDashboard,
// listOkrs, listRisks, listLeanBudgets) mocked, verifying it renders real
// data instead of any handoff mock data, and that the CSV export builds its
// body solely from the loaded snapshot (no fabricated/placeholder rows).
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/analytics/executive", () => ({
  getExecutiveDashboard: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      kpis: {
        predictabilityPct: 82,
        flowEfficiency: 41,
        cycleTimeDays: 3.2,
        costPerPoint: null,
        actionCompletionRate: 60,
        activeARTsCount: 1,
        flowSnapshotCount: 1,
        totalRetroActions: 5,
      },
      artTable: [
        {
          artId: "art-1",
          artName: "ART Pagamentos",
          predictabilityPct: 82,
          criticalAnomalies: 1,
          health: "WARNING",
          healthReasons: [],
        },
      ],
      anomalyFeed: [],
      fromCache: false,
    },
  }),
}));

vi.mock("@/app/(cosmos)/actions/okrs", () => ({
  listOkrs: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: "okr-1",
        title: "Reduzir churn em 20%",
        status: "ON_TRACK",
        ownerName: "Ana",
        keyResults: [
          {
            id: "kr-1",
            title: "KR1",
            current: 8,
            target: 10,
            unit: "%",
            progressPct: 80,
          },
        ],
      },
    ],
  }),
}));

vi.mock("@/app/(cosmos)/actions/risks", () => ({
  listRisks: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: "risk-1",
        title: "Instabilidade no gateway de pagamento",
        roamStatus: "OWNED",
        severity: 5,
        probability: "high",
        impact: "high",
        category: "TECHNICAL",
        ownerName: "Bruno",
      },
    ],
  }),
}));

vi.mock("@/app/(cosmos)/actions/budgets", () => ({
  listLeanBudgets: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: "budget-1",
        name: "ART Pagamentos FY26",
        themeName: null,
        artId: "art-1",
        artName: "ART Pagamentos",
        amount: 1_000_000,
        spent: 650_000,
        period: "2026-Q2",
        capexPct: null,
        opexPct: null,
        spendLimitUsd: null,
        approvalThresholdUsd: null,
        utilizationPct: 65,
      },
    ],
  }),
}));

import ExecutiveScreen, {
  buildSnapshotCsv,
} from "../../components/cosmos/screens/executive";

describe("ExecutiveScreen", () => {
  it("renders real ART, OKR, and risk data from the mature analytics/list actions", async () => {
    render(<ExecutiveScreen />);

    expect(await screen.findByText("ART Pagamentos")).toBeTruthy();
    expect(screen.getByText("Reduzir churn em 20%")).toBeTruthy();
    expect(
      screen.getByText("Instabilidade no gateway de pagamento")
    ).toBeTruthy();
  });
});

describe("buildSnapshotCsv", () => {
  it("builds the CSV body solely from the tenant-scoped snapshot passed in", () => {
    const csv = buildSnapshotCsv({
      dashboard: {
        kpis: {
          predictabilityPct: 82,
          flowEfficiency: 41,
          cycleTimeDays: 3.2,
          costPerPoint: null,
          actionCompletionRate: 60,
          activeARTsCount: 1,
          flowSnapshotCount: 1,
          totalRetroActions: 5,
        },
        artTable: [
          {
            artId: "art-1",
            artName: "ART Pagamentos",
            predictabilityPct: 82,
            criticalAnomalies: 1,
            health: "WARNING",
            healthReasons: [],
          },
        ],
        anomalyFeed: [],
        fromCache: false,
      },
      okrs: [
        {
          id: "okr-1",
          title: "Reduzir churn em 20%",
          status: "ON_TRACK",
          ownerName: "Ana",
          keyResults: [
            {
              id: "kr-1",
              title: "KR1",
              current: 8,
              target: 10,
              unit: "%",
              progressPct: 80,
            },
          ],
        },
      ],
      risks: [
        {
          id: "risk-1",
          title: "Instabilidade no gateway de pagamento",
          roamStatus: "OWNED",
          severity: 5,
          probability: "high",
          impact: "high",
          category: "TECHNICAL",
          ownerName: "Bruno",
        },
      ],
      budgets: [
        {
          id: "budget-1",
          name: "ART Pagamentos FY26",
          themeName: null,
          artId: "art-1",
          artName: "ART Pagamentos",
          amount: 1_000_000,
          spent: 650_000,
          period: "2026-Q2",
          capexPct: null,
          opexPct: null,
          spendLimitUsd: null,
          approvalThresholdUsd: null,
          utilizationPct: 65,
          immutableAt: null,
        },
      ],
    });

    // every real row shows up
    expect(csv).toContain("ART Pagamentos");
    expect(csv).toContain("Reduzir churn em 20%");
    expect(csv).toContain("Instabilidade no gateway de pagamento");
    expect(csv).toContain("ART Pagamentos FY26");

    // no fabricated placeholder rows sneak in when a section is empty
    const emptyCsv = buildSnapshotCsv({
      dashboard: null,
      okrs: [],
      risks: [],
      budgets: [],
    });
    expect(emptyCsv).not.toMatch(/lorem|mock|sample|placeholder/i);
  });
});

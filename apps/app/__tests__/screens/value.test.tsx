// value.test.tsx — mounts the Value Realization screen with a mocked
// value-realization action (no real DB), verifying the table renders the
// planned/actual/status columns from listValueRealizations().
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// EntityLinkField (used by the create-metric modal) imports the real
// entity-search.ts server action — mock it too so this test never touches
// @repo/database / server-only env reads.
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

vi.mock("@/app/(cosmos)/actions/value-realization", () => ({
  createValueMetric: vi.fn(),
  listValueRealizations: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: "vm-1",
        epicId: "epic-1",
        epicTitle: "Onboarding self-serve",
        metricLabel: "Redução de churn",
        unit: "%",
        plannedValue: 15,
        actualValue: 12,
        status: "tracking",
        measuredAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "vm-2",
        epicId: "epic-2",
        epicTitle: "Novo checkout",
        metricLabel: "MRR incremental",
        unit: "USD",
        plannedValue: 5000,
        actualValue: null,
        status: "pending",
        measuredAt: null,
      },
    ],
  }),
  recordActualValue: vi.fn(),
}));

import ValueScreen from "../../components/cosmos/screens/value";

describe("ValueScreen", () => {
  it("renders tracked epics with their business-value metric and status", async () => {
    render(<ValueScreen />);

    expect(await screen.findByText("Onboarding self-serve")).toBeTruthy();
    expect(screen.getByText("Redução de churn")).toBeTruthy();
    expect(screen.getByText("Novo checkout")).toBeTruthy();
    expect(screen.getByText("Em medição")).toBeTruthy();
    expect(screen.getByText("Aguardando dados")).toBeTruthy();
  });
});

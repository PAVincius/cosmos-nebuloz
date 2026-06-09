import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  pIPlanFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: { pIPlan: { findMany: mocks.pIPlanFindMany } },
}));

import { getARTObservability } from "../../app/actions/arts/observability";

const ART_ID = "art-1";

const past = new Date("2025-01-01");
const pastEnd = new Date("2025-03-31");
const future = new Date("2027-01-01");
const futureEnd = new Date("2027-03-31");

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi-1",
    name: "PI-1",
    startDate: past,
    endDate: pastEnd,
    piObjectives: [],
    risks: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.pIPlanFindMany.mockResolvedValue([]);
});

describe("getARTObservability", () => {
  it("returns empty events and zero health when no PI plans", async () => {
    const result = await getARTObservability(ART_ID);
    expect(result.events).toHaveLength(0);
    expect(result.health.piHealth).toHaveLength(0);
    expect(result.health.activeRisks).toBe(0);
    expect(result.health.latestFlowPredictability).toBe(0);
  });

  it("skips plan with no startDate", async () => {
    mocks.pIPlanFindMany.mockResolvedValue([makePlan({ startDate: null })]);
    const result = await getARTObservability(ART_ID);
    expect(result.events).toHaveLength(0);
  });

  it("generates pi_planning event for plan with startDate only", async () => {
    mocks.pIPlanFindMany.mockResolvedValue([makePlan({ endDate: null })]);
    const result = await getARTObservability(ART_ID);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("pi_planning");
    expect(result.events[0].status).toBe("past");
  });

  it("generates 3 events (planning, demo, IA) for plan with startDate and endDate", async () => {
    mocks.pIPlanFindMany.mockResolvedValue([makePlan()]);
    const result = await getARTObservability(ART_ID);
    const types = result.events.map((e) => e.type);
    expect(types).toContain("pi_planning");
    expect(types).toContain("system_demo");
    expect(types).toContain("inspect_adapt");
  });

  it("marks future events as 'future' status", async () => {
    mocks.pIPlanFindMany.mockResolvedValue([
      makePlan({ startDate: future, endDate: futureEnd }),
    ]);
    const result = await getARTObservability(ART_ID);
    expect(result.events.every((e) => e.status === "future")).toBe(true);
  });

  it("computes predictability from committed objectives", async () => {
    mocks.pIPlanFindMany.mockResolvedValue([
      makePlan({
        piObjectives: [
          { id: "o1", status: "ACHIEVED", isStretch: false },
          { id: "o2", status: "NOT_STARTED", isStretch: false },
          { id: "o3", status: "ACHIEVED", isStretch: true },
        ],
      }),
    ]);
    const result = await getARTObservability(ART_ID);
    // 1 of 2 committed achieved = 50%
    expect(result.health.piHealth[0].predictability).toBe(50);
    expect(result.health.piHealth[0].stretchObjectives).toBe(1);
  });

  it("counts active and unresolved risks", async () => {
    mocks.pIPlanFindMany.mockResolvedValue([
      makePlan({
        risks: [
          { id: "r1", status: "OWNED" },
          { id: "r2", status: "ACCEPTED" },
          { id: "r3", status: "RESOLVED" },
          { id: "r4", status: "MITIGATED" },
        ],
      }),
    ]);
    const result = await getARTObservability(ART_ID);
    expect(result.health.activeRisks).toBe(2); // OWNED + ACCEPTED
    expect(result.health.unresolvedRisks).toBe(2);
  });

  it("queries with artId and tenantId scope", async () => {
    await getARTObservability(ART_ID);
    expect(mocks.pIPlanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { artId: ART_ID, tenantId: tenantCtx.tenantId },
      })
    );
  });
});

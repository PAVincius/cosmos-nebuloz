import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const artBase = {
  id: "art-1",
  tenantId: tenantCtx.tenantId,
  name: "My ART",
  piCadenceWeeks: 10,
  sprintLengthWeeks: 2,
  ipSprintEnabled: true,
  teams: [{ id: "team-1" }],
};

const piBase = {
  id: "pi-1",
  tenantId: tenantCtx.tenantId,
  artId: "art-1",
  status: "DRAFT",
  confidenceThreshold: 3.0,
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  artFindFirst: vi.fn(),
  artFindFirstOrThrow: vi.fn(),
  artCreate: vi.fn(),
  artUpdate: vi.fn(),
  artUpdateMany: vi.fn(),
  piPlanFindFirst: vi.fn(),
  piPlanFindFirstOrThrow: vi.fn(),
  piPlanCreate: vi.fn(),
  piPlanUpdate: vi.fn(),
  piObjectiveFindMany: vi.fn(),
  riskFindMany: vi.fn(),
  piSessionFindFirst: vi.fn(),
  sprintFindMany: vi.fn(),
  stateTransitionHistoryCreate: vi.fn(),
  sprintCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    aRT: {
      findFirst: mocks.artFindFirst,
      findFirstOrThrow: mocks.artFindFirstOrThrow,
      create: mocks.artCreate,
      update: mocks.artUpdate,
      updateMany: mocks.artUpdateMany,
    },
    pIPlan: {
      findFirst: mocks.piPlanFindFirst,
      findFirstOrThrow: mocks.piPlanFindFirstOrThrow,
      create: mocks.piPlanCreate,
      update: mocks.piPlanUpdate,
    },
    pIObjective: { findMany: mocks.piObjectiveFindMany },
    risk: { findMany: mocks.riskFindMany },
    pISession: { findFirst: mocks.piSessionFindFirst },
    sprint: { findMany: mocks.sprintFindMany },
    stateTransitionHistory: { create: mocks.stateTransitionHistoryCreate },
    $transaction: mocks.transaction,
  },
}));

import {
  createART,
  createPIPlanWithSprints,
  transitionPIPlan,
  updateARTCadence,
} from "../../../app/actions/arts/lifecycle";

describe("createART", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.artFindFirst.mockResolvedValue(null);
    mocks.artCreate.mockResolvedValue({ id: "art-1", name: "My ART" });
  });

  it("creates ART with INACTIVE status", async () => {
    const result = await createART({
      name: "My ART",
      piCadenceWeeks: 10,
      sprintLengthWeeks: 2,
      ipSprintEnabled: true,
    });

    expect(result.ok).toBe(true);
    expect(mocks.artCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "INACTIVE" }),
      })
    );
  });

  it("rejects duplicate name (case-insensitive)", async () => {
    mocks.artFindFirst.mockResolvedValue({ id: "art-existing" });

    const result = await createART({ name: "My ART" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ART_NAME_CONFLICT");
  });

  it("FORBIDDEN for non-RTE/ADMIN", async () => {
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });

    const result = await createART({ name: "ART" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FORBIDDEN");
  });
});

describe("updateARTCadence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.piPlanFindFirst.mockResolvedValue(null); // no active PI
    mocks.artUpdate.mockResolvedValue({});
    mocks.artUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("allows cadence update when no active PI", async () => {
    const result = await updateARTCadence({
      artId: "art-1",
      piCadenceWeeks: 12,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks when COMMITTED PI exists", async () => {
    mocks.piPlanFindFirst.mockResolvedValue({
      id: "pi-1",
      status: "COMMITTED",
    });

    const result = await updateARTCadence({
      artId: "art-1",
      piCadenceWeeks: 12,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ACTIVE_PI_PLAN");
  });
});

describe("createPIPlanWithSprints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.artFindFirstOrThrow.mockResolvedValue(artBase);
    mocks.piPlanCreate.mockResolvedValue({ id: "pi-1" });
    mocks.sprintCreateMany.mockResolvedValue({ count: 5 });
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      if (typeof fn === "function") {
        return fn({
          pIPlan: { create: mocks.piPlanCreate },
          sprint: { createMany: mocks.sprintCreateMany },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  it("generates 4 regular + 1 IP sprint for 10-week PI with 2-week sprints", async () => {
    const result = await createPIPlanWithSprints({
      artId: "art-1",
      name: "PI 1",
      startDate: "2026-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.sprintCount).toBe(5); // 4 regular + 1 IP
  });

  it("generates only regular sprints when ipSprintEnabled=false", async () => {
    mocks.artFindFirstOrThrow.mockResolvedValue({
      ...artBase,
      ipSprintEnabled: false,
    });

    const result = await createPIPlanWithSprints({
      artId: "art-1",
      name: "PI 1",
      startDate: "2026-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.sprintCount).toBe(5); // 10/2 = 5 regular, no IP
  });

  it("rejects when ART has no teams", async () => {
    mocks.artFindFirstOrThrow.mockResolvedValue({ ...artBase, teams: [] });

    const result = await createPIPlanWithSprints({
      artId: "art-1",
      name: "PI 1",
      startDate: "2026-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ART_NO_TEAMS");
  });
});

describe("transitionPIPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.piPlanFindFirstOrThrow.mockResolvedValue(piBase);
    mocks.piObjectiveFindMany.mockResolvedValue([]);
    mocks.riskFindMany.mockResolvedValue([]);
    mocks.piSessionFindFirst.mockResolvedValue(null);
    mocks.sprintFindMany.mockResolvedValue([]);
    mocks.piPlanUpdate.mockResolvedValue({});
    mocks.stateTransitionHistoryCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      if (typeof fn === "function") {
        return fn({
          pIPlan: { update: mocks.piPlanUpdate },
          stateTransitionHistory: {
            create: mocks.stateTransitionHistoryCreate,
          },
          sprint: { findMany: mocks.sprintFindMany },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  it("DRAFT→PLANNING via OPEN_PLANNING", async () => {
    const result = await transitionPIPlan({
      piPlanId: "pi-1",
      event: "OPEN_PLANNING",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe("PLANNING");
  });

  it("rejects invalid transition (DRAFT→COMMIT)", async () => {
    const result = await transitionPIPlan({
      piPlanId: "pi-1",
      event: "COMMIT",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("INVALID_TRANSITION");
  });

  it("PLANNING→COMMITTED passes commitment gate when no objectives/risks", async () => {
    mocks.piPlanFindFirstOrThrow.mockResolvedValue({
      ...piBase,
      status: "PLANNING",
    });

    const result = await transitionPIPlan({
      piPlanId: "pi-1",
      event: "COMMIT",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe("COMMITTED");
  });

  it("COMMIT fails with COMMITMENT_GATE_FAILED when objectives missing plannedValue", async () => {
    mocks.piPlanFindFirstOrThrow.mockResolvedValue({
      ...piBase,
      status: "PLANNING",
    });
    mocks.piObjectiveFindMany.mockResolvedValue([
      { plannedValue: null },
      { plannedValue: 5 },
    ]);

    const result = await transitionPIPlan({
      piPlanId: "pi-1",
      event: "COMMIT",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("COMMITMENT_GATE_FAILED");
    expect(result.error).toContain("MISSING_PLANNED_VALUE");
  });

  it("FORCE_COMMIT succeeds with ≥20-char reason", async () => {
    mocks.piPlanFindFirstOrThrow.mockResolvedValue({
      ...piBase,
      status: "PLANNING",
    });

    const result = await transitionPIPlan({
      piPlanId: "pi-1",
      event: "FORCE_COMMIT",
      overrideReason: "Escalated via emergency business need — CTO authorized",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe("COMMITTED");
  });

  it("FORCE_COMMIT stores override reason and sets commitmentOverride=true", async () => {
    mocks.piPlanFindFirstOrThrow.mockResolvedValue({
      ...piBase,
      status: "PLANNING",
    });
    const reason = "Emergency business need — CTO authorized override";

    await transitionPIPlan({
      piPlanId: "pi-1",
      event: "FORCE_COMMIT",
      overrideReason: reason,
    });

    expect(mocks.piPlanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commitmentOverride: true,
          commitmentOverrideReason: reason,
        }),
      })
    );
  });

  it("writes StateTransitionHistory with FORCE_COMMIT reason prefix", async () => {
    mocks.piPlanFindFirstOrThrow.mockResolvedValue({
      ...piBase,
      status: "PLANNING",
    });
    const reason = "Emergency business need — authorized by CTO";

    await transitionPIPlan({
      piPlanId: "pi-1",
      event: "FORCE_COMMIT",
      overrideReason: reason,
    });

    expect(mocks.stateTransitionHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: `FORCE_COMMIT: ${reason}`,
          entityType: "PIPlan",
        }),
      })
    );
  });

  it("FORCE_COMMIT fails with reason under 20 chars", async () => {
    mocks.piPlanFindFirstOrThrow.mockResolvedValue({
      ...piBase,
      status: "PLANNING",
    });

    const result = await transitionPIPlan({
      piPlanId: "pi-1",
      event: "FORCE_COMMIT",
      overrideReason: "too short",
    });

    expect(result.ok).toBe(false);
  });
});

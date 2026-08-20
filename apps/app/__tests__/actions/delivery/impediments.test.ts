import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  impedimentFindFirstOrThrow: vi.fn(),
  impedimentUpdateMany: vi.fn(),
  riskCreate: vi.fn(),
  piPlanFindFirst: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  anomalyDetectionRunCreate: vi.fn(),
  anomalyCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    impediment: {
      findFirstOrThrow: mocks.impedimentFindFirstOrThrow,
      updateMany: mocks.impedimentUpdateMany,
    },
    risk: { create: mocks.riskCreate },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
    tenantMember: { findFirst: mocks.tenantMemberFindFirst },
    anomalyDetectionRun: { create: mocks.anomalyDetectionRunCreate },
    anomaly: { create: mocks.anomalyCreate },
    $transaction: mocks.transaction,
  },
}));

import {
  checkImpedimentAging,
  escalateImpediment,
  resolveImpediment,
} from "../../../app/actions/delivery/impediments";

function makeTxProxy() {
  return {
    impediment: {
      findFirstOrThrow: mocks.impedimentFindFirstOrThrow,
      updateMany: mocks.impedimentUpdateMany,
    },
    risk: { create: mocks.riskCreate },
    anomalyDetectionRun: { create: mocks.anomalyDetectionRunCreate },
    anomaly: { create: mocks.anomalyCreate },
  };
}

function makeTransactionMock() {
  const txProxy = makeTxProxy();
  mocks.transaction.mockImplementation(
    (fn: (tx: Record<string, unknown>) => unknown) => {
      if (typeof fn === "function") return fn(txProxy);
      return Promise.all(fn as Promise<unknown>[]);
    }
  );
}

// ─── escalateImpediment ───────────────────────────────────────────────────────

describe("escalateImpediment (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    makeTransactionMock();
    mocks.riskCreate.mockResolvedValue({ id: "risk-1" });
    mocks.impedimentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.piPlanFindFirst.mockResolvedValue({ id: "pi-1" });
    mocks.tenantMemberFindFirst.mockResolvedValue({ id: "member-1" });
  });

  it("rejects an ownerUserId from outside the tenant (IDOR guard)", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue(null);

    const result = await escalateImpediment({
      impedimentId: "imp-1",
      piPlanId: "pi-1",
      ownerUserId: "user-of-another-tenant",
      dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("OWNER_NOT_IN_TENANT");
    expect(mocks.riskCreate).not.toHaveBeenCalled();
  });

  it("rejects a piPlanId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.piPlanFindFirst.mockResolvedValue(null);

    const result = await escalateImpediment({
      impedimentId: "imp-1",
      piPlanId: "pi-of-another-tenant",
      dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("PI_PLAN_NOT_FOUND");
    expect(mocks.riskCreate).not.toHaveBeenCalled();
  });

  it("creates Risk with IMPEDIMENT category and OWNED roamStatus (AC-004)", async () => {
    mocks.impedimentFindFirstOrThrow.mockResolvedValue({
      id: "imp-1",
      title: "Can't access staging",
      description: "DevOps blocked",
      artId: "art-1",
      status: "OPEN",
    });

    const result = await escalateImpediment({
      impedimentId: "imp-1",
      piPlanId: "pi-1",
      ownerUserId: "owner-1",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.riskId).toBe("risk-1");

    // AC-004: Risk created with correct fields
    expect(mocks.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "IMPEDIMENT",
          roamStatus: "OWNED",
          impedimentId: "imp-1",
        }),
      })
    );

    // AC-004: bidirectional — impediment updated with linkedRiskId
    expect(mocks.impedimentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ESCALATED",
          linkedRiskId: "risk-1",
        }),
      })
    );
  });
});

// ─── resolveImpediment ────────────────────────────────────────────────────────

describe("resolveImpediment (AC-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.impedimentUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects note shorter than 20 chars (AC-005)", async () => {
    const result = await resolveImpediment({
      impedimentId: "imp-1",
      resolutionNote: "done",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("RESOLUTION_NOTE_TOO_SHORT");
    expect(mocks.impedimentUpdateMany).not.toHaveBeenCalled();
  });

  it("resolves impediment with valid note and stores resolutionTime (AC-005)", async () => {
    const createdAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
    mocks.impedimentFindFirstOrThrow.mockResolvedValue({
      id: "imp-1",
      status: "ESCALATED",
      createdAt,
    });

    const result = await resolveImpediment({
      impedimentId: "imp-1",
      resolutionNote: "Staging access restored by DevOps on 2026-06-09",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.resolutionTimeHours).toBeCloseTo(3, 0);

    expect(mocks.impedimentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RESOLVED",
          resolutionNote: "Staging access restored by DevOps on 2026-06-09",
        }),
      })
    );
  });
});

// ─── checkImpedimentAging ─────────────────────────────────────────────────────

describe("checkImpedimentAging (AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
    makeTransactionMock();
    mocks.anomalyDetectionRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.anomalyCreate.mockResolvedValue({});
  });

  it("creates IMPEDIMENT_AGING anomaly for CRITICAL impediment >24h (AC-006)", async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
    mocks.impedimentFindFirstOrThrow.mockResolvedValue({
      id: "imp-2",
      severity: 1, // CRITICAL (1=highest)
      status: "OPEN",
      createdAt: oldDate,
      teamId: "team-1",
    });

    const result = await checkImpedimentAging({ impedimentId: "imp-2" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anomalyCreated).toBe(true);
    expect(mocks.anomalyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rule: "IMPEDIMENT_AGING" }),
      })
    );
  });

  it("skips non-critical impediments (AC-006)", async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    mocks.impedimentFindFirstOrThrow.mockResolvedValue({
      id: "imp-3",
      severity: 3, // medium
      status: "OPEN",
      createdAt: oldDate,
      teamId: "team-1",
    });

    const result = await checkImpedimentAging({ impedimentId: "imp-3" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anomalyCreated).toBe(false);
    expect(mocks.anomalyCreate).not.toHaveBeenCalled();
  });

  it("skips RESOLVED impediment (AC-006)", async () => {
    mocks.impedimentFindFirstOrThrow.mockResolvedValue({
      id: "imp-4",
      severity: 1,
      status: "RESOLVED",
      createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      teamId: "team-1",
    });

    const result = await checkImpedimentAging({ impedimentId: "imp-4" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anomalyCreated).toBe(false);
  });
});

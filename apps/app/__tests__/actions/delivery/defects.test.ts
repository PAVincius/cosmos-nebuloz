import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  defectCreate: vi.fn(),
  teamFindFirst: vi.fn(),
  sprintFindFirst: vi.fn(),
  storyFindFirst: vi.fn(),
  defectFindFirstOrThrow: vi.fn(),
  defectUpdateMany: vi.fn(),
  stateTransitionHistoryCreate: vi.fn(),
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
    defect: {
      create: mocks.defectCreate,
      findFirstOrThrow: mocks.defectFindFirstOrThrow,
      updateMany: mocks.defectUpdateMany,
    },
    team: { findFirst: mocks.teamFindFirst },
    sprint: { findFirst: mocks.sprintFindFirst },
    story: { findFirst: mocks.storyFindFirst },
    stateTransitionHistory: { create: mocks.stateTransitionHistoryCreate },
    anomalyDetectionRun: { create: mocks.anomalyDetectionRunCreate },
    anomaly: { create: mocks.anomalyCreate },
    $transaction: mocks.transaction,
  },
}));

import {
  checkDefectStaleness,
  createDefect,
  reopenDefect,
  updateDefectSeverity,
} from "../../../app/actions/delivery/defects";

function makeTxProxy() {
  return {
    defect: {
      create: mocks.defectCreate,
      findFirstOrThrow: mocks.defectFindFirstOrThrow,
      updateMany: mocks.defectUpdateMany,
    },
    stateTransitionHistory: { create: mocks.stateTransitionHistoryCreate },
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

// ─── createDefect ─────────────────────────────────────────────────────────────

describe("createDefect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
    makeTransactionMock();
    mocks.defectCreate.mockResolvedValue({ id: "def-1" });
    mocks.teamFindFirst.mockResolvedValue({ id: "team-1" });
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-1" });
    mocks.storyFindFirst.mockResolvedValue({ id: "story-1" });
    mocks.anomalyDetectionRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.anomalyCreate.mockResolvedValue({});
  });

  it("creates defect (non-critical, no anomaly) (AC-001)", async () => {
    const result = await createDefect({
      sprintId: "sprint-1",
      teamId: "team-1",
      title: "Login fails",
      severity: "high",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe("def-1");
    expect(mocks.anomalyCreate).not.toHaveBeenCalled();
  });

  it("creates CRITICAL defect with atomic anomaly (AC-001)", async () => {
    const result = await createDefect({
      sprintId: "sprint-1",
      teamId: "team-1",
      title: "Prod down",
      severity: "critical",
    });

    expect(result.ok).toBe(true);
    expect(mocks.anomalyDetectionRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trigger: "defect_lifecycle" }),
      })
    );
    expect(mocks.anomalyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rule: "CRITICAL_DEFECT" }),
      })
    );
  });

  it("sets originSprintId = sprintId on create (AC-003)", async () => {
    await createDefect({
      sprintId: "sprint-3",
      teamId: "team-1",
      title: "Bug",
      severity: "medium",
    });

    expect(mocks.defectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sprintId: "sprint-3",
          originSprintId: "sprint-3",
        }),
      })
    );
  });
  it("rejects a teamId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.teamFindFirst.mockResolvedValue(null);

    const result = await createDefect({
      sprintId: "sprint-1",
      teamId: "team-of-another-tenant",
      title: "Login fails",
      severity: "high",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("TEAM_NOT_FOUND");
    expect(mocks.defectCreate).not.toHaveBeenCalled();
  });

  it("rejects a sprintId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.sprintFindFirst.mockResolvedValue(null);

    const result = await createDefect({
      sprintId: "sprint-of-another-tenant",
      teamId: "team-1",
      title: "Login fails",
      severity: "high",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("SPRINT_NOT_FOUND");
    expect(mocks.defectCreate).not.toHaveBeenCalled();
  });

  it("rejects a storyId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.storyFindFirst.mockResolvedValue(null);

    const result = await createDefect({
      sprintId: "sprint-1",
      teamId: "team-1",
      storyId: "story-of-another-tenant",
      title: "Login fails",
      severity: "high",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("STORY_NOT_FOUND");
    expect(mocks.defectCreate).not.toHaveBeenCalled();
  });
});

// ─── updateDefectSeverity ─────────────────────────────────────────────────────

describe("updateDefectSeverity (AC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.defectUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("allows SM to downgrade severity (AC-002)", async () => {
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-1",
      severity: "critical",
    });

    const result = await updateDefectSeverity({
      defectId: "def-1",
      severity: "high",
    });

    expect(result.ok).toBe(true);
    expect(mocks.defectUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { severity: "high" },
      })
    );
  });

  it("blocks Developer from downgrading severity (AC-002)", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "DEV",
    });
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-1",
      severity: "critical",
    });

    const result = await updateDefectSeverity({
      defectId: "def-1",
      severity: "low",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("INSUFFICIENT_ROLE");
    expect(mocks.defectUpdateMany).not.toHaveBeenCalled();
  });

  it("allows upgrade by any role (AC-002)", async () => {
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "DEV" });
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-1",
      severity: "low",
    });

    const result = await updateDefectSeverity({
      defectId: "def-1",
      severity: "critical",
    });

    expect(result.ok).toBe(true);
  });
});

// ─── reopenDefect ─────────────────────────────────────────────────────────────

describe("reopenDefect (AC-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
    makeTransactionMock();
    mocks.defectUpdateMany.mockResolvedValue({ count: 1 });
    mocks.stateTransitionHistoryCreate.mockResolvedValue({});
  });

  it("reopens CLOSED defect and preserves originSprintId (AC-003)", async () => {
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-1",
      status: "CLOSED",
      originSprintId: "sprint-3",
    });

    const result = await reopenDefect({
      defectId: "def-1",
      reason: "Issue reappeared after deploy",
    });

    expect(result.ok).toBe(true);
    // originSprintId NOT updated on reopen
    expect(mocks.defectUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          originSprintId: expect.anything(),
        }),
      })
    );
    expect(mocks.defectUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "OPEN" }),
      })
    );
    expect(mocks.stateTransitionHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: "CLOSED",
          toStatus: "OPEN",
          entityType: "Defect",
        }),
      })
    );
  });

  it("rejects reopen on non-CLOSED defect (AC-003)", async () => {
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-1",
      status: "OPEN",
      originSprintId: "sprint-3",
    });

    const result = await reopenDefect({
      defectId: "def-1",
      reason: "still broken",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("INVALID_TRANSITION");
  });
});

// ─── checkDefectStaleness ─────────────────────────────────────────────────────

describe("checkDefectStaleness (AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
    makeTransactionMock();
    mocks.defectUpdateMany.mockResolvedValue({ count: 1 });
    mocks.anomalyDetectionRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.anomalyCreate.mockResolvedValue({});
  });

  it("marks HIGH defect stale after 48h and creates anomaly (AC-008)", async () => {
    const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000); // 50h ago
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-2",
      severity: "high",
      status: "OPEN",
      isStale: false,
      createdAt: oldDate,
      teamId: "team-1",
    });

    const result = await checkDefectStaleness({ defectId: "def-2" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isStale).toBe(true);
    expect(mocks.defectUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isStale: true }),
      })
    );
    expect(mocks.anomalyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rule: "STALE_DEFECT" }),
      })
    );
  });

  it("does not flag MEDIUM defect as stale (AC-008)", async () => {
    const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000);
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-3",
      severity: "medium",
      status: "OPEN",
      isStale: false,
      createdAt: oldDate,
      teamId: "team-1",
    });

    const result = await checkDefectStaleness({ defectId: "def-3" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isStale).toBe(false);
    expect(mocks.anomalyCreate).not.toHaveBeenCalled();
  });

  it("skips already-stale defect (AC-008)", async () => {
    mocks.defectFindFirstOrThrow.mockResolvedValue({
      id: "def-4",
      severity: "high",
      status: "OPEN",
      isStale: true,
      createdAt: new Date(Date.now() - 60 * 60 * 60 * 1000),
      teamId: "team-1",
    });

    const result = await checkDefectStaleness({ defectId: "def-4" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isStale).toBe(true);
    expect(mocks.defectUpdateMany).not.toHaveBeenCalled();
  });
});

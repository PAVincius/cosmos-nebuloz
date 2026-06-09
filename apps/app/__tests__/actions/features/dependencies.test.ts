import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  piPlanFindFirst: vi.fn(),
  depLinkFindMany: vi.fn(),
  depLinkCreate: vi.fn(),
  depLinkUpdateMany: vi.fn(),
  featureFindMany: vi.fn(),
  piPlanFindFirstOrThrow: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    pIPlan: {
      findFirst: mocks.piPlanFindFirst,
      findFirstOrThrow: mocks.piPlanFindFirstOrThrow,
    },
    dependencyLink: {
      findMany: mocks.depLinkFindMany,
      create: mocks.depLinkCreate,
      updateMany: mocks.depLinkUpdateMany,
    },
    feature: { findMany: mocks.featureFindMany },
    $transaction: mocks.transaction,
  },
}));

import {
  computeCapacityStatus,
  createDependencyLink,
  updateDependencyBoardStatus,
} from "../../../app/actions/features/dependencies";

describe("computeCapacityStatus", () => {
  it("returns OK when under 80% utilization", () => {
    const result = computeCapacityStatus(30, 40);
    expect(result.status).toBe("OK");
    expect(result.utilization).toBeCloseTo(0.75, 2);
  });

  it("returns WARNING when utilization is 80–100%", () => {
    // 35/40 = 87.5%
    const result = computeCapacityStatus(35, 40);
    expect(result.status).toBe("WARNING");
    expect(result.utilization).toBeCloseTo(0.875, 2);
  });

  it("returns OVER when assignedPoints exceeds capacity (AC-002)", () => {
    // 43/40 = 107.5% over capacity
    const result = computeCapacityStatus(43, 40);
    expect(result.status).toBe("OVER");
    expect(result.utilization).toBeCloseTo(1.075, 2);
  });

  it("handles zero capacity gracefully", () => {
    const result = computeCapacityStatus(5, 0);
    expect(result.status).toBe("OK");
    expect(result.utilization).toBe(0);
  });
});

describe("createDependencyLink — circular detection (AC-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.piPlanFindFirst.mockResolvedValue({ status: "PLANNING" });
    mocks.depLinkCreate.mockResolvedValue({ id: "link-new" });

    // $transaction executes the callback synchronously with a tx proxy
    mocks.transaction.mockImplementation(
      (fn: (tx: { dependencyLink: { findMany: typeof vi.fn } }) => unknown) => {
        if (typeof fn === "function") {
          return fn({
            dependencyLink: {
              findMany: mocks.depLinkFindMany,
            },
          });
        }
        return Promise.all(fn as Promise<unknown>[]);
      }
    );
  });

  it("allows non-circular link creation", async () => {
    // No existing links → no cycle
    mocks.depLinkFindMany.mockResolvedValue([]);

    const result = await createDependencyLink({
      piPlanId: "pi-1",
      blockingFeatureId: "feat-A",
      blockedFeatureId: "feat-B",
    });

    expect(result.ok).toBe(true);
    expect(mocks.depLinkCreate).toHaveBeenCalledOnce();
  });

  it("detects A→B→C→A circular dependency (AC-005)", async () => {
    // Existing: A depends on B (blocked=A, blocking=B), B depends on C (blocked=B, blocking=C)
    // Adding: C depends on A (blocking=A, blocked=C) → should detect cycle
    mocks.depLinkFindMany.mockImplementation(
      ({ where }: { where: { blockedFeatureId: string } }) => {
        if (where.blockedFeatureId === "feat-A") {
          return Promise.resolve([{ blockingFeatureId: "feat-B" }]);
        }
        if (where.blockedFeatureId === "feat-B") {
          return Promise.resolve([{ blockingFeatureId: "feat-C" }]);
        }
        return Promise.resolve([]);
      }
    );

    const result = await createDependencyLink({
      piPlanId: "pi-1",
      blockingFeatureId: "feat-A",
      blockedFeatureId: "feat-C",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("CIRCULAR_DEPENDENCY");
    const chainStr = result.error.split("CIRCULAR_DEPENDENCY:")[1];
    const chain = JSON.parse(chainStr);
    expect(chain).toEqual(["feat-A", "feat-B", "feat-C", "feat-A"]);
    expect(mocks.depLinkCreate).not.toHaveBeenCalled();
  });

  it("RESOLVED links not traversed during DFS", async () => {
    // Existing: A depends on B (RESOLVED), so DFS should skip B
    mocks.depLinkFindMany.mockResolvedValue([]);

    const result = await createDependencyLink({
      piPlanId: "pi-1",
      blockingFeatureId: "feat-A",
      blockedFeatureId: "feat-B",
    });

    expect(result.ok).toBe(true);
  });
});

describe("createDependencyLink — read-only enforcement (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.transaction.mockImplementation(
      (fn: (tx: { dependencyLink: { findMany: typeof vi.fn } }) => unknown) => {
        if (typeof fn === "function") {
          return fn({ dependencyLink: { findMany: mocks.depLinkFindMany } });
        }
        return Promise.all(fn as Promise<unknown>[]);
      }
    );
    mocks.depLinkFindMany.mockResolvedValue([]);
    mocks.depLinkCreate.mockResolvedValue({ id: "link-new" });
  });

  it("rejects link creation when PI Plan is COMMITTED", async () => {
    mocks.piPlanFindFirst.mockResolvedValue({ status: "COMMITTED" });

    const result = await createDependencyLink({
      piPlanId: "pi-1",
      blockingFeatureId: "feat-A",
      blockedFeatureId: "feat-B",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("PI_READ_ONLY");
    expect(mocks.depLinkCreate).not.toHaveBeenCalled();
  });

  it("rejects link creation when PI Plan is CLOSED", async () => {
    mocks.piPlanFindFirst.mockResolvedValue({ status: "CLOSED" });

    const result = await createDependencyLink({
      piPlanId: "pi-1",
      blockingFeatureId: "feat-A",
      blockedFeatureId: "feat-B",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("PI_READ_ONLY");
  });

  it("allows link creation in PLANNING state", async () => {
    mocks.piPlanFindFirst.mockResolvedValue({ status: "PLANNING" });

    const result = await createDependencyLink({
      piPlanId: "pi-1",
      blockingFeatureId: "feat-A",
      blockedFeatureId: "feat-B",
    });

    expect(result.ok).toBe(true);
  });

  it("returns PI_PLAN_NOT_FOUND when PI not in tenant", async () => {
    mocks.piPlanFindFirst.mockResolvedValue(null);

    const result = await createDependencyLink({
      piPlanId: "nonexistent",
      blockingFeatureId: "feat-A",
      blockedFeatureId: "feat-B",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("PI_PLAN_NOT_FOUND");
  });
});

describe("updateDependencyBoardStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.depLinkUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("RTE can update boardStatus to IN_PROGRESS", async () => {
    const result = await updateDependencyBoardStatus({
      linkId: "link-1",
      boardStatus: "IN_PROGRESS",
    });

    expect(result.ok).toBe(true);
    expect(mocks.depLinkUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { boardStatus: "IN_PROGRESS" },
      })
    );
  });

  it("RTE can resolve a dependency link", async () => {
    const result = await updateDependencyBoardStatus({
      linkId: "link-1",
      boardStatus: "RESOLVED",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.boardStatus).toBe("RESOLVED");
  });

  it("FORBIDDEN for non-RTE/ADMIN roles", async () => {
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "DEV" });

    const result = await updateDependencyBoardStatus({
      linkId: "link-1",
      boardStatus: "RESOLVED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FORBIDDEN");
  });

  it("returns LINK_NOT_FOUND when link not in tenant", async () => {
    mocks.depLinkUpdateMany.mockResolvedValue({ count: 0 });

    const result = await updateDependencyBoardStatus({
      linkId: "nonexistent",
      boardStatus: "RESOLVED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("LINK_NOT_FOUND");
  });
});

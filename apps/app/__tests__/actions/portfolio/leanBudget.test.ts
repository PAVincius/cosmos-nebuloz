import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  leanBudgetFindFirst: vi.fn(),
  artFindFirst: vi.fn(),
  piPlanFindFirst: vi.fn(),
  leanBudgetCreate: vi.fn(),
  leanBudgetUpdateMany: vi.fn(),
  leanBudgetFindFirstOrThrow: vi.fn(),
  epicAggregate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    leanBudget: {
      findFirst: mocks.leanBudgetFindFirst,
      findFirstOrThrow: mocks.leanBudgetFindFirstOrThrow,
      create: mocks.leanBudgetCreate,
      updateMany: mocks.leanBudgetUpdateMany,
    },
    aRT: { findFirst: mocks.artFindFirst },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
    epic: { aggregate: mocks.epicAggregate },
  },
}));

import {
  checkOverAllocation,
  lockBudgetOnPIClose,
  saveLeanBudget,
} from "../../../app/actions/portfolio/leanBudget";

// ─── saveLeanBudget ───────────────────────────────────────────────────────────

describe("saveLeanBudget (AC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.leanBudgetFindFirst.mockResolvedValue(null);
    mocks.leanBudgetCreate.mockResolvedValue({ id: "budget-1" });
    mocks.artFindFirst.mockResolvedValue({ id: "art-1" });
    mocks.piPlanFindFirst.mockResolvedValue({ id: "pi-1" });
  });

  it("rejects an artId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.artFindFirst.mockResolvedValue(null);

    const result = await saveLeanBudget({
      artId: "art-of-another-tenant",
      piPlanId: "pi-1",
      name: "PI-2026-Q2 Budget",
      amount: 500_000,
      capexPct: 60,
      opexPct: 40,
      period: "PI-2026-Q2",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ART_NOT_FOUND");
    expect(mocks.leanBudgetCreate).not.toHaveBeenCalled();
  });

  it("rejects a piPlanId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.piPlanFindFirst.mockResolvedValue(null);

    const result = await saveLeanBudget({
      artId: "art-1",
      piPlanId: "pi-of-another-tenant",
      name: "PI-2026-Q2 Budget",
      amount: 500_000,
      capexPct: 60,
      opexPct: 40,
      period: "PI-2026-Q2",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("PI_PLAN_NOT_FOUND");
    expect(mocks.leanBudgetCreate).not.toHaveBeenCalled();
  });

  it("saves valid budget with capex+opex=100 (AC-002)", async () => {
    const result = await saveLeanBudget({
      artId: "art-1",
      piPlanId: "pi-1",
      name: "PI-2026-Q2 Budget",
      amount: 500_000,
      capexPct: 60,
      opexPct: 40,
      period: "PI-2026-Q2",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe("budget-1");
    expect(mocks.leanBudgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ capexPct: 60, opexPct: 40 }),
      })
    );
  });

  it("rejects when capex+opex != 100 (AC-002)", async () => {
    const result = await saveLeanBudget({
      artId: "art-1",
      piPlanId: "pi-1",
      name: "Budget",
      amount: 500_000,
      capexPct: 60,
      opexPct: 50,
      period: "PI-2026-Q2",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("BUDGET_SPLIT_INVALID");
    expect(result.error).toContain("110%");
    expect(mocks.leanBudgetCreate).not.toHaveBeenCalled();
  });

  it("rejects duplicate artId+piPlanId (AC-002)", async () => {
    mocks.leanBudgetFindFirst.mockResolvedValue({ id: "existing-1" });

    const result = await saveLeanBudget({
      artId: "art-1",
      piPlanId: "pi-1",
      name: "Budget",
      amount: 400_000,
      capexPct: 70,
      opexPct: 30,
      period: "PI-2026-Q2",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("DUPLICATE_BUDGET");
  });
});

// ─── checkOverAllocation ──────────────────────────────────────────────────────

describe("checkOverAllocation (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
  });

  it("detects over-allocation (AC-004)", async () => {
    mocks.leanBudgetFindFirstOrThrow.mockResolvedValue({
      id: "budget-1",
      amount: 500_000,
      artId: "art-1",
      piPlanId: "pi-1",
    });
    mocks.epicAggregate.mockResolvedValue({
      _sum: { leanBudgetAllocation: 450_000 },
    });

    const result = await checkOverAllocation({
      leanBudgetId: "budget-1",
      newAllocationAmount: 100_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.overAllocated).toBe(true);
    expect(result.data.excessAmount).toBe(50_000);
  });

  it("returns not over-allocated when within budget (AC-004)", async () => {
    mocks.leanBudgetFindFirstOrThrow.mockResolvedValue({
      id: "budget-1",
      amount: 500_000,
      artId: "art-1",
      piPlanId: "pi-1",
    });
    mocks.epicAggregate.mockResolvedValue({
      _sum: { leanBudgetAllocation: 300_000 },
    });

    const result = await checkOverAllocation({
      leanBudgetId: "budget-1",
      newAllocationAmount: 100_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.overAllocated).toBe(false);
    expect(result.data.excessAmount).toBe(0);
  });
});

// ─── lockBudgetOnPIClose ──────────────────────────────────────────────────────

describe("lockBudgetOnPIClose (AC-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.leanBudgetUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("sets immutableAt on budgets when PI closes (AC-005)", async () => {
    const result = await lockBudgetOnPIClose({ piPlanId: "pi-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.lockedCount).toBe(2);
    expect(mocks.leanBudgetUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ immutableAt: expect.any(Date) }),
      })
    );
  });
});

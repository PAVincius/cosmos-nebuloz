import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  investmentHorizonFindMany: vi.fn(),
  investmentHorizonFindFirst: vi.fn(),
  investmentHorizonCreate: vi.fn(),
  leanBudgetFindMany: vi.fn(),
  aRTFindMany: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    investmentHorizon: {
      findMany: h.investmentHorizonFindMany,
      findFirst: h.investmentHorizonFindFirst,
      create: h.investmentHorizonCreate,
    },
    leanBudget: {
      findMany: h.leanBudgetFindMany,
    },
    aRT: {
      findMany: h.aRTFindMany,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createInvestmentHorizon,
  getInvestmentHorizon,
  listInvestmentHorizons,
} from "../../app/(cosmos)/actions/horizons";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listInvestmentHorizons", () => {
  it("returns tenant-scoped horizons ordered by `order`", async () => {
    h.investmentHorizonFindMany.mockResolvedValue([
      {
        id: "h1",
        name: "Growth",
        label: "Crescimento",
        targetPct: 30,
        order: 0,
      },
    ]);

    const r = await listInvestmentHorizons();

    expect(r.ok).toBe(true);
    expect(database.investmentHorizon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
  });
});

describe("getInvestmentHorizon", () => {
  it("is tenant-scoped and returns not-found for a cross-tenant horizon id", async () => {
    h.investmentHorizonFindFirst.mockResolvedValue(null);

    const res = await getInvestmentHorizon("foreign-horizon");

    expect(res.ok).toBe(false);
    expect(h.investmentHorizonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-horizon", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.leanBudgetFindMany).not.toHaveBeenCalled();
  });

  it("computes actualPct from real LeanBudget rows and lists classified value streams", async () => {
    h.investmentHorizonFindFirst.mockResolvedValue({
      id: "h1",
      name: "Growth",
      label: "Crescimento",
      targetPct: 30,
    });
    // First call: LeanBudget rows classified into this horizon.
    // Second call: every LeanBudget row in the tenant (denominator).
    h.leanBudgetFindMany
      .mockResolvedValueOnce([
        { amount: 30, artId: "art1" },
        { amount: 20, artId: "art1" },
      ])
      .mockResolvedValueOnce([{ amount: 30 }, { amount: 20 }, { amount: 50 }]);
    h.aRTFindMany.mockResolvedValue([{ id: "art1", name: "Payments ART" }]);

    const r = await getInvestmentHorizon("h1");

    expect(h.leanBudgetFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, horizonId: "h1" },
      })
    );
    expect(h.leanBudgetFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 50 classified into this horizon / 100 tenant-wide total = 50%
      expect(r.data.actualPct).toBe(50);
      expect(r.data.valueStreams).toEqual([
        { artId: "art1", artName: "Payments ART", budgetAllocated: 50 },
      ]);
    }
  });

  it("returns a null actualPct (never a fabricated 0) when the tenant has no LeanBudget rows", async () => {
    h.investmentHorizonFindFirst.mockResolvedValue({
      id: "h1",
      name: "Growth",
      label: "Crescimento",
      targetPct: 30,
    });
    h.leanBudgetFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const r = await getInvestmentHorizon("h1");

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.actualPct).toBeNull();
      expect(r.data.valueStreams).toHaveLength(0);
    }
  });
});

describe("createInvestmentHorizon", () => {
  const validInput = {
    name: "Growth",
    label: "Crescimento",
    targetPct: 30,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createInvestmentHorizon(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.investmentHorizonCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success, tenant-scoped", async () => {
    h.investmentHorizonCreate.mockResolvedValue({ id: "new-horizon" });

    const res = await createInvestmentHorizon(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-horizon");
    }
    expect(h.investmentHorizonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          name: validInput.name,
          label: validInput.label,
          targetPct: validInput.targetPct,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "investment_horizon",
        entityId: "new-horizon",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("rejects an invalid targetPct outside 0-100", async () => {
    const res = await createInvestmentHorizon({
      ...validInput,
      targetPct: 150,
    });

    expect(res.ok).toBe(false);
    expect(h.investmentHorizonCreate).not.toHaveBeenCalled();
  });
});

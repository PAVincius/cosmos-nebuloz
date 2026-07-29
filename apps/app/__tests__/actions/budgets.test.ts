import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  leanBudgetFindMany: vi.fn(),
  leanBudgetFindFirst: vi.fn(),
  leanBudgetUpdate: vi.fn(),
  aRTFindMany: vi.fn(),
  aRTFindFirst: vi.fn(),
  governedEpicFindMany: vi.fn(),
  investmentHorizonFindFirst: vi.fn(),
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
    leanBudget: {
      findMany: h.leanBudgetFindMany,
      findFirst: h.leanBudgetFindFirst,
      update: h.leanBudgetUpdate,
    },
    aRT: {
      findMany: h.aRTFindMany,
      findFirst: h.aRTFindFirst,
    },
    governedEpic: {
      findMany: h.governedEpicFindMany,
    },
    investmentHorizon: {
      findFirst: h.investmentHorizonFindFirst,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  getValueStreamDetail,
  listLeanBudgets,
  updateLeanBudgetGuardrails,
} from "../../app/(cosmos)/actions/budgets";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listLeanBudgets", () => {
  it("returns tenant-scoped budgets with computed utilization", async () => {
    h.leanBudgetFindMany.mockResolvedValue([
      {
        id: "b1",
        name: "Payments PI-26",
        amount: 100,
        spent: "62",
        period: "PI-26",
        capexPct: 60,
        opexPct: 40,
        spendLimitUsd: 500,
        approvalThresholdUsd: 300,
        strategicTheme: { title: "Expansão LATAM" },
      },
    ]);

    const r = await listLeanBudgets();
    expect(r.ok).toBe(true);
    expect(database.leanBudget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].themeName).toBe("Expansão LATAM");
      expect(r.data[0].utilizationPct).toBe(62);
      expect(r.data[0].spendLimitUsd).toBe(500);
      expect(r.data[0].approvalThresholdUsd).toBe(300);
    }
  });

  it("resolves the ART (value stream) name tenant-scoped for budgets with an artId", async () => {
    h.leanBudgetFindMany.mockResolvedValue([
      {
        id: "b1",
        name: "Payments PI-26",
        amount: 100,
        spent: "62",
        period: "PI-26",
        capexPct: 60,
        opexPct: 40,
        spendLimitUsd: 500,
        approvalThresholdUsd: 300,
        artId: "art1",
        strategicTheme: { title: "Expansão LATAM" },
      },
    ]);
    h.aRTFindMany.mockResolvedValue([{ id: "art1", name: "Payments ART" }]);

    const r = await listLeanBudgets();

    expect(h.aRTFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["art1"] }, tenantId: tenantCtx.tenantId },
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].artId).toBe("art1");
      expect(r.data[0].artName).toBe("Payments ART");
    }
  });
});

describe("getValueStreamDetail", () => {
  it("rejects an artId that is not owned by the tenant (IDOR guard)", async () => {
    h.aRTFindFirst.mockResolvedValue(null);

    const res = await getValueStreamDetail("foreign-art");

    expect(res.ok).toBe(false);
    expect(h.aRTFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-art", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.leanBudgetFindMany).not.toHaveBeenCalled();
  });

  it("aggregates LeanBudget rows for the ART and derives guardrailPct from spendLimitUsd", async () => {
    h.aRTFindFirst.mockResolvedValue({ id: "art1", name: "Payments ART" });
    h.leanBudgetFindMany.mockResolvedValue([
      { amount: 100, spent: "60", spendLimitUsd: 120 },
      { amount: 50, spent: "20", spendLimitUsd: null },
    ]);
    h.governedEpicFindMany.mockResolvedValue([
      {
        epic: {
          id: "e1",
          title: "Epic A",
          wsjf: 12,
          featureCount: 4,
          doneFeatureCount: 2,
        },
      },
    ]);

    const r = await getValueStreamDetail("art1");

    expect(h.leanBudgetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, artId: "art1" },
      })
    );
    expect(h.governedEpicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, valueStreamId: "art1" },
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.budgetAllocated).toBe(150);
      expect(r.data.spent).toBe(80);
      // Only one of the two LeanBudget rows has a spendLimitUsd — that's the
      // only one summed into the guardrail denominator.
      expect(r.data.spendLimitUsd).toBe(120);
      expect(r.data.guardrailPct).toBe(67); // round(80/120*100)
      expect(r.data.utilizationPct).toBe(53); // round(80/150*100)
      expect(r.data.epics).toHaveLength(1);
      expect(r.data.epics[0].progressPct).toBe(50);
    }
  });

  it("returns a null guardrailPct (never a fabricated 0) when no budget has a spend limit", async () => {
    h.aRTFindFirst.mockResolvedValue({ id: "art1", name: "Payments ART" });
    h.leanBudgetFindMany.mockResolvedValue([
      { amount: 100, spent: "10", spendLimitUsd: null },
    ]);
    h.governedEpicFindMany.mockResolvedValue([]);

    const r = await getValueStreamDetail("art1");

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.spendLimitUsd).toBeNull();
      expect(r.data.guardrailPct).toBeNull();
      expect(r.data.epics).toHaveLength(0);
    }
  });

  it("resolves the horizon tenant-scoped when every LeanBudget row agrees on one", async () => {
    h.aRTFindFirst.mockResolvedValue({ id: "art1", name: "Payments ART" });
    h.leanBudgetFindMany.mockResolvedValue([
      { amount: 100, spent: "10", spendLimitUsd: null, horizonId: "h1" },
      { amount: 50, spent: "5", spendLimitUsd: null, horizonId: "h1" },
    ]);
    h.governedEpicFindMany.mockResolvedValue([]);
    h.investmentHorizonFindFirst.mockResolvedValue({
      id: "h1",
      name: "Growth",
      label: "Crescimento",
    });

    const r = await getValueStreamDetail("art1");

    expect(h.investmentHorizonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "h1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.horizon).toEqual({
        id: "h1",
        name: "Growth",
        label: "Crescimento",
      });
    }
  });

  it("returns a null horizon (no fabricated guess) when the ART's budgets disagree on horizon", async () => {
    h.aRTFindFirst.mockResolvedValue({ id: "art1", name: "Payments ART" });
    h.leanBudgetFindMany.mockResolvedValue([
      { amount: 100, spent: "10", spendLimitUsd: null, horizonId: "h1" },
      { amount: 50, spent: "5", spendLimitUsd: null, horizonId: "h2" },
    ]);
    h.governedEpicFindMany.mockResolvedValue([]);

    const r = await getValueStreamDetail("art1");

    expect(h.investmentHorizonFindFirst).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.horizon).toBeNull();
    }
  });
});

describe("updateLeanBudgetGuardrails", () => {
  const validInput = {
    budgetId: "b1",
    capexPct: 60,
    opexPct: 40,
    spendLimitUsd: 500,
    approvalThresholdUsd: 300,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await updateLeanBudgetGuardrails(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.leanBudgetUpdate).not.toHaveBeenCalled();
  });

  it("rejects when capexPct + opexPct !== 100", async () => {
    const res = await updateLeanBudgetGuardrails({
      ...validInput,
      capexPct: 60,
      opexPct: 30,
    });

    expect(res.ok).toBe(false);
    expect(h.leanBudgetFindFirst).not.toHaveBeenCalled();
    expect(h.leanBudgetUpdate).not.toHaveBeenCalled();
  });

  it("rejects a budgetId that is not owned by the tenant (IDOR guard)", async () => {
    h.leanBudgetFindFirst.mockResolvedValue(null);

    const res = await updateLeanBudgetGuardrails({
      ...validInput,
      budgetId: "foreign-budget",
    });

    expect(res.ok).toBe(false);
    expect(h.leanBudgetFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-budget", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.leanBudgetUpdate).not.toHaveBeenCalled();
  });

  it("updates, audits, and revalidates on success", async () => {
    h.leanBudgetFindFirst.mockResolvedValue({ id: "b1" });
    h.leanBudgetUpdate.mockResolvedValue({ id: "b1" });

    const res = await updateLeanBudgetGuardrails(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("b1");
    }
    expect(h.leanBudgetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
        data: expect.objectContaining({
          capexPct: 60,
          opexPct: 40,
          spendLimitUsd: 500,
          approvalThresholdUsd: 300,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "updated",
        entityType: "lean_budget",
        entityId: "b1",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});

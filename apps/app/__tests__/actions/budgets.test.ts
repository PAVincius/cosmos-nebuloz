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
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
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

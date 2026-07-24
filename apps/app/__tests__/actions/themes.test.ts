import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  strategicThemeFindMany: vi.fn(),
  strategicThemeFindFirst: vi.fn(),
  strategicThemeCreate: vi.fn(),
  strategicThemeUpdate: vi.fn(),
  billingEntryAllocationFindMany: vi.fn(),
  transaction: vi.fn(),
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
    strategicTheme: {
      findMany: h.strategicThemeFindMany,
      findFirst: h.strategicThemeFindFirst,
      create: h.strategicThemeCreate,
      update: h.strategicThemeUpdate,
    },
    billingEntryAllocation: {
      findMany: h.billingEntryAllocationFindMany,
    },
    $transaction: h.transaction,
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createTheme,
  getTheme,
  listThemes,
  rebalanceThemeTargets,
} from "../../app/(cosmos)/actions/themes";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listThemes", () => {
  it("returns tenant-scoped themes with computed epic count and avg progress", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      {
        id: "th1",
        title: "Expansão LATAM",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 25,
        horizon: "PI-26",
        epics: [
          { featureCount: 4, doneFeatureCount: 2 },
          { featureCount: 2, doneFeatureCount: 2 },
        ],
      },
    ]);

    const r = await listThemes();
    expect(r.ok).toBe(true);
    expect(database.strategicTheme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].epicCount).toBe(2);
      expect(r.data[0].avgProgress).toBe(75); // (50 + 100) / 2
    }
  });
});

describe("getTheme", () => {
  const themeRow = {
    id: "th1",
    title: "Expansão LATAM",
    description: null,
    color: "#6366f1",
    healthStatus: "on",
    horizon: "PI-26",
    targetAllocationPct: 30,
    pillar: { id: "pil1", name: "Crescimento" },
    epics: [
      {
        id: "ep1",
        title: "Epic 1",
        statusId: "DOING",
        lifecycleStatus: "IMPLEMENTING",
        wsjf: 12,
        featureCount: 4,
        doneFeatureCount: 2,
      },
    ],
  };

  it("scopes the lookup by id + tenantId (IDOR guard) — must fail if tenantId were dropped from the where clause", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(themeRow);
    h.billingEntryAllocationFindMany.mockResolvedValue([]);

    await getTheme("th1");

    expect(h.strategicThemeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "th1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.billingEntryAllocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, themeId: "th1" },
      })
    );
  });

  it("returns an error when the theme does not belong to this tenant (not found)", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(null);

    const res = await getTheme("other-tenant-theme");

    expect(res.ok).toBe(false);
    expect(h.billingEntryAllocationFindMany).not.toHaveBeenCalled();
  });

  it("computes actualAllocationPct from BillingEntryAllocation, normalized against all themed allocations", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(themeRow);
    h.billingEntryAllocationFindMany
      .mockResolvedValueOnce([
        { percentage: 100, billingEntry: { effectiveCost: 300 } },
      ]) // this theme's allocations
      .mockResolvedValueOnce([
        { percentage: 100, billingEntry: { effectiveCost: 300 } },
        { percentage: 100, billingEntry: { effectiveCost: 700 } },
      ]); // all themed allocations tenant-wide

    const res = await getTheme("th1");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.actualAllocationPct).toBe(30); // 300 / 1000 * 100
      expect(res.data.pillar).toEqual({ id: "pil1", name: "Crescimento" });
      expect(res.data.epics[0].progressPct).toBe(50);
    }
  });

  it("returns null actualAllocationPct (never fabricates a number) when there is no allocation data", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(themeRow);
    h.billingEntryAllocationFindMany.mockResolvedValue([]);

    const res = await getTheme("th1");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.actualAllocationPct).toBeNull();
    }
  });
});

describe("createTheme", () => {
  const validInput = {
    title: "Excelência Operacional",
    description: "Reduzir custo operacional em 15% no ano.",
    budgetTotal: 250_000,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createTheme(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategicThemeCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success", async () => {
    h.strategicThemeCreate.mockResolvedValue({ id: "new-theme" });

    const res = await createTheme(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-theme");
    }
    expect(h.strategicThemeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: validInput.title,
          description: validInput.description,
          budgetTotal: validInput.budgetTotal,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "theme",
        entityId: "new-theme",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("defaults description/budgetTotal to null when omitted", async () => {
    h.strategicThemeCreate.mockResolvedValue({ id: "new-theme-2" });

    await createTheme({ title: "Tema simples" });

    expect(h.strategicThemeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
          budgetTotal: null,
        }),
      })
    );
  });
});

describe("rebalanceThemeTargets", () => {
  const validInput = {
    targets: [
      { themeId: "th1", targetAllocationPct: 60 },
      { themeId: "th2", targetAllocationPct: 40 },
    ],
  };

  beforeEach(() => {
    h.transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
    h.strategicThemeUpdate.mockResolvedValue({});
  });

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await rebalanceThemeTargets(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategicThemeFindMany).not.toHaveBeenCalled();
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("rejects a themeId that does not belong to this tenant, and runs no update", async () => {
    // Only th1 is owned by this tenant — th2 belongs to another tenant.
    h.strategicThemeFindMany.mockResolvedValue([
      { id: "th1", targetAllocationPct: 60 },
    ]);

    const res = await rebalanceThemeTargets(validInput);

    expect(res.ok).toBe(false);
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects when the allocations do not sum to 100", async () => {
    const res = await rebalanceThemeTargets({
      targets: [
        { themeId: "th1", targetAllocationPct: 60 },
        { themeId: "th2", targetAllocationPct: 30 },
      ],
    });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindMany).not.toHaveBeenCalled();
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate themeIds even if the sum is 100", async () => {
    const res = await rebalanceThemeTargets({
      targets: [
        { themeId: "th1", targetAllocationPct: 60 },
        { themeId: "th1", targetAllocationPct: 40 },
      ],
    });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindMany).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("accepts a sum within float tolerance (99.995 ~ 100)", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      { id: "th1", targetAllocationPct: 60 },
      { id: "th2", targetAllocationPct: 40 },
    ]);

    const res = await rebalanceThemeTargets({
      targets: [
        { themeId: "th1", targetAllocationPct: 60.003 },
        { themeId: "th2", targetAllocationPct: 39.995 },
      ],
    });

    expect(res.ok).toBe(true);
  });

  it("updates every theme in a single transaction, audits once, and revalidates on success", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      { id: "th1", targetAllocationPct: 60 },
      { id: "th2", targetAllocationPct: 40 },
    ]);

    const res = await rebalanceThemeTargets(validInput);

    expect(res.ok).toBe(true);
    expect(h.strategicThemeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["th1", "th2"] },
          tenantId: tenantCtx.tenantId,
        },
      })
    );
    expect(h.strategicThemeUpdate).toHaveBeenCalledTimes(2);
    expect(h.strategicThemeUpdate).toHaveBeenCalledWith({
      where: { id: "th1" },
      data: { targetAllocationPct: 60 },
    });
    expect(h.strategicThemeUpdate).toHaveBeenCalledWith({
      where: { id: "th2" },
      data: { targetAllocationPct: 40 },
    });
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.transaction.mock.calls[0][0]).toHaveLength(2);
    expect(h.logAudit).toHaveBeenCalledTimes(2);
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "updated",
        entityType: "theme",
        entityId: "th1",
        diff: { from: "60", to: "60" },
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "updated",
        entityType: "theme",
        entityId: "th2",
        diff: { from: "40", to: "40" },
      })
    );
    expect(h.revalidateTag).toHaveBeenCalledTimes(1);
  });
});

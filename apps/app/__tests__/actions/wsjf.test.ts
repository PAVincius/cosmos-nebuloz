import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  epicFindMany: vi.fn(),
  epicUpdateMany: vi.fn(),
  featureFindMany: vi.fn(),
  featureFindFirst: vi.fn(),
  featureUpdate: vi.fn(),
  transaction: vi.fn(),
  wsjfSettingsFindUnique: vi.fn(),
  wsjfSettingsUpsert: vi.fn(),
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
    epic: { findMany: h.epicFindMany, updateMany: h.epicUpdateMany },
    feature: {
      findMany: h.featureFindMany,
      findFirst: h.featureFindFirst,
      update: h.featureUpdate,
    },
    wsjfSettings: {
      findUnique: h.wsjfSettingsFindUnique,
      upsert: h.wsjfSettingsUpsert,
    },
    $transaction: h.transaction,
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  applyWsjfRebalance,
  getFeatureWsjfComponents,
  getWsjfRebalancePreview,
  getWsjfSettings,
  listWsjfItems,
  upsertWsjfSettings,
} from "../../app/(cosmos)/actions/wsjf";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.epicFindMany.mockResolvedValue([
    { id: "e1", title: "Epic A", artId: "pay", wsjf: 10, sizePoints: 5 },
  ]);
  h.featureFindMany.mockResolvedValue([
    {
      id: "f1",
      title: "Feature B",
      artScopedId: "plat",
      wsjfScore: 15,
      storyPoints: 3,
      bv: 8,
      tc: 5,
      rr: 3,
    },
  ]);
});

describe("listWsjfItems", () => {
  it("merges epics and features, sorted by wsjf desc, tenant-scoped", async () => {
    const r = await listWsjfItems();
    expect(r.ok).toBe(true);
    expect(database.epic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    expect(database.feature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    if (r.ok) {
      expect(r.data[0].id).toBe("f1"); // wsjf 15 > 10, ranked first
      expect(r.data[0].rank).toBe(1);
      expect(r.data[1].id).toBe("e1");
      expect(r.data[1].rank).toBe(2);
    }
  });

  it("does not fabricate a previous-rank/AI-suggestion field (no fake Δ IA)", async () => {
    const r = await listWsjfItems();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0]).not.toHaveProperty("prev");
      expect(r.data[0]).not.toHaveProperty("ai");
    }
  });

  it("returns real bv/tc/rr/cod for Feature rows (CoD = bv+tc+rr)", async () => {
    const r = await listWsjfItems();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const feature = r.data.find((i) => i.id === "f1");
      expect(feature).toMatchObject({ bv: 8, tc: 5, rr: 3, cod: 16 });
    }
  });

  it("never fabricates bv/tc/rr/cod for Epic rows — null, not a made-up number", async () => {
    const r = await listWsjfItems();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const epic = r.data.find((i) => i.id === "e1");
      expect(epic).toMatchObject({
        bv: null,
        tc: null,
        rr: null,
        cod: null,
      });
    }
  });
});

describe("getWsjfSettings", () => {
  it("returns the 1.0 defaults when no row exists (never null)", async () => {
    h.wsjfSettingsFindUnique.mockResolvedValue(null);

    const r = await getWsjfSettings();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({
        weightBv: 1,
        weightTc: 1,
        weightRr: 1,
        scale: "fibonacci",
        autoRecalc: "daily",
        rebalanceApprover: "rte",
        staleDays: 14,
      });
    }
  });

  it("returns the stored row when it exists", async () => {
    h.wsjfSettingsFindUnique.mockResolvedValue({
      id: "ws1",
      tenantId: tenantCtx.tenantId,
      weightBv: 1.5,
      weightTc: 1,
      weightRr: 0.5,
      scale: "linear",
      autoRecalc: "weekly",
      rebalanceApprover: "lpm",
      staleDays: 7,
    });

    const r = await getWsjfSettings();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.weightBv).toBe(1.5);
      expect(r.data.scale).toBe("linear");
      expect(r.data.staleDays).toBe(7);
    }
  });
});

describe("upsertWsjfSettings", () => {
  const validInput = {
    weightBv: 1.5,
    weightTc: 1,
    weightRr: 0.5,
    scale: "linear" as const,
    autoRecalc: "weekly" as const,
    rebalanceApprover: "lpm" as const,
    staleDays: 7,
  };

  it("is denied when the role is not ADMIN", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await upsertWsjfSettings(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN"], tenantCtx);
    expect(h.wsjfSettingsUpsert).not.toHaveBeenCalled();
  });

  it("upserts tenant-scoped: both where and create carry ctx.tenantId", async () => {
    h.wsjfSettingsUpsert.mockResolvedValue({
      id: "ws1",
      tenantId: tenantCtx.tenantId,
      ...validInput,
    });

    const res = await upsertWsjfSettings(validInput);

    expect(res.ok).toBe(true);
    expect(h.wsjfSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
        create: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          ...validInput,
        }),
        update: expect.objectContaining(validInput),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "updated",
        entityType: "wsjf_settings",
        entityId: "ws1",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("rejects an out-of-range weight (3.0)", async () => {
    const res = await upsertWsjfSettings({ ...validInput, weightBv: 3.0 });

    expect(res.ok).toBe(false);
    expect(h.wsjfSettingsUpsert).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range staleDays (60)", async () => {
    const res = await upsertWsjfSettings({ ...validInput, staleDays: 60 });

    expect(res.ok).toBe(false);
    expect(h.wsjfSettingsUpsert).not.toHaveBeenCalled();
  });
});

// ─── getFeatureWsjfComponents (Task 18: ScenarioSimulatorModal) ───────────────

describe("getFeatureWsjfComponents", () => {
  it("returns the feature's real bv/tc/rr/js/wsjfScore, tenant-scoped", async () => {
    h.featureFindFirst.mockResolvedValue({
      id: "f1",
      title: "Feature B",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5,
      wsjfScore: 3.2,
    });

    const res = await getFeatureWsjfComponents("f1");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({
        id: "f1",
        title: "Feature B",
        bv: 8,
        tc: 5,
        rr: 3,
        js: 5,
        wsjfScore: 3.2,
      });
    }
    expect(h.featureFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1", tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("is tenant-scoped: a feature from another tenant is not found and errors (IDOR guard)", async () => {
    // Prisma's findFirst with a tenantId filter simply returns null when the
    // row belongs to a different tenant — it never leaks cross-tenant rows.
    h.featureFindFirst.mockResolvedValue(null);

    const res = await getFeatureWsjfComponents("f-other-tenant");

    expect(res.ok).toBe(false);
    expect(h.featureFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f-other-tenant", tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("performs NO write: never calls update, $transaction, or logAudit", async () => {
    h.featureFindFirst.mockResolvedValue({
      id: "f1",
      title: "Feature B",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5,
      wsjfScore: 3.2,
    });

    await getFeatureWsjfComponents("f1");

    expect(h.featureUpdate).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.revalidateTag).not.toHaveBeenCalled();
  });
});

// ─── WSJF rebalance (Task 19: real Epic-only, per-column rank deltas) ─────────

describe("getWsjfRebalancePreview", () => {
  it("computes pending moves per lifecycle column, tenant-scoped, read-only", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 10,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 20,
      },
    ]);

    const res = await getWsjfRebalancePreview();

    expect(res.ok).toBe(true);
    expect(h.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
        // H1: reads lifecycleOrder, not the legacy statusId-scoped `order`.
        select: expect.objectContaining({ lifecycleOrder: true }),
      })
    );
    if (res.ok) {
      expect(res.data.moves).toHaveLength(2);
      expect(res.data.skippedUnscored).toBe(0);
      const e2Move = res.data.moves.find((m) => m.id === "e2");
      expect(e2Move).toMatchObject({ fromRank: 2, toRank: 1, toOrder: 0 });
    }
    expect(h.epicUpdateMany).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("returns no moves when the ranking already matches the stored order", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 20,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 10,
      },
    ]);

    const res = await getWsjfRebalancePreview();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.moves).toHaveLength(0);
    }
  });

  // ─── H2 regression: unscored epics must never be ranked by cuid ─────────

  it("produces zero moves for a column where every epic is unscored, and reports the skip count", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: null,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: null,
      },
      {
        id: "e3",
        title: "Epic C",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 2,
        wsjf: null,
      },
    ]);

    const res = await getWsjfRebalancePreview();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.moves).toHaveLength(0);
      expect(res.data.skippedUnscored).toBe(3);
    }
  });

  it("reorders only the scored epics in a mixed column and leaves unscored epics untouched", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "unscored-1",
        title: "Unscored 1",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: null,
      },
      {
        id: "low",
        title: "Low WSJF",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 5,
      },
      {
        id: "high",
        title: "High WSJF",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 2,
        wsjf: 50,
      },
    ]);

    const res = await getWsjfRebalancePreview();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.skippedUnscored).toBe(1);
      expect(res.data.moves.find((m) => m.id === "unscored-1")).toBeUndefined();
      expect(res.data.moves.find((m) => m.id === "high")).toMatchObject({
        toOrder: 1,
      });
      expect(res.data.moves.find((m) => m.id === "low")).toMatchObject({
        toOrder: 2,
      });
    }
  });
});

describe("applyWsjfRebalance", () => {
  beforeEach(() => {
    h.transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
    h.epicUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await applyWsjfRebalance();

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO"],
      tenantCtx
    );
    expect(h.epicFindMany).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("is a no-op when the ranking already matches order — no writes, no transaction, no audit", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 20,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 10,
      },
    ]);

    const res = await applyWsjfRebalance();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.moved).toBe(0);
    }
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.epicUpdateMany).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.revalidateTag).not.toHaveBeenCalled();
  });

  it("writes one tenant-scoped updateMany per moved epic inside a single transaction", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 10,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 20,
      },
    ]);

    const res = await applyWsjfRebalance();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.moved).toBe(2);
    }
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.transaction.mock.calls[0][0]).toHaveLength(2);
    expect(h.epicUpdateMany).toHaveBeenCalledWith({
      where: { id: "e2", tenantId: tenantCtx.tenantId },
      data: { lifecycleOrder: 0 },
    });
    expect(h.epicUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", tenantId: tenantCtx.tenantId },
      data: { lifecycleOrder: 1 },
    });
  });

  // H1 regression: `order` (statusId-scoped) and `lifecycleOrder`
  // (lifecycleStatus-scoped) are separate columns precisely so a bulk
  // rebalance write can never collide with the legacy statusId-scoped
  // readers (app/actions/wsjf/index.ts's getEpicsWithFeatureWSJF,
  // app/actions/strategic-themes/index.ts's getAllEpics, and
  // app/actions/epics/{create-epic,update-status,get-portfolio}.ts, all of
  // which order by [statusId, order]). This asserts the write payload never
  // touches `order` or `statusId` — the only field it writes is
  // lifecycleOrder — so those readers stay coherent after every apply.
  it("only ever writes lifecycleOrder — never touches the legacy order/statusId columns the other readers depend on", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 10,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 20,
      },
    ]);

    await applyWsjfRebalance();

    expect(h.epicUpdateMany).toHaveBeenCalledTimes(2);
    for (const call of h.epicUpdateMany.mock.calls) {
      const data = call[0].data as Record<string, unknown>;
      expect(Object.keys(data)).toEqual(["lifecycleOrder"]);
      expect(data).not.toHaveProperty("order");
      expect(data).not.toHaveProperty("statusId");
    }
  });

  it("audits and revalidates the portfolio epics cache tag on success", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 10,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 20,
      },
    ]);

    await applyWsjfRebalance();

    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({ action: "status_changed", entityType: "epic" })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  // F4 regression: a bulk rebalance must leave one discoverable audit row
  // per moved epic — a single synthetic "wsjf-rebalance" entityId makes
  // getAuditLogsByEntity (exact-equality lookup) find nothing for any real
  // epic id.
  it("writes one audit row per moved epic, each keyed by that epic's own id", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 10,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 20,
      },
    ]);

    await applyWsjfRebalance();

    expect(h.logAudit).toHaveBeenCalledTimes(2);
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "epic",
        entityId: "e1",
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "epic",
        entityId: "e2",
      })
    );
    for (const call of h.logAudit.mock.calls) {
      expect(call[1].entityId).not.toBe("wsjf-rebalance");
    }
  });

  it("never writes an epic outside the caller's tenant (IDOR guard: tenant-scoped read + tenant-scoped write)", async () => {
    h.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic A",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 0,
        wsjf: 10,
      },
      {
        id: "e2",
        title: "Epic B",
        lifecycleStatus: "FUNNEL",
        lifecycleOrder: 1,
        wsjf: 20,
      },
    ]);

    await applyWsjfRebalance();

    expect(h.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    for (const call of h.epicUpdateMany.mock.calls) {
      expect(call[0].where.tenantId).toBe(tenantCtx.tenantId);
    }
  });
});

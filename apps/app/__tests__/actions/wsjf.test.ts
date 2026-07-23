import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  epicFindMany: vi.fn(),
  featureFindMany: vi.fn(),
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
    epic: { findMany: h.epicFindMany },
    feature: { findMany: h.featureFindMany },
    wsjfSettings: {
      findUnique: h.wsjfSettingsFindUnique,
      upsert: h.wsjfSettingsUpsert,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
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

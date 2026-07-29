import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const dbMocks = vi.hoisted(() => ({
  artFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    aRT: { findMany: dbMocks.artFindMany },
  },
}));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
  requireRole: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: authMocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

const wsjfMocks = vi.hoisted(() => ({
  getWsjfSettings: vi.fn(),
  upsertWsjfSettings: vi.fn(),
}));

vi.mock("../../app/actions/settings/wsjf-settings", () => ({
  getWsjfSettings: wsjfMocks.getWsjfSettings,
  upsertWsjfSettings: wsjfMocks.upsertWsjfSettings,
}));

vi.mock("../../app/actions/arts/lifecycle", () => ({
  updateARTCadence: vi.fn(),
}));

import {
  getSafeConfigTab,
  saveWsjfSettingsAction,
} from "../../app/(cosmos)/actions/settings-safe";

describe("getSafeConfigTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(tenantCtx);
    wsjfMocks.getWsjfSettings.mockResolvedValue(null);
    dbMocks.artFindMany.mockResolvedValue([]);
  });

  it("scopes the ART cadence read to the caller's tenant", async () => {
    const res = await getSafeConfigTab();

    expect(res.ok).toBe(true);
    expect(dbMocks.artFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("surfaces the current role so the UI can gate edit controls", async () => {
    const res = await getSafeConfigTab();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.currentUserRole).toBe(tenantCtx.role);
    }
  });
});

describe("saveWsjfSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("returns a Result error when the underlying ADMIN gate rejects", async () => {
    wsjfMocks.upsertWsjfSettings.mockRejectedValue(
      new Error("Role PO not permitted")
    );

    const res = await saveWsjfSettingsAction({ weightBv: 1 });

    expect(res.ok).toBe(false);
  });

  it("returns ok on a successful save", async () => {
    wsjfMocks.upsertWsjfSettings.mockResolvedValue(undefined);

    const res = await saveWsjfSettingsAction({ weightBv: 1 });

    expect(res.ok).toBe(true);
  });
});

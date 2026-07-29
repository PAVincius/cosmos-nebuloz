import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    wsjfSettings: {
      findUnique: dbMocks.findUnique,
      upsert: dbMocks.upsert,
    },
  },
}));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
  requireRole: authMocks.requireRole,
}));

vi.mock("next/headers", () => ({ headers: authMocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getWsjfSettings,
  upsertWsjfSettings,
} from "../../../app/actions/settings/wsjf-settings";

const VALID_INPUT = {
  weightBv: 2,
  weightTc: 1,
  weightRr: 1.5,
  scale: "fibonacci",
  autoRecalc: "daily",
  rebalanceApprover: "rte",
  staleDays: 21,
};

describe("getWsjfSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("scopes the read to the caller's tenant", async () => {
    dbMocks.findUnique.mockResolvedValue(null);

    await getWsjfSettings();

    expect(dbMocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantCtx.tenantId } })
    );
  });

  it("returns null when no settings row exists (defaults apply elsewhere)", async () => {
    dbMocks.findUnique.mockResolvedValue(null);
    const result = await getWsjfSettings();
    expect(result).toBeNull();
  });
});

describe("upsertWsjfSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
  });

  it("rejects non-ADMIN roles (RBAC)", async () => {
    authMocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "PO",
    });
    authMocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Role PO not permitted");
    });

    await expect(upsertWsjfSettings(VALID_INPUT)).rejects.toThrow(
      "Role PO not permitted"
    );
    expect(dbMocks.upsert).not.toHaveBeenCalled();
  });

  it("scopes the write to the caller's tenant when ADMIN", async () => {
    authMocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "ADMIN",
    });
    authMocks.requireRole.mockReturnValue(undefined);
    dbMocks.upsert.mockResolvedValue({});

    await upsertWsjfSettings(VALID_INPUT);

    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
        create: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          weightBv: 2,
        }),
        update: expect.objectContaining({ weightBv: 2 }),
      })
    );
  });

  it("rejects an out-of-range weight (validation)", async () => {
    authMocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "ADMIN",
    });
    authMocks.requireRole.mockReturnValue(undefined);

    await expect(
      upsertWsjfSettings({ ...VALID_INPUT, weightBv: 999 })
    ).rejects.toThrow();
    expect(dbMocks.upsert).not.toHaveBeenCalled();
  });
});

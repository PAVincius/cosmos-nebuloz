import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  tenantFindUnique: vi.fn(),
  tenantUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    tenantMember: { findFirst: mocks.tenantMemberFindFirst },
    tenant: {
      findUnique: mocks.tenantFindUnique,
      update: mocks.tenantUpdate,
    },
  },
}));

import {
  getMyProfile,
  getNotificationPreferences,
  updateNotificationPreferences,
  updateProfile,
} from "../../app/actions/users/profile";

const USER = {
  id: tenantCtx.userId,
  name: "Test User",
  email: "test@x.com",
  image: null,
  createdAt: new Date(),
};
const MEMBER = { id: "m1", role: "PO", createdAt: new Date() };
const TENANT = { id: tenantCtx.tenantId, name: "Acme", plan: "GALAXY" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.userFindUnique.mockResolvedValue(USER);
  mocks.tenantMemberFindFirst.mockResolvedValue(MEMBER);
  mocks.tenantFindUnique.mockResolvedValue({ ...TENANT, metadata: null });
  mocks.userUpdate.mockResolvedValue(USER);
  mocks.tenantUpdate.mockResolvedValue({});
});

describe("getMyProfile", () => {
  it("returns user, member and tenant", async () => {
    mocks.tenantFindUnique.mockResolvedValueOnce(TENANT);
    const result = await getMyProfile();
    expect(result.user).toMatchObject({ id: tenantCtx.userId });
    expect(result.member).toMatchObject({ role: "PO" });
    expect(result.tenant).toMatchObject({ name: "Acme" });
  });

  it("throws when user or member not found", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    await expect(getMyProfile()).rejects.toThrow(/não encontrado/i);
  });
});

describe("updateProfile", () => {
  it("updates name trimmed", async () => {
    await updateProfile({ name: "  Alice  " });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: tenantCtx.userId },
      data: { name: "Alice" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("sets image to null when empty string", async () => {
    await updateProfile({ image: "" });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: tenantCtx.userId },
      data: { image: null },
    });
  });

  it("skips undefined fields", async () => {
    await updateProfile({});
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: tenantCtx.userId },
      data: {},
    });
  });
});

describe("updateNotificationPreferences", () => {
  it("stores prefs under per-user key in tenant metadata", async () => {
    const prefs = { risk_alerts: true, weekly_digest: false };
    await updateNotificationPreferences(prefs);
    const call = mocks.tenantUpdate.mock.calls[0][0];
    const key = `notif_prefs_${tenantCtx.userId}`;
    expect(call.data.metadata[key]).toEqual(prefs);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("merges a partial update, preserving sibling prefs (no silent wipe)", async () => {
    const key = `notif_prefs_${tenantCtx.userId}`;
    // The user already had team_changes=true; the toggle sends only weekly_digest.
    mocks.tenantFindUnique.mockResolvedValue({
      metadata: { [key]: { team_changes: true } },
    });
    await updateNotificationPreferences({ weekly_digest: false });
    const call = mocks.tenantUpdate.mock.calls[0][0];
    // Without the merge, team_changes would be wiped by the overwrite.
    expect(call.data.metadata[key]).toEqual({
      team_changes: true,
      weekly_digest: false,
    });
  });
});

describe("getNotificationPreferences", () => {
  it("returns defaults when no metadata", async () => {
    const result = await getNotificationPreferences();
    expect(result).toMatchObject({
      pi_planning: true,
      risk_alerts: true,
      weekly_digest: true,
      team_changes: false,
    });
  });

  it("returns stored prefs from metadata", async () => {
    const key = `notif_prefs_${tenantCtx.userId}`;
    mocks.tenantFindUnique.mockResolvedValue({
      metadata: { [key]: { risk_alerts: false, weekly_digest: false } },
    });
    const result = await getNotificationPreferences();
    expect(result.risk_alerts).toBe(false);
    expect(result.weekly_digest).toBe(false);
  });
});

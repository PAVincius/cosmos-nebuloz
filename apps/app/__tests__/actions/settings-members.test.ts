import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
}));
vi.mock("next/headers", () => ({ headers: authMocks.headers }));

const matureMocks = vi.hoisted(() => ({
  getTenantMembersForSearch: vi.fn(),
  inviteMember: vi.fn(),
  updateMemberRoleSafe: vi.fn(),
  removeMemberSafe: vi.fn(),
}));
vi.mock("../../app/actions/teams/members", () => ({
  getTenantMembersForSearch: matureMocks.getTenantMembersForSearch,
}));
vi.mock("../../app/actions/settings/workspace", () => ({
  inviteMember: matureMocks.inviteMember,
}));
vi.mock("../../app/actions/settings/admin-settings", () => ({
  updateMemberRoleSafe: matureMocks.updateMemberRoleSafe,
  removeMemberSafe: matureMocks.removeMemberSafe,
}));

import {
  getMembersTab,
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "../../app/(cosmos)/actions/settings-members";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue(tenantCtx);
});

describe("getMembersTab", () => {
  it("returns the real member list plus the caller's role/id for UI gating", async () => {
    matureMocks.getTenantMembersForSearch.mockResolvedValue([
      {
        id: "mem-1",
        userId: "u1",
        name: "Marina Alves",
        email: "marina@cosmos.local",
        image: null,
        role: "ADMIN",
        source: "current_tenant",
      },
    ]);

    const r = await getMembersTab();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.members[0].name).toBe("Marina Alves");
      expect(r.data.currentUserRole).toBe(tenantCtx.role);
      expect(r.data.currentUserId).toBe(tenantCtx.userId);
    }
  });

  it("passes through the real TenantMember.id (membership id) — the UI must send this, not userId, to updateMemberRoleAction/removeMemberAction", async () => {
    matureMocks.getTenantMembersForSearch.mockResolvedValue([
      {
        id: "mem-1",
        userId: "u1",
        name: "Marina Alves",
        email: "marina@cosmos.local",
        image: null,
        role: "ADMIN",
        source: "current_tenant",
      },
    ]);

    const r = await getMembersTab();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.members[0].id).toBe("mem-1");
      expect(r.data.members[0].id).not.toBe(r.data.members[0].userId);
    }
  });
});

describe("inviteMemberAction", () => {
  it("delegates to the ADMIN-gated workspace.ts::inviteMember", async () => {
    matureMocks.inviteMember.mockResolvedValue(undefined);

    const r = await inviteMemberAction({
      email: "new@cosmos.local",
      role: "MEMBER",
    });

    expect(matureMocks.inviteMember).toHaveBeenCalledWith(
      "new@cosmos.local",
      "MEMBER"
    );
    expect(r.ok).toBe(true);
  });

  it("returns a Result error (not a throw) when the RBAC gate rejects", async () => {
    matureMocks.inviteMember.mockRejectedValue(
      new Error("Role MEMBER not permitted. Required: ADMIN")
    );

    const r = await inviteMemberAction({
      email: "new@cosmos.local",
      role: "MEMBER",
    });

    expect(r.ok).toBe(false);
  });

  it("rejects an invalid role before ever calling the mature action", async () => {
    const r = await inviteMemberAction({
      email: "new@cosmos.local",
      role: "NOT_A_ROLE",
    });

    expect(r.ok).toBe(false);
    expect(matureMocks.inviteMember).not.toHaveBeenCalled();
  });
});

describe("updateMemberRoleAction", () => {
  it("returns ok on success", async () => {
    matureMocks.updateMemberRoleSafe.mockResolvedValue({ ok: true });

    const r = await updateMemberRoleAction("m1", "PO");

    expect(r.ok).toBe(true);
  });

  it("adapts a LAST_ADMIN_BLOCKED rejection into a Result error", async () => {
    matureMocks.updateMemberRoleSafe.mockResolvedValue({
      ok: false,
      code: "LAST_ADMIN_BLOCKED",
      message: "Cannot remove the last admin",
    });

    const r = await updateMemberRoleAction("m1", "MEMBER");

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/last admin/);
    }
  });
});

describe("removeMemberAction", () => {
  it("returns ok on success", async () => {
    matureMocks.removeMemberSafe.mockResolvedValue({ ok: true });

    const r = await removeMemberAction("m1");

    expect(r.ok).toBe(true);
  });

  it("adapts a SELF_REMOVE rejection into a Result error", async () => {
    matureMocks.removeMemberSafe.mockResolvedValue({
      ok: false,
      code: "SELF_REMOVE",
      message: "Cannot remove yourself",
    });

    const r = await removeMemberAction("m1");

    expect(r.ok).toBe(false);
  });
});

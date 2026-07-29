import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  renderInviteEmail: vi.fn().mockResolvedValue("<html>invite</html>"),
  resendSend: vi.fn().mockResolvedValue({ id: "email-1" }),
  tenantMemberFindMany: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  tenantInvitationFindFirst: vi.fn(),
  tenantInvitationCreate: vi.fn(),
  tenantFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/email", () => ({
  renderInviteEmail: mocks.renderInviteEmail,
  resend: { emails: { send: mocks.resendSend } },
}));
vi.mock("@repo/database", () => ({
  database: {
    tenantMember: {
      findMany: mocks.tenantMemberFindMany,
      findFirst: mocks.tenantMemberFindFirst,
    },
    user: { findMany: mocks.userFindMany },
    tenantInvitation: {
      findFirst: mocks.tenantInvitationFindFirst,
      create: mocks.tenantInvitationCreate,
    },
    tenant: { findFirst: mocks.tenantFindFirst },
  },
}));

import {
  getTenantMembersForSearch,
  searchMembersWithCrossTenant,
  sendMemberInvite,
} from "../../app/actions/teams/members";

const MEMBERS_DB = [
  {
    id: "mem-1",
    role: "PO",
    user: { id: "u1", name: "Alice", email: "alice@x.com", image: null },
  },
  {
    id: "mem-2",
    role: "DEV",
    user: { id: "u2", name: null, email: "bob@x.com", image: "http://img" },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.tenantMemberFindMany.mockResolvedValue(MEMBERS_DB);
  mocks.userFindMany.mockResolvedValue([]);
  mocks.tenantMemberFindFirst.mockResolvedValue(null);
  mocks.tenantInvitationFindFirst.mockResolvedValue(null);
  mocks.tenantInvitationCreate.mockResolvedValue({ id: "inv-1" });
  mocks.tenantFindFirst.mockResolvedValue({ name: "Acme" });
});

// ─── getTenantMembersForSearch ────────────────────────────────────────────────

describe("getTenantMembersForSearch", () => {
  it("returns mapped members with source:current_tenant", async () => {
    const result = await getTenantMembersForSearch();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      userId: "u1",
      name: "Alice",
      role: "PO",
      source: "current_tenant",
    });
  });

  it("uses email as name fallback when name is null", async () => {
    const result = await getTenantMembersForSearch();
    expect(result[1].name).toBe("bob@x.com");
  });

  it("queries with tenantId scope", async () => {
    await getTenantMembersForSearch();
    expect(mocks.tenantMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("returns the TenantMember row id (membership id), distinct from the User id — RBAC actions (updateMemberRoleSafe/removeMemberSafe) look up by this id, not userId", async () => {
    const result = await getTenantMembersForSearch();
    expect(result[0].id).toBe("mem-1");
    expect(result[0].userId).toBe("u1");
    expect(result[0].id).not.toBe(result[0].userId);
  });
});

// ─── searchMembersWithCrossTenant ─────────────────────────────────────────────

describe("searchMembersWithCrossTenant", () => {
  it("returns all current members when query is empty", async () => {
    const result = await searchMembersWithCrossTenant("");
    expect(result.currentTenant).toHaveLength(2);
    expect(result.otherTenants).toHaveLength(0);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it("fuzzy-searches current members by name", async () => {
    const result = await searchMembersWithCrossTenant("Ali");
    expect(result.currentTenant.some((m) => m.name === "Alice")).toBe(true);
  });

  it("returns cross-tenant users not in current tenant", async () => {
    mocks.userFindMany.mockResolvedValue([
      {
        id: "ext-1",
        name: "Carlos",
        email: "carlos@other.com",
        image: null,
        memberships: [{ tenant: { id: "other-tenant", name: "Other Corp" } }],
      },
    ]);
    const result = await searchMembersWithCrossTenant("Carlos");
    expect(result.otherTenants).toHaveLength(1);
    expect(result.otherTenants[0]).toMatchObject({
      userId: "ext-1",
      tenantName: "Other Corp",
      source: "other_tenant",
    });
  });

  it("excludes cross-tenant users already in current tenant", async () => {
    mocks.userFindMany.mockResolvedValue([
      {
        id: "u1",
        name: "Alice",
        email: "alice@x.com",
        image: null,
        memberships: [{ tenant: { id: "other", name: "Other" } }],
      },
    ]);
    const result = await searchMembersWithCrossTenant("Alice");
    expect(result.otherTenants).toHaveLength(0);
  });
});

// ─── sendMemberInvite ─────────────────────────────────────────────────────────

describe("sendMemberInvite", () => {
  it("creates invitation and sends email, returns success:true", async () => {
    const result = await sendMemberInvite({ email: "new@x.com", name: "New" });
    expect(result).toEqual({ success: true });
    expect(mocks.tenantInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@x.com",
          role: "MEMBER",
          status: "PENDING",
          tenantId: tenantCtx.tenantId,
        }),
      })
    );
    expect(mocks.resendSend).toHaveBeenCalled();
  });

  it("throws when user is already a member", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue({ id: "m1" });
    await expect(sendMemberInvite({ email: "existing@x.com" })).rejects.toThrow(
      /já é membro/i
    );
  });

  it("throws when pending invitation already exists", async () => {
    mocks.tenantInvitationFindFirst.mockResolvedValue({ id: "inv-existing" });
    await expect(sendMemberInvite({ email: "pending@x.com" })).rejects.toThrow(
      /convite já enviado/i
    );
  });

  it("returns success even when email send fails", async () => {
    mocks.resendSend.mockRejectedValue(new Error("SMTP down"));
    const result = await sendMemberInvite({ email: "new@x.com" });
    expect(result).toEqual({ success: true });
  });
});

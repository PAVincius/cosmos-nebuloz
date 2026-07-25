import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  memberFindFirst: vi.fn(),
  memberCount: vi.fn(),
  memberDelete: vi.fn(),
  memberUpdate: vi.fn(),
  memberFindMany: vi.fn(),
  invitationCreate: vi.fn(),
  auditLogCreate: vi.fn(),
  securityPolicyUpsert: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenantMember: {
      findFirst: dbMocks.memberFindFirst,
      count: dbMocks.memberCount,
      delete: dbMocks.memberDelete,
      update: dbMocks.memberUpdate,
      findMany: dbMocks.memberFindMany,
    },
    tenantInvitation: { create: dbMocks.invitationCreate },
    auditLog: { create: dbMocks.auditLogCreate },
    tenantSecurityPolicy: { upsert: dbMocks.securityPolicyUpsert },
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

vi.mock("next/headers", () => ({
  headers: authMocks.headers,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

import {
  bulkInviteMembers,
  removeMemberSafe,
  updateMemberRoleSafe,
} from "../../../app/actions/settings/admin-settings";
import { checkIpAllowlist } from "../../../lib/security/ip-allowlist";

const ADMIN_CTX = {
  userId: "admin-1",
  tenantId: "tenant-1",
  role: "ADMIN" as const,
  user: { id: "admin-1", email: "admin@org.com" },
};

describe("removeMemberSafe (AC-002/AC-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(ADMIN_CTX);
    authMocks.requireRole.mockReturnValue(undefined);
    dbMocks.auditLogCreate.mockResolvedValue({});
    dbMocks.memberDelete.mockResolvedValue({});
  });

  it("returns LAST_ADMIN_BLOCKED (409) when removing last admin (AC-003)", async () => {
    dbMocks.memberFindFirst.mockResolvedValue({
      id: "m-1",
      role: "ADMIN",
      userId: "user-2",
    });
    dbMocks.memberCount.mockResolvedValue(1);

    const result = await removeMemberSafe("m-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("LAST_ADMIN_BLOCKED");
    }
    expect(dbMocks.memberDelete).not.toHaveBeenCalled();
  });

  it("removes member when not last admin (AC-002)", async () => {
    dbMocks.memberFindFirst.mockResolvedValue({
      id: "m-1",
      role: "ADMIN",
      userId: "user-2",
    });
    dbMocks.memberCount.mockResolvedValue(2); // 2 admins

    const result = await removeMemberSafe("m-1");

    expect(result.ok).toBe(true);
    expect(dbMocks.memberDelete).toHaveBeenCalledWith({
      where: { id: "m-1" },
    });
  });

  it("returns NOT_FOUND when member doesn't exist", async () => {
    dbMocks.memberFindFirst.mockResolvedValue(null);

    const result = await removeMemberSafe("m-99");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("returns SELF_REMOVE when admin removes themselves", async () => {
    dbMocks.memberFindFirst.mockResolvedValue({
      id: "m-admin",
      role: "ADMIN",
      userId: "admin-1", // same as ADMIN_CTX.userId
    });

    const result = await removeMemberSafe("m-admin");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SELF_REMOVE");
    }
  });
});

describe("updateMemberRoleSafe (AC-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(ADMIN_CTX);
    authMocks.requireRole.mockReturnValue(undefined);
    dbMocks.memberUpdate.mockResolvedValue({});
  });

  it("returns LAST_ADMIN_BLOCKED when demoting last admin (AC-003)", async () => {
    dbMocks.memberFindFirst.mockResolvedValue({ id: "m-1", role: "ADMIN" });
    dbMocks.memberCount.mockResolvedValue(1);

    const result = await updateMemberRoleSafe("m-1", "MEMBER");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("LAST_ADMIN_BLOCKED");
    }
  });

  it("allows role change when not last admin (AC-003)", async () => {
    dbMocks.memberFindFirst.mockResolvedValue({ id: "m-1", role: "ADMIN" });
    dbMocks.memberCount.mockResolvedValue(2);

    const result = await updateMemberRoleSafe("m-1", "MEMBER");

    expect(result.ok).toBe(true);
    expect(dbMocks.memberUpdate).toHaveBeenCalled();
  });
});

describe("bulkInviteMembers (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(ADMIN_CTX);
    authMocks.requireRole.mockReturnValue(undefined);
    dbMocks.invitationCreate.mockResolvedValue({});
    dbMocks.memberFindMany.mockResolvedValue([
      { user: { email: "existing@org.com" } },
    ]);
  });

  it("sends invites for valid emails, skips existing and invalid (AC-004)", async () => {
    const rows = [
      { email: "new1@example.com" },
      { email: "new2@example.com" },
      { email: "existing@org.com" }, // already member
      { email: "not-an-email" }, // invalid
    ];

    const result = await bulkInviteMembers(rows);

    expect(result.sent).toBe(2);
    expect(result.alreadyMember).toContain("existing@org.com");
    expect(result.invalidEmail).toContain("not-an-email");
    expect(dbMocks.invitationCreate).toHaveBeenCalledTimes(2);
  });

  it("does not halt on invalid rows — valid rows still processed (AC-004)", async () => {
    dbMocks.memberFindMany.mockResolvedValue([]);
    const rows = [
      { email: "bad" }, // invalid
      { email: "good@example.com" },
    ];

    const result = await bulkInviteMembers(rows);

    expect(result.sent).toBe(1);
    expect(result.invalidEmail).toHaveLength(1);
  });
});

// ─── IP Allowlist (AC-008) ────────────────────────────────────────────────────

describe("checkIpAllowlist (AC-008)", () => {
  it("allows all IPs when allowlist is empty", () => {
    expect(checkIpAllowlist("203.0.113.42", [])).toEqual({ allowed: true });
  });

  it("blocks IP not in CIDR range", () => {
    const result = checkIpAllowlist("203.0.113.42", ["10.0.0.0/8"]);
    expect(result.allowed).toBe(false);
  });

  it("allows IP inside CIDR range", () => {
    const result = checkIpAllowlist("10.1.2.3", ["10.0.0.0/8"]);
    expect(result.allowed).toBe(true);
    expect(result.matchedRange).toBe("10.0.0.0/8");
  });

  it("allows exact IP match", () => {
    const result = checkIpAllowlist("192.168.1.1", ["192.168.1.1"]);
    expect(result.allowed).toBe(true);
  });

  it("blocks when no range matches multiple ranges", () => {
    const result = checkIpAllowlist("172.16.0.1", [
      "10.0.0.0/8",
      "192.168.0.0/16",
    ]);
    expect(result.allowed).toBe(false);
  });
});

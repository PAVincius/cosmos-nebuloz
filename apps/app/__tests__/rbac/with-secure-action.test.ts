// @vitest-environment node
// Tests for withSecureAction HOF + custom role resolution

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  artMembershipFindFirst: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  auditLogCreate: vi.fn().mockResolvedValue({}),
  customRoleAssignmentFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    aRTMembership: { findFirst: dbMocks.artMembershipFindFirst },
    tenantMember: { findFirst: dbMocks.tenantMemberFindFirst },
    auditLog: { create: dbMocks.auditLogCreate },
    customRoleAssignment: { findMany: dbMocks.customRoleAssignmentFindMany },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("next/headers", () => ({ headers: authMocks.headers }));

import { withSecureAction } from "../../app/actions/_withSecureAction";
import { getCustomPermissions } from "../../lib/rbac/custom-roles";

const CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  role: "MEMBER" as const,
  user: { id: "user-1", email: "user@org.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue(CTX);
  dbMocks.artMembershipFindFirst.mockResolvedValue(null);
  dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "MEMBER" });
  dbMocks.customRoleAssignmentFindMany.mockResolvedValue([]);
  dbMocks.auditLogCreate.mockResolvedValue({});
});

// ─── withSecureAction ─────────────────────────────────────────────────────────

describe("withSecureAction — grant path", () => {
  it("grants access when role has required permission (RTE → epic:write)", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "RTE" });

    const result = await withSecureAction(
      { permission: "epic:write", entity: "Epic" },
      async (ctx) => ({ done: true, role: ctx.role })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ done: true, role: "RTE" });
    expect(dbMocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("grants access when ADMIN (wildcard)", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "ADMIN" });

    const result = await withSecureAction(
      { permission: "governance:approve", entity: "PIPlan" },
      async () => "ok"
    );

    expect(result.ok).toBe(true);
  });

  it("passes userId and tenantId to handler", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "PO" });

    let captured: { userId: string; tenantId: string } | null = null;
    await withSecureAction(
      { permission: "epic:write", entity: "Epic" },
      async (ctx) => {
        captured = { userId: ctx.userId, tenantId: ctx.tenantId };
        return null;
      }
    );

    expect(captured).toEqual({ userId: CTX.userId, tenantId: CTX.tenantId });
  });
});

describe("withSecureAction — deny path (AC-001, AC-004)", () => {
  it("returns INSUFFICIENT_ROLE when MEMBER attempts epic:write (AC-001)", async () => {
    const result = await withSecureAction(
      { permission: "epic:write", entity: "Epic" },
      async () => "should not run"
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INSUFFICIENT_ROLE");
    expect(result.error).toContain("INSUFFICIENT_ROLE");
  });

  it("writes authz.denied audit log on deny (AC-001)", async () => {
    await withSecureAction(
      { permission: "epic:write", entity: "Epic" },
      async () => null
    );

    expect(dbMocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: CTX.tenantId,
          actorId: CTX.userId,
          action: "authz.denied",
          entityType: "Epic",
        }),
      })
    );
  });

  it("SM denied epic:transition (AC-004 — SM < RTE)", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "SM" });

    const result = await withSecureAction(
      { permission: "epic:transition", entity: "Epic" },
      async () => null
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INSUFFICIENT_ROLE");
  });

  it("handler NOT called when denied", async () => {
    const handler = vi.fn().mockResolvedValue("called");

    await withSecureAction(
      { permission: "art:manage", entity: "ART" },
      handler
    );

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withSecureAction — ART-scoped role (AC-005)", () => {
  it("uses ART role when artId provided and membership exists", async () => {
    dbMocks.artMembershipFindFirst.mockResolvedValue({ role: "SM" });
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "MEMBER" });

    const result = await withSecureAction(
      { permission: "sprint:manage", entity: "Sprint", artId: "art-x" },
      async (ctx) => ctx.role
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe("SM");
  });

  it("MEMBER org role denied epic:transition even when artId given", async () => {
    dbMocks.artMembershipFindFirst.mockResolvedValue(null);
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "MEMBER" });

    const result = await withSecureAction(
      { permission: "epic:transition", entity: "Epic", artId: "art-x" },
      async () => null
    );

    expect(result.ok).toBe(false);
  });
});

describe("withSecureAction — custom roles (AC-003)", () => {
  it("grants access via custom role permissions when SAFe role denies", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "MEMBER" });
    dbMocks.customRoleAssignmentFindMany.mockResolvedValue([
      { customRole: { permissions: ["analytics:read", "reporting:export"] } },
    ]);

    const result = await withSecureAction(
      { permission: "reporting:export", entity: "AuditLog" },
      async () => "exported"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe("exported");
    expect(dbMocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("denies when custom role permissions do not include required permission", async () => {
    dbMocks.customRoleAssignmentFindMany.mockResolvedValue([
      { customRole: { permissions: ["analytics:read"] } },
    ]);

    const result = await withSecureAction(
      { permission: "epic:write", entity: "Epic" },
      async () => null
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INSUFFICIENT_ROLE");
  });
});

// ─── getCustomPermissions ────────────────────────────────────────────────────

describe("getCustomPermissions (AC-003)", () => {
  it("returns flat list of all custom role permissions for user", async () => {
    dbMocks.customRoleAssignmentFindMany.mockResolvedValue([
      { customRole: { permissions: ["analytics:read", "reporting:export"] } },
      { customRole: { permissions: ["sprint:read"] } },
    ]);

    const perms = await getCustomPermissions("user-1", "tenant-1");

    expect(perms).toEqual([
      "analytics:read",
      "reporting:export",
      "sprint:read",
    ]);
    expect(dbMocks.customRoleAssignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", tenantId: "tenant-1" },
      })
    );
  });

  it("returns empty array when no custom roles assigned", async () => {
    dbMocks.customRoleAssignmentFindMany.mockResolvedValue([]);
    const perms = await getCustomPermissions("user-x", "tenant-1");
    expect(perms).toEqual([]);
  });
});

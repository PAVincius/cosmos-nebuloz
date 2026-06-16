import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  artMembershipFindFirst: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    aRTMembership: { findFirst: dbMocks.artMembershipFindFirst },
    tenantMember: { findFirst: dbMocks.tenantMemberFindFirst },
    auditLog: { create: dbMocks.auditLogCreate },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

// ─── Pure permission matrix tests ─────────────────────────────────────────────

import {
  hasPermission,
  hasPermissions,
  PERMISSION_MATRIX,
} from "../../../../packages/rbac/src/matrix";

describe("PERMISSION_MATRIX (AC-001, AC-004)", () => {
  it("ADMIN has all permissions via wildcard", () => {
    expect(hasPermission("ADMIN", "epic:write")).toBe(true);
    expect(hasPermission("ADMIN", "governance:approve")).toBe(true);
    expect(hasPermission("ADMIN", "budget:write")).toBe(true);
  });

  it("MEMBER (VIEWER) cannot mutate epics (AC-001)", () => {
    expect(hasPermission("MEMBER", "epic:write")).toBe(false);
    expect(hasPermission("MEMBER", "epic:transition")).toBe(false);
  });

  it("MEMBER can read epics", () => {
    expect(hasPermission("MEMBER", "epic:read")).toBe(true);
  });

  it("RTE can transition epics (AC-004)", () => {
    expect(hasPermission("RTE", "epic:transition")).toBe(true);
    expect(hasPermission("RTE", "art:manage")).toBe(true);
  });

  it("SM cannot transition epics (AC-004 — SCRUM_MASTER < RTE)", () => {
    expect(hasPermission("SM", "epic:transition")).toBe(false);
    expect(hasPermission("SM", "governance:approve")).toBe(false);
  });

  it("DEV (TEAM_MEMBER) cannot write features", () => {
    expect(hasPermission("DEV", "feature:write")).toBe(false);
    expect(hasPermission("DEV", "story:write")).toBe(true);
  });

  it("PO can write WsjF but not manage art", () => {
    expect(hasPermission("PO", "wsjf:write")).toBe(true);
    expect(hasPermission("PO", "art:manage")).toBe(false);
  });

  it("STE has same permissions as RTE", () => {
    expect(PERMISSION_MATRIX.STE).toEqual(PERMISSION_MATRIX.RTE);
  });

  it("hasPermissions returns true only when all permissions granted", () => {
    expect(hasPermissions("RTE", ["epic:read", "epic:write"])).toBe(true);
    expect(hasPermissions("MEMBER", ["epic:read", "epic:write"])).toBe(false);
  });
});

// ─── getEffectiveRole (AC-005, AC-006 cache path) ─────────────────────────────

describe("getEffectiveRole (AC-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = "";
  });

  it("returns ART-scoped role when artId provided and membership exists (AC-005)", async () => {
    dbMocks.artMembershipFindFirst.mockResolvedValue({ role: "SM" });

    const { getEffectiveRole } = await import("../../lib/rbac/resolve");

    const role = await getEffectiveRole("user-1", "tenant-1", "art-1");
    expect(role).toBe("SM");
    expect(dbMocks.artMembershipFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", artId: "art-1", tenantId: "tenant-1" },
      select: { role: true },
    });
  });

  it("falls back to org role when no ART membership (AC-005)", async () => {
    dbMocks.artMembershipFindFirst.mockResolvedValue(null);
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "RTE" });

    const { getEffectiveRole } = await import("../../lib/rbac/resolve");

    const role = await getEffectiveRole("user-1", "tenant-1", "art-X");
    expect(role).toBe("RTE");
  });

  it("returns MEMBER (VIEWER) when no memberships at all (AC-005 fallback)", async () => {
    dbMocks.artMembershipFindFirst.mockResolvedValue(null);
    dbMocks.tenantMemberFindFirst.mockResolvedValue(null);

    const { getEffectiveRole } = await import("../../lib/rbac/resolve");

    const role = await getEffectiveRole("user-1", "tenant-1", "art-1");
    expect(role).toBe("MEMBER");
  });

  it("returns org role when no artId given", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "PO" });

    const { getEffectiveRole } = await import("../../lib/rbac/resolve");

    const role = await getEffectiveRole("user-2", "tenant-1");
    expect(role).toBe("PO");
    expect(dbMocks.artMembershipFindFirst).not.toHaveBeenCalled();
  });
});

// ─── VIEWER cannot mutate epics integration test (AC-001) ─────────────────────

describe("VIEWER cannot mutate epics (AC-001)", () => {
  it("MEMBER hasPermission epic:write returns false", () => {
    expect(hasPermission("MEMBER", "epic:write")).toBe(false);
  });

  it("MEMBER hasPermission epic:transition returns false", () => {
    expect(hasPermission("MEMBER", "epic:transition")).toBe(false);
  });

  it("ADMIN hasPermission returns true for any permission", () => {
    const testPerms = [
      "epic:write",
      "epic:transition",
      "art:manage",
      "governance:approve",
      "budget:write",
    ] as const;
    for (const perm of testPerms) {
      expect(hasPermission("ADMIN", perm)).toBe(true);
    }
  });
});

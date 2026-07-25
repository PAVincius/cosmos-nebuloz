// @vitest-environment node
// AC-005: multi-org session context switch

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  tenantMemberFindFirst: vi.fn(),
  sessionUpdate: vi.fn(),
  artMembershipFindFirst: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findFirst: dbMocks.tenantMemberFindFirst },
    session: { update: dbMocks.sessionUpdate },
    artMembership: { findFirst: dbMocks.artMembershipFindFirst },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: authMocks.getSession } },
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
    }
  },
}));
vi.mock("next/headers", () => ({ headers: authMocks.headers }));

const MOCK_SESSION = {
  user: { id: "user-1", email: "user@org.com" },
  session: { id: "sess-1", activeTenantId: "tenant-A" },
};

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.getSession.mockResolvedValue(MOCK_SESSION);
  dbMocks.tenantMemberFindFirst.mockResolvedValue({
    role: "SM",
    tenantId: "tenant-B",
  });
  dbMocks.sessionUpdate.mockResolvedValue({});
  dbMocks.artMembershipFindFirst.mockResolvedValue(null);
  process.env.UPSTASH_REDIS_REST_URL = "";
});

import { switchOrg } from "../../../app/actions/auth/switch-org";

describe("switchOrg (AC-005)", () => {
  it("switches session to target tenant and returns new role", async () => {
    const result = await switchOrg({ targetTenantId: "cldxnrzz100002" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tenantId).toBe("cldxnrzz100002");
    expect(result.data.role).toBe("SM");
  });

  it("updates session.activeTenantId in DB", async () => {
    await switchOrg({ targetTenantId: "cldxnrzz100002" });

    expect(dbMocks.sessionUpdate).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { activeTenantId: "cldxnrzz100002" },
    });
  });

  it("returns FORBIDDEN when user is not a member of target org", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue(null);

    const result = await switchOrg({ targetTenantId: "cldxnrzz100002" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
    expect(dbMocks.sessionUpdate).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED when no session", async () => {
    authMocks.getSession.mockResolvedValue(null);

    const result = await switchOrg({ targetTenantId: "cldxnrzz100002" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNAUTHORIZED");
  });

  it("verifies membership scoped to userId + targetTenantId", async () => {
    await switchOrg({ targetTenantId: "cldxnrzz100002" });

    expect(dbMocks.tenantMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", tenantId: "cldxnrzz100002" },
      })
    );
  });

  it("rejects non-cuid targetTenantId", async () => {
    const result = await switchOrg({ targetTenantId: "not-a-cuid" });

    expect(result.ok).toBe(false);
  });
});

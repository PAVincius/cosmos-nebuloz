import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  tenantMemberFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findMany: mocks.tenantMemberFindMany },
  },
}));

import { getUsers } from "../../app/actions/users/get";
import { searchUsers } from "../../app/actions/users/search";

const MEMBERS = [
  {
    userId: "u1",
    user: { id: "u1", name: "Alice", email: "alice@x.com", image: null },
  },
  {
    userId: "u2",
    user: { id: "u2", name: null, email: "bob@x.com", image: "http://img" },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
});

describe("getUsers", () => {
  it("returns user info for given userIds", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue(MEMBERS);
    const result = await getUsers(["u1", "u2"]);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ name: "Alice" });
      expect(result.data[1]).toMatchObject({ name: "bob@x.com" });
    }
  });

  it("uses email as fallback when name is null", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue([MEMBERS[1]]);
    const result = await getUsers(["u2"]);
    if ("data" in result) {
      expect(result.data[0].name).toBe("bob@x.com");
    }
  });

  it("queries with tenantId scope", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue([]);
    await getUsers(["u1"]);
    expect(mocks.tenantMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
  });

  it("returns error object when auth fails", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("Unauthorized"));
    const result = await getUsers(["u1"]);
    expect("error" in result).toBe(true);
  });
});

describe("searchUsers", () => {
  it("returns matching user ids via fuzzy search", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue(MEMBERS);
    const result = await searchUsers("Ali");
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data).toContain("u1");
    }
  });

  it("returns empty array when no match", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue(MEMBERS);
    const result = await searchUsers("zzzunknown");
    if ("data" in result) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("returns error object when auth fails", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("Unauthorized"));
    const result = await searchUsers("x");
    expect("error" in result).toBe(true);
  });

  it("queries with tenantId scope", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue([]);
    await searchUsers("test");
    expect(mocks.tenantMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
  });
});

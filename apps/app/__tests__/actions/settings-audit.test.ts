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
  listAuditLogs: vi.fn(),
  getTenantMembersForSearch: vi.fn(),
}));
vi.mock("../../app/actions/audit", () => ({
  listAuditLogs: matureMocks.listAuditLogs,
}));
vi.mock("../../app/actions/teams/members", () => ({
  getTenantMembersForSearch: matureMocks.getTenantMembersForSearch,
}));

import { getAuditTab } from "../../app/(cosmos)/actions/settings-audit";

const SAME_TENANT_LOG = {
  id: "log-1",
  tenantId: tenantCtx.tenantId,
  userId: "u1",
  action: "created",
  entityType: "Epic",
  entityId: "epic-1",
  diff: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue(tenantCtx);
  matureMocks.getTenantMembersForSearch.mockResolvedValue([
    {
      userId: "u1",
      name: "Marina Alves",
      email: "m@x.com",
      image: null,
      role: "ADMIN",
      source: "current_tenant",
    },
  ]);
});

describe("getAuditTab", () => {
  it("caps the page size at 25 (never an unbounded pull)", async () => {
    matureMocks.listAuditLogs.mockResolvedValue({
      ok: true,
      data: {
        items: [],
        meta: {
          total: 0,
          page: 1,
          limit: 25,
          pageCount: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
    });

    await getAuditTab(1);

    expect(matureMocks.listAuditLogs).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
    });
  });

  it("relies entirely on listAuditLogs' own tenant scoping — never re-fetches or widens the query", async () => {
    // listAuditLogs (app/actions/audit/index.ts) already scopes to
    // ctx.tenantId and is tested for that directly (audit.test.ts). This
    // wrapper must not do a second, unscoped read that could reintroduce a
    // cross-tenant leak — assert it's called exactly once, with no tenantId
    // override that could widen the query.
    matureMocks.listAuditLogs.mockResolvedValue({
      ok: true,
      data: {
        items: [SAME_TENANT_LOG],
        meta: {
          total: 1,
          page: 1,
          limit: 25,
          pageCount: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
    });

    const r = await getAuditTab(1);

    expect(matureMocks.listAuditLogs).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items).toHaveLength(1);
      expect(r.data.items[0].entityId).toBe("epic-1");
    }
  });

  it("joins the real member list to resolve actorName, falling back to the raw userId for an unknown member", async () => {
    matureMocks.listAuditLogs.mockResolvedValue({
      ok: true,
      data: {
        items: [
          SAME_TENANT_LOG,
          { ...SAME_TENANT_LOG, id: "log-2", userId: "unknown-user" },
          {
            ...SAME_TENANT_LOG,
            id: "log-3",
            userId: null,
            action: "status_changed",
          },
        ],
        meta: {
          total: 3,
          page: 1,
          limit: 25,
          pageCount: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
    });

    const r = await getAuditTab(1);

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items[0].actorName).toBe("Marina Alves");
      expect(r.data.items[1].actorName).toBe("unknown-user");
      expect(r.data.items[2].actorName).toBe("Sistema");
    }
  });

  it("returns a Result error instead of throwing when the underlying read fails", async () => {
    matureMocks.listAuditLogs.mockResolvedValue({ ok: false, error: "boom" });

    const r = await getAuditTab(1);

    expect(r.ok).toBe(false);
  });
});

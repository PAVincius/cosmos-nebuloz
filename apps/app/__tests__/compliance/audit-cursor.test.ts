// @vitest-environment node
// AC-008: cursor-based pagination for audit feed

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    auditLog: {
      findMany: dbMocks.findMany,
      count: dbMocks.count,
    },
  },
}));

vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: authMocks.headers }));

import { listAuditLogs } from "../../app/actions/audit/index";

const TENANT_ID = "cldxnrzz100001";
const CTX = {
  userId: "cldxnrzz200002",
  tenantId: TENANT_ID,
  role: "ADMIN" as const,
  user: { id: "cldxnrzz200002", email: "admin@org.com" },
};

const makeLog = (id: string) => ({
  id,
  tenantId: TENANT_ID,
  userId: null,
  action: "created",
  entityType: "epic",
  entityId: "cldxnrzz300003",
  diff: null,
  createdAt: new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue(CTX);
});

describe("listAuditLogs — offset mode (default)", () => {
  it("uses offset pagination when no cursor", async () => {
    dbMocks.findMany.mockResolvedValue([makeLog("cld00000000001")]);
    dbMocks.count.mockResolvedValue(1);

    const result = await listAuditLogs({ page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
    expect(result.data.meta.total).toBe(1);
    expect(result.data.meta.nextCursor).toBeUndefined();
  });

  it("returns correct page meta", async () => {
    dbMocks.findMany.mockResolvedValue([makeLog("cld00000000001")]);
    dbMocks.count.mockResolvedValue(55);

    const result = await listAuditLogs({ page: 2, limit: 20 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.meta.page).toBe(2);
    expect(result.data.meta.pageCount).toBe(3);
    expect(result.data.meta.hasNext).toBe(true);
    expect(result.data.meta.hasPrev).toBe(true);
  });
});

describe("listAuditLogs — cursor mode (AC-008)", () => {
  const CURSOR = "cld00000000002";

  it("uses cursor query when cursor provided", async () => {
    const items = [makeLog("cld00000000003"), makeLog("cld00000000004")];
    dbMocks.findMany.mockResolvedValue(items);

    const result = await listAuditLogs({ cursor: CURSOR, limit: 20 });

    expect(result.ok).toBe(true);
    expect(dbMocks.count).not.toHaveBeenCalled();
    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: CURSOR },
        skip: 1,
        take: 20,
      })
    );
  });

  it("sets nextCursor to last item id when page full", async () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeLog(`cld0000000${String(i).padStart(4, "0")}`)
    );
    dbMocks.findMany.mockResolvedValue(items);

    const result = await listAuditLogs({ cursor: CURSOR, limit: 20 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.meta.nextCursor).toBe(items[19]?.id);
    expect(result.data.meta.hasNext).toBe(true);
  });

  it("nextCursor undefined on last page", async () => {
    const items = [makeLog("cld00000000003")];
    dbMocks.findMany.mockResolvedValue(items);

    const result = await listAuditLogs({ cursor: CURSOR, limit: 20 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.meta.nextCursor).toBeUndefined();
    expect(result.data.meta.hasNext).toBe(false);
  });

  it("respects limit=100 maximum (AC-008)", async () => {
    dbMocks.findMany.mockResolvedValue([]);

    const result = await listAuditLogs({ cursor: CURSOR, limit: 100 });

    expect(result.ok).toBe(true);
    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });
});

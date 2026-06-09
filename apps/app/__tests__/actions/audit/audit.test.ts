// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogCount: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    auditLog: {
      findMany: mocks.auditLogFindMany,
      count: mocks.auditLogCount,
      create: mocks.auditLogCreate,
    },
  },
}));

import {
  getAuditLogsByEntity,
  listAuditLogs,
  logAudit,
  writeAuditLog,
} from "../../../app/actions/audit/index";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENTITY_ID = "cltest0000000000000000001";
const USER_ID = "cltest0000000000000000002";

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "cltest0000000000000000003",
    tenantId: tenantCtx.tenantId,
    userId: USER_ID,
    action: "created",
    entityType: "epic",
    entityId: ENTITY_ID,
    diff: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.auditLogFindMany.mockResolvedValue([]);
  mocks.auditLogCount.mockResolvedValue(0);
  mocks.auditLogCreate.mockResolvedValue(makeLog());
});

// ─── listAuditLogs ────────────────────────────────────────────────────────────

describe("listAuditLogs", () => {
  it("returns paginated result with correct meta", async () => {
    const logs = [makeLog(), makeLog()];
    mocks.auditLogFindMany.mockResolvedValue(logs);
    mocks.auditLogCount.mockResolvedValue(2);

    const result = await listAuditLogs({ page: 1, limit: 10 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(2);
    expect(result.data.meta.total).toBe(2);
    expect(result.data.meta.page).toBe(1);
    expect(result.data.meta.pageCount).toBe(1);
  });

  it("scopes query to the authenticated tenant", async () => {
    mocks.auditLogFindMany.mockResolvedValue([]);
    mocks.auditLogCount.mockResolvedValue(0);

    await listAuditLogs();

    const whereArg = mocks.auditLogFindMany.mock.calls[0][0].where;
    expect(whereArg.tenantId).toBe(tenantCtx.tenantId);
  });

  it("applies entityType filter when provided", async () => {
    mocks.auditLogFindMany.mockResolvedValue([]);
    mocks.auditLogCount.mockResolvedValue(0);

    await listAuditLogs({ entityType: "epic" });

    const whereArg = mocks.auditLogFindMany.mock.calls[0][0].where;
    expect(whereArg.entityType).toBe("epic");
  });
});

// ─── getAuditLogsByEntity ─────────────────────────────────────────────────────

describe("getAuditLogsByEntity", () => {
  it("returns logs matching the given entityType and entityId", async () => {
    const logs = [makeLog({ entityType: "epic", entityId: ENTITY_ID })];
    mocks.auditLogFindMany.mockResolvedValue(logs);

    const result = await getAuditLogsByEntity("epic", ENTITY_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].entityId).toBe(ENTITY_ID);
  });

  it("returns { ok: true, data: [...] } shape", async () => {
    mocks.auditLogFindMany.mockResolvedValue([makeLog()]);

    const result = await getAuditLogsByEntity("epic", ENTITY_ID);

    expect(result).toMatchObject({ ok: true });
    expect(Array.isArray((result as { ok: true; data: unknown[] }).data)).toBe(
      true
    );
  });
});

// ─── writeAuditLog ────────────────────────────────────────────────────────────

describe("writeAuditLog", () => {
  it("creates a log entry with correct data and calls revalidatePath", async () => {
    const log = makeLog();
    mocks.auditLogCreate.mockResolvedValue(log);

    const result = await writeAuditLog({
      action: "created",
      entityType: "epic",
      entityId: ENTITY_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.action).toBe("created");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/audit");
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
  });

  it("returns { ok: false } on Zod validation error (missing required field)", async () => {
    const result = await writeAuditLog({
      // action missing — required by WriteAuditLogSchema
      entityType: "epic",
      entityId: ENTITY_ID,
    });

    expect(result.ok).toBe(false);
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });
});

// ─── logAudit ─────────────────────────────────────────────────────────────────

describe("logAudit", () => {
  it("creates an audit log entry with tenantId and payload fields", async () => {
    await logAudit(tenantCtx.tenantId, {
      userId: USER_ID,
      action: "created",
      entityType: "epic",
      entityId: ENTITY_ID,
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    const data = mocks.auditLogCreate.mock.calls[0][0].data;
    expect(data.tenantId).toBe(tenantCtx.tenantId);
    expect(data.action).toBe("created");
    expect(data.entityType).toBe("epic");
  });

  it("swallows errors — does not throw when DB throws", async () => {
    mocks.auditLogCreate.mockRejectedValue(new Error("DB connection lost"));

    await expect(
      logAudit(tenantCtx.tenantId, {
        action: "deleted",
        entityType: "risk",
        entityId: ENTITY_ID,
      })
    ).resolves.toBeUndefined();
  });

  it("sets userId to null when not provided in payload", async () => {
    await logAudit(tenantCtx.tenantId, {
      action: "updated",
      entityType: "feature",
      entityId: ENTITY_ID,
    });

    const data = mocks.auditLogCreate.mock.calls[0][0].data;
    expect(data.userId).toBeNull();
  });
});

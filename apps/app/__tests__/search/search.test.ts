import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  flagFindFirst: vi.fn(),
  flagFindUnique: vi.fn(),
  notifCreate: vi.fn(),
  notifCreateMany: vi.fn(),
  notifFindMany: vi.fn(),
  notifDelete: vi.fn(),
  memberFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    $queryRaw: dbMocks.queryRaw,
    featureFlagOverride: { findFirst: dbMocks.flagFindFirst },
    featureFlag: { findUnique: dbMocks.flagFindUnique },
    notification: {
      create: dbMocks.notifCreate,
      createMany: dbMocks.notifCreateMany,
      findMany: dbMocks.notifFindMany,
      delete: dbMocks.notifDelete,
    },
    tenantMember: { findMany: dbMocks.memberFindMany },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
}));

vi.mock("next/headers", () => ({
  headers: authMocks.headers,
}));

import { resolveFlag } from "../../lib/feature-flags/resolve";
import {
  sendBroadcast,
  sendDedupedNotification,
} from "../../lib/notifications/dedup";

const CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  role: "ADMIN" as const,
  user: { id: "user-1", email: "u@org.com" },
};

// ─── Feature flag resolution (AC-007 / AC-008) ───────────────────────────────

describe("resolveFlag (AC-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user override when present (highest priority)", async () => {
    dbMocks.flagFindFirst.mockResolvedValueOnce({ value: true });

    const result = await resolveFlag({
      flagKey: "bpmn-editor",
      tenantId: "t-1",
      userId: "u-1",
    });

    expect(result).toBe(true);
    expect(dbMocks.flagFindFirst).toHaveBeenCalledTimes(1);
  });

  it("returns org override when no user override (AC-007)", async () => {
    // first call (user override) = null, second call (org override) = {value:true}
    dbMocks.flagFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ value: true });

    const result = await resolveFlag({
      flagKey: "bpmn-editor",
      tenantId: "t-1",
      userId: "u-1",
    });

    expect(result).toBe(true);
    expect(dbMocks.flagFindFirst).toHaveBeenCalledTimes(2);
  });

  it("falls back to global default when no overrides (AC-007)", async () => {
    dbMocks.flagFindFirst.mockResolvedValue(null);
    dbMocks.flagFindUnique.mockResolvedValue({ defaultValue: false });

    const result = await resolveFlag({
      flagKey: "bpmn-editor",
      tenantId: "t-1",
    });

    expect(result).toBe(false);
    expect(dbMocks.flagFindUnique).toHaveBeenCalledWith({
      where: { key: "bpmn-editor" },
      select: { defaultValue: true },
    });
  });

  it("returns false when flag doesn't exist in DB", async () => {
    dbMocks.flagFindFirst.mockResolvedValue(null);
    dbMocks.flagFindUnique.mockResolvedValue(null);

    const result = await resolveFlag({
      flagKey: "nonexistent",
      tenantId: "t-1",
    });

    expect(result).toBe(false);
  });

  it("skips user override check when userId not provided", async () => {
    dbMocks.flagFindFirst.mockResolvedValue({ value: true });
    dbMocks.flagFindUnique.mockResolvedValue({ defaultValue: false });

    await resolveFlag({ flagKey: "bpmn-editor", tenantId: "t-1" });

    // Only 1 findFirst call (org override), not 2
    expect(dbMocks.flagFindFirst).toHaveBeenCalledTimes(1);
  });
});

// ─── Notification dedup (AC-004) ─────────────────────────────────────────────

describe("sendDedupedNotification (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // When UPSTASH_REDIS_REST_URL is unset, falls through to direct create
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    dbMocks.notifCreate.mockResolvedValue({});
  });

  it("creates notification when no UPSTASH env (AC-004)", async () => {
    const sent = await sendDedupedNotification({
      tenantId: "t-1",
      userId: "u-1",
      type: "anomaly",
      entityId: "e-1",
      title: "Velocity drop detected",
    });

    expect(sent).toBe(true);
    expect(dbMocks.notifCreate).toHaveBeenCalled();
  });
});

// ─── Broadcast (AC-006) ──────────────────────────────────────────────────────

describe("sendBroadcast (AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.memberFindMany.mockResolvedValue([
      { userId: "u-1" },
      { userId: "u-2" },
      { userId: "u-3" },
    ]);
    dbMocks.notifFindMany.mockResolvedValue([]);
    dbMocks.notifCreateMany.mockResolvedValue({ count: 3 });
  });

  it("creates pinned broadcast for all members (AC-006)", async () => {
    await sendBroadcast("t-1", "Maintenance window", "2026-06-15 20:00 UTC");

    expect(dbMocks.notifCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ pinned: true, type: "broadcast" }),
        ]),
      })
    );
  });

  it("evicts oldest pinned when 3 already exist (AC-006)", async () => {
    dbMocks.notifFindMany.mockResolvedValue([
      { id: "old-1" },
      { id: "old-2" },
      { id: "old-3" },
    ]);
    dbMocks.notifDelete.mockResolvedValue({});

    await sendBroadcast("t-1", "New announcement", "Details here");

    expect(dbMocks.notifDelete).toHaveBeenCalledWith({
      where: { id: "old-1" },
    });
  });
});

// ─── Search prefix filter ─────────────────────────────────────────────────────

describe("Search prefix parsing (AC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(CTX);
    dbMocks.queryRaw.mockResolvedValue([]);
  });

  it("parses epic: prefix correctly", async () => {
    const { GET } = await import("../../app/api/search/route");

    const req = {
      nextUrl: new URL("http://localhost/api/search?q=epic:payment+gateway"),
    } as unknown as import("next/server").NextRequest;

    await GET(req);

    // Only epic search should be called (1 $queryRaw call for epics)
    expect(dbMocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns empty results for blank query", async () => {
    const { GET } = await import("../../app/api/search/route");
    const req = {
      nextUrl: new URL("http://localhost/api/search?q="),
    } as unknown as import("next/server").NextRequest;

    const res = await GET(req);
    const body = (await res.json()) as { results: unknown[] };

    expect(body.results).toHaveLength(0);
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });
});

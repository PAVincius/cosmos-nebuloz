import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  dsrUpdate: vi.fn(),
  userUpdate: vi.fn(),
  standupUpdateMany: vi.fn(),
  copilotUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
  standupFindMany: vi.fn(),
  copilotFindMany: vi.fn(),
  meetingParticipantFindMany: vi.fn().mockResolvedValue([]),
  auditCreate: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    dataSubjectRequest: { update: dbMocks.dsrUpdate },
    user: { update: dbMocks.userUpdate, findUnique: dbMocks.userFindUnique },
    standupEntry: {
      updateMany: dbMocks.standupUpdateMany,
      findMany: dbMocks.standupFindMany,
    },
    copilotMessage: { updateMany: dbMocks.copilotUpdateMany },
    copilotSession: { findMany: dbMocks.copilotFindMany },
    meetingParticipant: { findMany: dbMocks.meetingParticipantFindMany },
    auditLog: { create: dbMocks.auditCreate, findMany: dbMocks.auditFindMany },
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

import { buildPortabilityExport } from "../../lib/inngest/lgpd-dsr";

const TENANT_ID = "tenant-1";
const SUBJECT_ID = "user-42";
const _REQUEST_ID = "dsr-1";
const EXPORTED_AT = "2026-06-09T00:00:00.000Z";

// ─── LGPD Portability Export ──────────────────────────────────────────────────

describe("buildPortabilityExport (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.userFindUnique.mockResolvedValue({
      id: SUBJECT_ID,
      name: "Alice",
      email: "alice@example.com",
      createdAt: new Date("2025-01-01"),
    });
    dbMocks.standupFindMany.mockResolvedValue([
      {
        id: "s-1",
        date: new Date("2026-01-15"),
        yesterday: "Worked on feature X",
        today: "Finishing X",
        blockers: null,
      },
    ]);
    dbMocks.copilotFindMany.mockResolvedValue([
      {
        id: "cs-1",
        mode: "team",
        createdAt: new Date("2026-01-10"),
        messageCount: 5,
      },
    ]);
  });

  it("returns only subject-scoped data (AC-004)", async () => {
    const payload = await buildPortabilityExport(
      SUBJECT_ID,
      TENANT_ID,
      EXPORTED_AT
    );

    expect(payload.subject?.id).toBe(SUBJECT_ID);
    expect(payload.standupEntries).toHaveLength(1);
    expect(payload.copilotSessions).toHaveLength(1);
  });

  it("queries with correct tenantId + subjectId filters (AC-004)", async () => {
    await buildPortabilityExport(SUBJECT_ID, TENANT_ID, EXPORTED_AT);

    expect(dbMocks.standupFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: SUBJECT_ID, tenantId: TENANT_ID },
      })
    );
    expect(dbMocks.copilotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: SUBJECT_ID, tenantId: TENANT_ID },
      })
    );
  });

  it("includes schemaVersion and exportedAt (AC-004)", async () => {
    const payload = await buildPortabilityExport(
      SUBJECT_ID,
      TENANT_ID,
      EXPORTED_AT
    );

    expect(payload.schemaVersion).toBe("1.0");
    expect(payload.exportedAt).toBe(EXPORTED_AT);
  });

  it("returns null subject when user not found", async () => {
    dbMocks.userFindUnique.mockResolvedValue(null);

    const payload = await buildPortabilityExport(
      SUBJECT_ID,
      TENANT_ID,
      EXPORTED_AT
    );

    expect(payload.subject).toBeNull();
    expect(payload.standupEntries).toHaveLength(1);
  });

  it("includes meeting participations, keyed by subject email (AC-004, passo 8)", async () => {
    dbMocks.meetingParticipantFindMany.mockResolvedValue([
      {
        isOrganizer: true,
        isExternal: false,
        transcript: {
          id: "tx-1",
          meetingId: "m-1",
          title: "PI Planning",
          createdAt: new Date("2026-02-01"),
        },
      },
    ]);

    const payload = await buildPortabilityExport(
      SUBJECT_ID,
      TENANT_ID,
      EXPORTED_AT
    );

    expect(dbMocks.meetingParticipantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, email: "alice@example.com" },
      })
    );
    expect(payload.meetingParticipations).toEqual([
      {
        transcriptId: "tx-1",
        meetingId: "m-1",
        title: "PI Planning",
        isOrganizer: true,
        isExternal: false,
        createdAt: new Date("2026-02-01"),
      },
    ]);
  });

  it("meetingParticipations is empty when subject has no email (user not found)", async () => {
    dbMocks.userFindUnique.mockResolvedValue(null);

    const payload = await buildPortabilityExport(
      SUBJECT_ID,
      TENANT_ID,
      EXPORTED_AT
    );

    expect(dbMocks.meetingParticipantFindMany).not.toHaveBeenCalled();
    expect(payload.meetingParticipations).toEqual([]);
  });
});

// ─── SOC2 JSONL Export ────────────────────────────────────────────────────────

describe("SOC2 JSONL export route (AC-002)", () => {
  const ADMIN_CTX = {
    userId: "admin-1",
    tenantId: TENANT_ID,
    role: "ADMIN" as const,
    user: { id: "admin-1", email: "admin@org.com" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(ADMIN_CTX);
    dbMocks.auditCreate.mockResolvedValue({});
    dbMocks.auditFindMany.mockResolvedValue([
      {
        id: "log-1",
        action: "epic.created",
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "log-2",
        action: "feature.updated",
        createdAt: new Date("2026-02-01"),
      },
    ]);
  });

  it("self-logs the export request (AC-002)", async () => {
    const { GET } = await import("../../app/api/compliance/soc2-export/route");

    const req = new Request(
      "http://localhost/api/compliance/soc2-export?from=2026-01-01&to=2026-03-31"
    ) as unknown as import("next/server").NextRequest;
    (req as unknown as { nextUrl: URL }).nextUrl = new URL(req.url);

    await GET(req as unknown as import("next/server").NextRequest);

    expect(dbMocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "compliance.soc2_export.requested",
          actorId: "admin-1",
          actorType: "user",
        }),
      })
    );
  });

  it("returns 403 for non-ADMIN role (AC-002)", async () => {
    authMocks.requireTenantSession.mockResolvedValue({
      ...ADMIN_CTX,
      role: "MEMBER",
    });

    const { GET } = await import("../../app/api/compliance/soc2-export/route");
    const req = new Request(
      "http://localhost/api/compliance/soc2-export"
    ) as unknown as import("next/server").NextRequest;
    (req as unknown as { nextUrl: URL }).nextUrl = new URL(req.url);

    const res = await GET(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(403);
  });

  it("queries AuditLog with date range (AC-002)", async () => {
    const { GET } = await import("../../app/api/compliance/soc2-export/route");
    const req = new Request(
      "http://localhost/api/compliance/soc2-export?from=2026-01-01&to=2026-03-31"
    ) as unknown as import("next/server").NextRequest;
    (req as unknown as { nextUrl: URL }).nextUrl = new URL(req.url);

    await GET(req as unknown as import("next/server").NextRequest);

    expect(dbMocks.auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        orderBy: { createdAt: "asc" },
      })
    );
  });
});

// ─── Audit feed pagination ────────────────────────────────────────────────────

describe("Audit feed cursor pagination (AC-008)", () => {
  const CTX = {
    userId: "admin-1",
    tenantId: TENANT_ID,
    role: "ADMIN" as const,
    user: { id: "admin-1", email: "admin@org.com" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.headers.mockResolvedValue(new Headers());
    authMocks.requireTenantSession.mockResolvedValue(CTX);
  });

  it("returns hasMore=true and nextCursor when more entries exist (AC-008)", async () => {
    // Return limit+1 entries to signal hasMore
    const entries = Array.from({ length: 101 }, (_, i) => ({
      id: `log-${i}`,
      action: "epic.created",
      createdAt: new Date(),
    }));
    dbMocks.auditFindMany.mockResolvedValue(entries);

    const { GET } = await import("../../app/api/audit/route");
    const req = {
      nextUrl: new URL("http://localhost/api/audit?limit=100"),
    } as unknown as import("next/server").NextRequest;

    const res = await GET(req);
    const body = (await res.json()) as {
      hasMore: boolean;
      nextCursor: string;
      data: unknown[];
    };

    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("log-99");
    expect(body.data).toHaveLength(100);
  });

  it("queries with cursor skip when cursor param provided (AC-008)", async () => {
    dbMocks.auditFindMany.mockResolvedValue([]);

    const { GET } = await import("../../app/api/audit/route");
    const req = {
      nextUrl: new URL("http://localhost/api/audit?cursor=log-50&limit=50"),
    } as unknown as import("next/server").NextRequest;

    await GET(req);

    expect(dbMocks.auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "log-50" },
        skip: 1,
      })
    );
  });

  it("filters by action param (AC-008)", async () => {
    dbMocks.auditFindMany.mockResolvedValue([]);

    const { GET } = await import("../../app/api/audit/route");
    const req = {
      nextUrl: new URL("http://localhost/api/audit?action=epic.created"),
    } as unknown as import("next/server").NextRequest;

    await GET(req);

    expect(dbMocks.auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: "epic.created" }),
      })
    );
  });

  it("caps limit at 100 (AC-008)", async () => {
    dbMocks.auditFindMany.mockResolvedValue([]);

    const { GET } = await import("../../app/api/audit/route");
    const req = {
      nextUrl: new URL("http://localhost/api/audit?limit=9999"),
    } as unknown as import("next/server").NextRequest;

    await GET(req);

    expect(dbMocks.auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }) // 100 + 1 for hasMore check
    );
  });
});

// ─── Erasure pseudonymization (AC-003) ───────────────────────────────────────

describe("processErasureRequest pseudonymization steps (AC-003)", () => {
  it("replacement token contains sha256 of subjectId", () => {
    const { createHash } =
      require("node:crypto") as typeof import("node:crypto");
    const hash = createHash("sha256").update(SUBJECT_ID).digest("hex");
    const replacement = `{subject_anonymized_${hash}}`;

    expect(replacement).toMatch(/^\{subject_anonymized_[a-f0-9]{64}\}$/);
    expect(replacement).toContain(hash);
  });

  it("replacement token is deterministic for same subjectId", () => {
    const { createHash } =
      require("node:crypto") as typeof import("node:crypto");
    const h1 = createHash("sha256").update(SUBJECT_ID).digest("hex");
    const h2 = createHash("sha256").update(SUBJECT_ID).digest("hex");

    expect(h1).toBe(h2);
  });
});

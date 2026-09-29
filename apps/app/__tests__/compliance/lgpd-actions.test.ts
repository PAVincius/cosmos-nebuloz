// @vitest-environment node
// User-facing LGPD server actions: submitErasureRequest + requestPortabilityExport

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  dsrCreate: vi.fn(),
  dsrFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  standupFindMany: vi.fn(),
  copilotFindMany: vi.fn(),
  meetingParticipantFindMany: vi.fn().mockResolvedValue([]),
}));

vi.mock("@repo/database", () => ({
  database: {
    dataSubjectRequest: {
      create: dbMocks.dsrCreate,
      findFirst: dbMocks.dsrFindFirst,
    },
    user: { findUnique: dbMocks.userFindUnique },
    standupEntry: { findMany: dbMocks.standupFindMany },
    copilotSession: { findMany: dbMocks.copilotFindMany },
    meetingParticipant: { findMany: dbMocks.meetingParticipantFindMany },
  },
}));

vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: inngestMock }));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
}));
vi.mock("next/headers", () => ({ headers: authMocks.headers }));

import {
  requestPortabilityExport,
  submitErasureRequest,
} from "../../app/actions/settings/lgpd";

const CTX = {
  userId: "cldxnrzz200002",
  tenantId: "cldxnrzz100001",
  role: "MEMBER" as const,
  user: { id: "cldxnrzz200002", email: "user@org.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue(CTX);
  dbMocks.dsrFindFirst.mockResolvedValue(null);
  dbMocks.dsrCreate.mockResolvedValue({ id: "dsr-new-1" });
  inngestMock.send.mockResolvedValue(undefined);
  dbMocks.userFindUnique.mockResolvedValue({
    id: CTX.userId,
    name: "Alice",
    email: "user@org.com",
    createdAt: new Date("2025-01-01"),
  });
  dbMocks.standupFindMany.mockResolvedValue([]);
  dbMocks.copilotFindMany.mockResolvedValue([]);
});

describe("submitErasureRequest", () => {
  it("creates the PENDING DSR record (outbox for /api/cron/lgpd-erasure) and emits no Inngest event", async () => {
    const result = await submitErasureRequest();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.requestId).toBe("dsr-new-1");
    expect(dbMocks.dsrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: CTX.tenantId,
          subjectId: CTX.userId,
          type: "ERASURE",
          status: "PENDING",
        }),
      })
    );
    expect(inngestMock.send).not.toHaveBeenCalled();
  });

  it("returns existing requestId when pending request already exists", async () => {
    dbMocks.dsrFindFirst.mockResolvedValue({ id: "dsr-existing-1" });

    const result = await submitErasureRequest();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.requestId).toBe("dsr-existing-1");
    expect(dbMocks.dsrCreate).not.toHaveBeenCalled();
    expect(inngestMock.send).not.toHaveBeenCalled();
  });

  it("scopes DSR check to tenant + user", async () => {
    await submitErasureRequest();

    expect(dbMocks.dsrFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: CTX.tenantId,
          subjectId: CTX.userId,
          type: "ERASURE",
        }),
      })
    );
  });
});

describe("requestPortabilityExport", () => {
  it("returns portability payload with canonical shape", async () => {
    const result = await requestPortabilityExport();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.schemaVersion).toBe("1.0");
    expect(result.data.subject?.id).toBe(CTX.userId);
    expect(result.data.standupEntries).toEqual([]);
    expect(result.data.copilotSessions).toEqual([]);
    expect(typeof result.data.exportedAt).toBe("string");
  });

  it("queries with correct tenant + subject scoping", async () => {
    await requestPortabilityExport();

    expect(dbMocks.standupFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: CTX.userId, tenantId: CTX.tenantId },
      })
    );
    expect(dbMocks.copilotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: CTX.userId, tenantId: CTX.tenantId },
      })
    );
  });

  it("returns null subject when user not found", async () => {
    dbMocks.userFindUnique.mockResolvedValue(null);

    const result = await requestPortabilityExport();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.subject).toBeNull();
  });
});

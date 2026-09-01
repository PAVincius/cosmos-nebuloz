// @vitest-environment node
// Tests for grantConsent / denyConsent / revokeConsent — pure unit tests.
// Database calls are mocked; no DATABASE_URL required.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn().mockResolvedValue({
    tenantId: "tenant_1",
    userId: "user_1",
    role: "ADMIN",
  }),
  requireRole: vi.fn(),
  headers: vi.fn().mockResolvedValue({}),
  logAudit: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
  transcriptFindFirst: vi.fn(),
  transcriptUpdate: vi.fn().mockResolvedValue({}),
  transaction: vi.fn(),
  insightDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  insightUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  txTranscriptUpdate: vi.fn().mockResolvedValue({}),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.send },
}));
vi.mock("@repo/database", () => ({
  database: {
    meetingTranscript: {
      findFirst: mocks.transcriptFindFirst,
      update: mocks.transcriptUpdate,
    },
    $transaction: mocks.transaction,
  },
  Prisma: { DbNull: "__DB_NULL__" },
}));
vi.mock("@/app/actions/audit/log-audit", () => ({
  logAudit: mocks.logAudit,
}));

import {
  denyConsent,
  grantConsent,
  revokeConsent,
} from "@/app/actions/meeting/consent";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTenantSession.mockResolvedValue({
    tenantId: "tenant_1",
    userId: "user_1",
    role: "ADMIN",
  });
  mocks.requireRole.mockImplementation(() => {});
  mocks.headers.mockResolvedValue({});
  mocks.logAudit.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue(undefined);
  mocks.transcriptUpdate.mockResolvedValue({});

  // Default $transaction: run the callback against a tx double.
  type Tx = {
    meetingInsight: {
      deleteMany: typeof mocks.insightDeleteMany;
      updateMany: typeof mocks.insightUpdateMany;
    };
    meetingTranscript: { update: typeof mocks.txTranscriptUpdate };
  };
  const tx: Tx = {
    meetingInsight: {
      deleteMany: mocks.insightDeleteMany,
      updateMany: mocks.insightUpdateMany,
    },
    meetingTranscript: { update: mocks.txTranscriptUpdate },
  };
  mocks.transaction.mockImplementation(
    async (cb: (tx: Tx) => Promise<unknown>) => cb(tx)
  );
});

describe("grantConsent", () => {
  it("enforces the admin role gate", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx_1",
      consentState: "PENDING",
    });

    await grantConsent({ transcriptId: "tx_1" });

    expect(mocks.requireRole).toHaveBeenCalledWith(
      expect.arrayContaining(["ADMIN", "STE", "RTE"]),
      expect.objectContaining({ tenantId: "tenant_1" })
    );
  });

  it("transcript not found → err", async () => {
    mocks.transcriptFindFirst.mockResolvedValue(null);

    const res = await grantConsent({ transcriptId: "missing" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/não encontrada/i);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("non-PENDING transcript → err, no side effects", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx_1",
      consentState: "GRANTED",
    });

    const res = await grantConsent({ transcriptId: "tx_1" });

    expect(res.ok).toBe(false);
    expect(mocks.transcriptUpdate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("PENDING → GRANTED, stamps grantedBy/At, enqueues the mapper, logs audit", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx_1",
      consentState: "PENDING",
    });

    const res = await grantConsent({ transcriptId: "tx_1" });

    expect(res.ok).toBe(true);
    expect(mocks.transcriptUpdate).toHaveBeenCalledWith({
      where: { id: "tx_1" },
      data: {
        consentState: "GRANTED",
        consentGrantedBy: "user_1",
        consentGrantedAt: expect.any(Date),
      },
    });
    // The effect: releasing must enqueue the mapper, or consent is a no-op.
    expect(mocks.send).toHaveBeenCalledWith({
      name: "integration/fireflies.transcript.ready",
      data: { tenantId: "tenant_1", transcriptId: "tx_1" },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      "tenant_1",
      expect.objectContaining({ action: "consent_granted", entityId: "tx_1" })
    );
  });
});

describe("denyConsent", () => {
  it("PENDING → DENIED, never enqueues the mapper", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx_2",
      consentState: "PENDING",
    });

    const res = await denyConsent({ transcriptId: "tx_2" });

    expect(res.ok).toBe(true);
    expect(mocks.transcriptUpdate).toHaveBeenCalledWith({
      where: { id: "tx_2" },
      data: { consentState: "DENIED" },
    });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.logAudit).toHaveBeenCalledWith(
      "tenant_1",
      expect.objectContaining({ action: "consent_denied" })
    );
  });

  it("non-PENDING transcript → err", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx_2",
      consentState: "DENIED",
    });

    const res = await denyConsent({ transcriptId: "tx_2" });
    expect(res.ok).toBe(false);
  });
});

describe("revokeConsent", () => {
  it("non-GRANTED transcript → err, no transaction run", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx_3",
      consentState: "PENDING",
    });

    const res = await revokeConsent({ transcriptId: "tx_3" });

    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("GRANTED → deletes PENDING/DISMISSED insights, redacts APPLIED insights, zeroes rawSummary, preserves the transcript row", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx_3",
      consentState: "GRANTED",
    });

    const res = await revokeConsent({ transcriptId: "tx_3" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.consentState).toBe("REVOKED");

    expect(mocks.insightDeleteMany).toHaveBeenCalledWith({
      where: {
        transcriptId: "tx_3",
        tenantId: "tenant_1",
        status: { in: ["PENDING", "DISMISSED"] },
      },
    });
    expect(mocks.insightUpdateMany).toHaveBeenCalledWith({
      where: { transcriptId: "tx_3", tenantId: "tenant_1", status: "APPLIED" },
      data: { text: expect.any(String) },
    });
    // The transcript row itself is UPDATEd (rawSummary zeroed), never deleted
    // — it stays as the record that the meeting existed and was revoked.
    expect(mocks.txTranscriptUpdate).toHaveBeenCalledWith({
      where: { id: "tx_3" },
      data: { rawSummary: "__DB_NULL__", consentState: "REVOKED" },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      "tenant_1",
      expect.objectContaining({ action: "consent_revoked" })
    );
  });
});

// @vitest-environment node
// Tests for listConsentQueue — the read action behind the consent screen
// (docs/compliance/consentimento-de-gravacao.md §7, passo 5). Database calls
// are mocked; no DATABASE_URL required.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn().mockResolvedValue({}),
  transcriptFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@repo/database", () => ({
  database: {
    meetingTranscript: { findMany: mocks.transcriptFindMany },
    user: { findMany: mocks.userFindMany },
  },
  Prisma: { DbNull: "__DB_NULL__" },
}));
vi.mock("@/app/actions/audit/log-audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { listConsentQueue } from "@/app/actions/meeting/consent";

function transcript(over: Record<string, unknown>) {
  return {
    id: "tx_1",
    title: "Sprint Review",
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    consentState: "PENDING",
    consentGrantedBy: null,
    consentGrantedRef: null,
    consentGrantedAt: null,
    integration: { consentMode: "PER_MEETING", standingConsentRef: null },
    _count: { insights: 0 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTenantSession.mockResolvedValue({
    tenantId: "tenant_1",
    userId: "user_1",
    role: "DEV",
  });
  mocks.headers.mockResolvedValue({});
  mocks.userFindMany.mockResolvedValue([]);
});

describe("listConsentQueue", () => {
  it("scopes the query to the caller's tenant", async () => {
    mocks.transcriptFindMany.mockResolvedValue([]);

    await listConsentQueue();

    expect(mocks.transcriptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant_1" },
      })
    );
  });

  it("orders PENDING first, then GRANTED, then DENIED/REVOKED as history — ties broken by recency", async () => {
    // DB returns createdAt desc (as ordered by the query); the function
    // groups by consentState without breaking that recency order within a
    // group, because Array.prototype.sort is stable.
    mocks.transcriptFindMany.mockResolvedValue([
      transcript({
        id: "denied_new",
        consentState: "DENIED",
        createdAt: new Date("2026-08-04"),
      }),
      transcript({
        id: "granted_new",
        consentState: "GRANTED",
        createdAt: new Date("2026-08-03"),
      }),
      transcript({
        id: "pending_new",
        consentState: "PENDING",
        createdAt: new Date("2026-08-02"),
      }),
      transcript({
        id: "revoked_old",
        consentState: "REVOKED",
        createdAt: new Date("2026-08-01"),
      }),
      transcript({
        id: "pending_old",
        consentState: "PENDING",
        createdAt: new Date("2026-07-30"),
      }),
    ]);

    const res = await listConsentQueue();

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.rows.map((r) => r.id)).toEqual([
      "pending_new",
      "pending_old",
      "granted_new",
      "denied_new",
      "revoked_old",
    ]);
  });

  it("resolves consentGrantedBy to a display name via a batched user lookup", async () => {
    mocks.transcriptFindMany.mockResolvedValue([
      transcript({
        id: "tx_granted",
        consentState: "GRANTED",
        consentGrantedBy: "user_9",
        consentGrantedAt: new Date("2026-08-01T12:00:00.000Z"),
      }),
    ]);
    mocks.userFindMany.mockResolvedValue([
      { id: "user_9", name: "Helena Souza" },
    ]);

    const res = await listConsentQueue();

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["user_9"] } },
      select: { id: true, name: true },
    });
    expect(res.data.rows[0].grantedByName).toBe("Helena Souza");
  });

  it("skips the user lookup when no row was manually granted", async () => {
    mocks.transcriptFindMany.mockResolvedValue([
      transcript({
        id: "tx_standing",
        consentState: "GRANTED",
        consentGrantedBy: null,
        consentGrantedRef: "Política de IA v2",
        integration: {
          consentMode: "STANDING",
          standingConsentRef: "Política de IA v2",
        },
      }),
    ]);

    const res = await listConsentQueue();

    expect(res.ok).toBe(true);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    if (!res.ok) return;
    expect(res.data.rows[0].grantedByRef).toBe("Política de IA v2");
    expect(res.data.rows[0].grantedByName).toBeNull();
  });

  it("counts derived insights regardless of status", async () => {
    mocks.transcriptFindMany.mockResolvedValue([
      transcript({ id: "tx_1", _count: { insights: 3 } }),
    ]);

    const res = await listConsentQueue();

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.rows[0].insightCount).toBe(3);
  });

  it("podeAgir is true for ADMIN/STE/RTE and false otherwise", async () => {
    mocks.transcriptFindMany.mockResolvedValue([]);

    mocks.requireTenantSession.mockResolvedValue({
      tenantId: "tenant_1",
      userId: "user_1",
      role: "RTE",
    });
    const admin = await listConsentQueue();
    expect(admin.ok && admin.data.podeAgir).toBe(true);

    mocks.requireTenantSession.mockResolvedValue({
      tenantId: "tenant_1",
      userId: "user_1",
      role: "DEV",
    });
    const dev = await listConsentQueue();
    expect(dev.ok && dev.data.podeAgir).toBe(false);
    expect(dev.ok && dev.data.quemPode).toMatch(/ADMIN/);
  });

  it("returns err when the session lookup throws", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("no session"));

    const res = await listConsentQueue();

    expect(res.ok).toBe(false);
  });
});

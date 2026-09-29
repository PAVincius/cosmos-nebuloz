import { beforeEach, describe, expect, it, vi } from "vitest";

// Métricas de produto (SC-PM-04): leitura agregada da organização, para a
// consultora. Guard e matriz reais; só o banco é simulado.

const h = vi.hoisted(() => ({
  role: "CONSULTANT" as string | null,
  requireTenantSession: vi.fn(),
  delCount: vi.fn(),
  eventFindMany: vi.fn(),
  trackCount: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@repo/auth/server", () => ({
  AuthError: h.AuthError,
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/rbac", async () => {
  const matrix = await import("../../../../packages/rbac/src/scaffold-matrix");
  return {
    ...matrix,
    hasModule: async () => true,
    getScaffoldRole: async () => h.role,
  };
});
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldDeliverableInstance: { count: h.delCount },
      scaffoldDeliverableEvent: { findMany: h.eventFindMany },
      scaffoldTrack: { count: h.trackCount },
    }),
}));

import { getProductMetrics } from "@/app/(scaffold)/actions/metrics";

beforeEach(() => {
  vi.clearAllMocks();
  h.role = "CONSULTANT";
  h.requireTenantSession.mockResolvedValue({
    tenantId: "t1",
    userId: "u1",
    role: "ADMIN",
    user: { name: "Marina", email: "m@x.com" },
  });
  // 1ª chamada: iniciados; 2ª: com resumo.
  h.delCount.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
  h.eventFindMany.mockResolvedValue([
    {
      deliverableId: "a",
      action: "SUBMIT",
      createdAt: new Date("2026-09-10T00:00:00Z"),
    },
    {
      deliverableId: "a",
      action: "APPROVE",
      createdAt: new Date("2026-09-10T10:00:00Z"),
    },
  ]);
  h.trackCount.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
});

describe("getProductMetrics", () => {
  it.each(["CONSULTANT", "ADMIN"])("%s lê", async (role) => {
    h.role = role;
    const r = await getProductMetrics();
    expect(r.ok).toBe(true);
  });

  it.each([
    "TRANSFORMATION_LEAD",
    "PROCESS_OWNER",
    "TEAM_MEMBER",
    "SPONSOR",
    "TEAM_LEAD",
  ])("%s recebe erro de permissão, sem consultar nada", async (role) => {
    h.role = role;
    const r = await getProductMetrics();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("Requer papel");
    expect(h.delCount).not.toHaveBeenCalled();
    expect(h.eventFindMany).not.toHaveBeenCalled();
  });

  it("calcula as quatro métricas a partir dos dados do tenant", async () => {
    const r = await getProductMetrics();
    expect(r.ok && r.data).toEqual({
      summaryCoverage: { withSummary: 3, started: 8, percent: 38 },
      reviewTime: { reviews: 1, averageHours: 10 },
      adjustmentRate: { adjustments: 0, decisions: 1, percent: 0 },
      catalogStarts: { fromCatalog: 3, total: 4, percent: 75 },
    });
  });

  it("toda consulta é do tenant da sessão", async () => {
    await getProductMetrics();
    for (const call of h.delCount.mock.calls) {
      expect(call[0].where.tenantId).toBe("t1");
    }
    expect(h.eventFindMany.mock.calls[0]?.[0].where.tenantId).toBe("t1");
    for (const call of h.trackCount.mock.calls) {
      expect(call[0].where.tenantId).toBe("t1");
    }
  });

  it("resumo só entre os entregáveis já iniciados, e só os que têm resumo", async () => {
    await getProductMetrics();
    expect(h.delCount.mock.calls[0]?.[0].where).toEqual({
      tenantId: "t1",
      status: { not: "NOT_STARTED" },
    });
    expect(h.delCount.mock.calls[1]?.[0].where).toEqual({
      tenantId: "t1",
      status: { not: "NOT_STARTED" },
      summary: { not: null },
    });
  });

  it("lê só os eventos de revisão, sem trazer comentário nem quem agiu", async () => {
    await getProductMetrics();
    const q = h.eventFindMany.mock.calls[0]?.[0];
    expect(q.where.action).toEqual({
      in: ["SUBMIT", "APPROVE", "REQUEST_ADJUSTMENT"],
    });
    expect(Object.keys(q.select).sort()).toEqual([
      "action",
      "createdAt",
      "deliverableId",
    ]);
  });

  it("trilhas pelo catálogo: as sem lacuna do Meridian", async () => {
    await getProductMetrics();
    expect(h.trackCount.mock.calls[0]?.[0].where).toEqual({ tenantId: "t1" });
    expect(h.trackCount.mock.calls[1]?.[0].where).toEqual({
      tenantId: "t1",
      sourceGapId: null,
    });
  });

  it("organização nova, sem nada: percentuais nulos, sem quebrar", async () => {
    h.delCount.mockReset().mockResolvedValue(0);
    h.trackCount.mockReset().mockResolvedValue(0);
    h.eventFindMany.mockResolvedValue([]);
    const r = await getProductMetrics();
    expect(r.ok && r.data.summaryCoverage.percent).toBeNull();
    expect(r.ok && r.data.reviewTime.averageHours).toBeNull();
    expect(r.ok && r.data.adjustmentRate.percent).toBeNull();
    expect(r.ok && r.data.catalogStarts.percent).toBeNull();
  });
});

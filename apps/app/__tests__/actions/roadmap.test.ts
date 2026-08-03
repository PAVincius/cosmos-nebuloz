import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  roadmapItemFindMany: vi.fn(),
  roadmapItemFindFirst: vi.fn(),
  roadmapItemUpdate: vi.fn(),
  roadmapItemCount: vi.fn(),
  artFindMany: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    roadmapItem: {
      findMany: h.roadmapItemFindMany,
      findFirst: h.roadmapItemFindFirst,
      update: h.roadmapItemUpdate,
      count: h.roadmapItemCount,
    },
    aRT: { findMany: h.artFindMany },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  listRoadmapItems,
  moveRoadmapItemToQuarter,
} from "../../app/(cosmos)/actions/roadmap";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.roadmapItemFindMany.mockResolvedValue([
    {
      id: "ri1",
      title: "Migração multi-tenant",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-01"),
      color: "#6366f1",
      status: "IN_PROGRESS",
      milestone: true,
      artId: "art1",
    },
  ]);
  h.artFindMany.mockResolvedValue([{ id: "art1", name: "ART Norte" }]);
});

describe("listRoadmapItems", () => {
  it("returns tenant-scoped roadmap items with ISO date strings and resolved ART name", async () => {
    const r = await listRoadmapItems();
    expect(r.ok).toBe(true);
    expect(database.roadmapItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    expect(database.aRT.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["art1"] }, tenantId: tenantCtx.tenantId },
      select: { id: true, name: true },
    });
    if (r.ok) {
      expect(typeof r.data[0].startDate).toBe("string");
      expect(r.data[0].milestone).toBe(true);
      expect(r.data[0].artId).toBe("art1");
      expect(r.data[0].artName).toBe("ART Norte");
    }
  });

  it("does not query ARTs when no item carries an artId", async () => {
    h.roadmapItemFindMany.mockResolvedValueOnce([
      {
        id: "ri2",
        title: "Sem ART",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
        color: "#6366f1",
        status: "PLANNED",
        milestone: false,
        artId: null,
      },
    ]);

    const r = await listRoadmapItems();
    expect(r.ok).toBe(true);
    expect(database.aRT.findMany).not.toHaveBeenCalled();
    if (r.ok) {
      expect(r.data[0].artId).toBeNull();
      expect(r.data[0].artName).toBeNull();
    }
  });

  it("never resolves an artId that belongs to another tenant (ART lookup is itself tenant-scoped)", async () => {
    // RoadmapItem.artId is a plain app-layer string with no FK relation, so a
    // stale/foreign id must resolve to null, never leak another tenant's ART.
    h.roadmapItemFindMany.mockResolvedValueOnce([
      {
        id: "ri3",
        title: "Item com ART de outro tenant",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
        color: "#6366f1",
        status: "PLANNED",
        milestone: false,
        artId: "foreign-art",
      },
    ]);
    // Simulates the tenant-scoped query correctly finding nothing for a
    // foreign-tenant id.
    h.artFindMany.mockResolvedValueOnce([]);

    const r = await listRoadmapItems();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].artId).toBe("foreign-art");
      expect(r.data[0].artName).toBeNull();
    }
  });
});

describe("moveRoadmapItemToQuarter", () => {
  beforeEach(() => {
    h.roadmapItemFindFirst.mockResolvedValue({
      id: "ri1",
      title: "Migração multi-tenant",
      // 36 dias de duração
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      endDate: new Date("2026-02-10T00:00:00.000Z"),
      artId: "art1",
    });
    h.roadmapItemCount.mockResolvedValue(0);
    h.roadmapItemUpdate.mockResolvedValue({ id: "ri1" });
  });

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await moveRoadmapItemToQuarter({
      id: "ri1",
      year: 2027,
      quarter: 3,
    });

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO"],
      tenantCtx
    );
    expect(h.roadmapItemUpdate).not.toHaveBeenCalled();
  });

  it("recusa um id que não é do tenant (guarda IDOR)", async () => {
    h.roadmapItemFindFirst.mockResolvedValue(null);

    const res = await moveRoadmapItemToQuarter({
      id: "alheio",
      year: 2027,
      quarter: 3,
    });

    expect(res.ok).toBe(false);
    expect(h.roadmapItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alheio", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.roadmapItemUpdate).not.toHaveBeenCalled();
  });

  it("põe o início no primeiro dia do trimestre e preserva a duração (AC-001)", async () => {
    const res = await moveRoadmapItemToQuarter({
      id: "ri1",
      year: 2027,
      quarter: 3,
    });

    expect(res.ok).toBe(true);
    expect(h.roadmapItemUpdate).toHaveBeenCalledWith({
      where: { id: "ri1" },
      data: {
        // Q3 2027 começa em 1º de julho
        startDate: new Date("2027-07-01T00:00:00.000Z"),
        // + os mesmos 36 dias que o item tinha
        endDate: new Date("2027-08-06T00:00:00.000Z"),
      },
      select: { id: true },
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        entityType: "roadmap_item",
        entityId: "ri1",
        diff: { quarter: "2026-Q1→2027-Q3" },
      })
    );
    expect(h.revalidatePath).toHaveBeenCalledWith("/cosmos/roadmap");
  });

  it("corrige o intervalo já invertido em vez de propagá-lo (AC-002)", async () => {
    h.roadmapItemFindFirst.mockResolvedValue({
      id: "ri1",
      title: "Item corrompido",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      endDate: new Date("2026-01-01T00:00:00.000Z"),
      artId: null,
    });

    const res = await moveRoadmapItemToQuarter({
      id: "ri1",
      year: 2026,
      quarter: 4,
    });

    expect(res.ok).toBe(true);
    expect(h.roadmapItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          endDate: new Date("2026-10-01T00:00:00.000Z"),
        },
      })
    );
  });

  it("recusa o 26º item do ART no trimestre destino, citando o teto (AC-003)", async () => {
    h.roadmapItemCount.mockResolvedValue(25);

    const res = await moveRoadmapItemToQuarter({
      id: "ri1",
      year: 2027,
      quarter: 3,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("25");
    }
    expect(h.roadmapItemUpdate).not.toHaveBeenCalled();
  });

  it("não conta o próprio item contra o teto (AC-003)", async () => {
    h.roadmapItemCount.mockResolvedValue(24);

    await moveRoadmapItemToQuarter({ id: "ri1", year: 2026, quarter: 1 });

    expect(h.roadmapItemCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          artId: "art1",
          id: { not: "ri1" },
        }),
      })
    );
  });

  it("conta o teto sobre os itens sem ART quando o item não tem ART (AC-003)", async () => {
    h.roadmapItemFindFirst.mockResolvedValue({
      id: "ri2",
      title: "Sem ART",
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      endDate: new Date("2026-01-20T00:00:00.000Z"),
      artId: null,
    });

    await moveRoadmapItemToQuarter({ id: "ri2", year: 2027, quarter: 1 });

    expect(h.roadmapItemCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ artId: null }),
      })
    );
  });

  it("recusa trimestre fora de 1–4 antes de qualquer consulta (AC-004)", async () => {
    const res = await moveRoadmapItemToQuarter({
      id: "ri1",
      year: 2027,
      quarter: 5,
    });

    expect(res.ok).toBe(false);
    expect(h.roadmapItemFindFirst).not.toHaveBeenCalled();
    expect(h.roadmapItemUpdate).not.toHaveBeenCalled();
  });
});

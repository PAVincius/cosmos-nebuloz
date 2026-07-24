import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    roadmapItem: {
      findMany: vi.fn().mockResolvedValue([
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
      ]),
    },
    aRT: {
      findMany: vi.fn().mockResolvedValue([{ id: "art1", name: "ART Norte" }]),
    },
  },
}));

import { database } from "@repo/database";
import { listRoadmapItems } from "../../app/(cosmos)/actions/roadmap";

describe("listRoadmapItems", () => {
  it("returns tenant-scoped roadmap items with ISO date strings and resolved ART name", async () => {
    const r = await listRoadmapItems();
    expect(r.ok).toBe(true);
    expect(database.roadmapItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    expect(database.aRT.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["art1"] }, tenantId: "t1" },
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
    vi.mocked(database.roadmapItem.findMany).mockResolvedValueOnce([
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
    ] as never);
    vi.mocked(database.aRT.findMany).mockClear();

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
    vi.mocked(database.roadmapItem.findMany).mockResolvedValueOnce([
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
    ] as never);
    // Simulates the tenant-scoped query correctly finding nothing for a
    // foreign-tenant id.
    vi.mocked(database.aRT.findMany).mockResolvedValueOnce([]);

    const r = await listRoadmapItems();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].artId).toBe("foreign-art");
      expect(r.data[0].artName).toBeNull();
    }
  });
});

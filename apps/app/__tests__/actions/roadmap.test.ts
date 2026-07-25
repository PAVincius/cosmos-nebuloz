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
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listRoadmapItems } from "../../app/(cosmos)/actions/roadmap";

describe("listRoadmapItems", () => {
  it("returns tenant-scoped roadmap items with ISO date strings", async () => {
    const r = await listRoadmapItems();
    expect(r.ok).toBe(true);
    expect(database.roadmapItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(typeof r.data[0].startDate).toBe("string");
      expect(r.data[0].milestone).toBe(true);
    }
  });
});

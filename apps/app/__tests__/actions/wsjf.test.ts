import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "e1", title: "Epic A", artId: "pay", wsjf: 10, sizePoints: 5 },
        ]),
    },
    feature: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "f1",
          title: "Feature B",
          artScopedId: "plat",
          wsjfScore: 15,
          storyPoints: 3,
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listWsjfItems } from "../../app/(cosmos)/actions/wsjf";

describe("listWsjfItems", () => {
  it("merges epics and features, sorted by wsjf desc, tenant-scoped", async () => {
    const r = await listWsjfItems();
    expect(r.ok).toBe(true);
    expect(database.epic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
    expect(database.feature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
    if (r.ok) {
      expect(r.data[0].id).toBe("f1"); // wsjf 15 > 10, ranked first
      expect(r.data[0].rank).toBe(1);
      expect(r.data[1].id).toBe("e1");
      expect(r.data[1].rank).toBe(2);
    }
  });
});

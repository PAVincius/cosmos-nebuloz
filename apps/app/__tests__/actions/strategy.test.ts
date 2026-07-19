import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    strategyPillar: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "p1",
          name: "Crescimento",
          tone: "accent",
          themes: [
            {
              id: "th1",
              title: "Expansão LATAM",
              healthStatus: "on",
              targetAllocationPct: 25,
            },
          ],
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listStrategyPillars } from "../../app/(cosmos)/actions/strategy";

describe("listStrategyPillars", () => {
  it("returns tenant-scoped pillars with nested themes", async () => {
    const r = await listStrategyPillars();
    expect(r.ok).toBe(true);
    expect(database.strategyPillar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].themes[0].title).toBe("Expansão LATAM");
    }
  });
});

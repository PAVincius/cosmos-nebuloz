import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    strategicTheme: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "th1",
          title: "Expansão LATAM",
          description: null,
          color: "#6366f1",
          healthStatus: "on",
          targetAllocationPct: 25,
          horizon: "PI-26",
          epics: [
            { featureCount: 4, doneFeatureCount: 2 },
            { featureCount: 2, doneFeatureCount: 2 },
          ],
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listThemes } from "../../app/(cosmos)/actions/themes";

describe("listThemes", () => {
  it("returns tenant-scoped themes with computed epic count and avg progress", async () => {
    const r = await listThemes();
    expect(r.ok).toBe(true);
    expect(database.strategicTheme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].epicCount).toBe(2);
      expect(r.data[0].avgProgress).toBe(75); // (50 + 100) / 2
    }
  });
});

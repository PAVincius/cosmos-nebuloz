import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    risk: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "r1",
          title: "Latência antifraude",
          roamStatus: "OWNED",
          severity: 4,
          probability: "high",
          impact: "high",
          category: "TECHNICAL",
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listRisks } from "../../app/(cosmos)/actions/risks";

describe("listRisks", () => {
  it("returns tenant-scoped risks ordered by severity desc", async () => {
    const r = await listRisks();
    expect(r.ok).toBe(true);
    expect(database.risk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].title).toBe("Latência antifraude");
    }
  });
});

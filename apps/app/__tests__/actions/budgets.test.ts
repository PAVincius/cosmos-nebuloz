import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    leanBudget: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "b1",
          name: "Payments PI-26",
          amount: 100,
          spent: "62",
          period: "PI-26",
          capexPct: 60,
          opexPct: 40,
          strategicTheme: { title: "Expansão LATAM" },
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listLeanBudgets } from "../../app/(cosmos)/actions/budgets";

describe("listLeanBudgets", () => {
  it("returns tenant-scoped budgets with computed utilization", async () => {
    const r = await listLeanBudgets();
    expect(r.ok).toBe(true);
    expect(database.leanBudget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].themeName).toBe("Expansão LATAM");
      expect(r.data[0].utilizationPct).toBe(62);
    }
  });
});

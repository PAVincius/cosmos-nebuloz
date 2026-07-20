import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));

vi.mock("@repo/database", () => ({
  database: {
    solutionTrain: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "s1",
          name: "Solution Pagamentos",
          description: null,
          arts: [{ id: "a1" }, { id: "a2" }],
          solutionEpics: [{ id: "e1" }],
          capabilities: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listSolutionTrains } from "../../app/(cosmos)/actions/solution-train";

describe("listSolutionTrains", () => {
  it("returns tenant-scoped solution trains with computed counts", async () => {
    const r = await listSolutionTrains();
    expect(r.ok).toBe(true);
    expect(database.solutionTrain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data).toHaveLength(1);
      expect(r.data[0]).toEqual({
        id: "s1",
        name: "Solution Pagamentos",
        description: null,
        artCount: 2,
        epicCount: 1,
        capabilityCount: 3,
      });
    }
  });
});

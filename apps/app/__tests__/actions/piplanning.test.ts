import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    pIPlan: {
      findFirst: vi.fn().mockResolvedValue({
        id: "pi1",
        name: "PI-26",
        piObjectives: [
          {
            id: "o1",
            title: "Objetivo A",
            businessValue: 8,
            status: "IN_PROGRESS",
            isStretch: false,
          },
        ],
        risks: [{ id: "r1", title: "Risco A", roamStatus: "OWNED" }],
      }),
    },
    confidenceVoteTally: {
      findFirst: vi.fn().mockResolvedValue({ aggregateScore: 3.8 }),
    },
  },
}));

import { database } from "@repo/database";
import { getActivePiPlanning } from "../../app/(cosmos)/actions/piplanning";

describe("getActivePiPlanning", () => {
  it("returns tenant-scoped objectives, risks, and confidence average", async () => {
    const r = await getActivePiPlanning();
    expect(r.ok).toBe(true);
    expect(database.pIPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
    if (r.ok && r.data) {
      expect(r.data.objectives[0].title).toBe("Objetivo A");
      expect(r.data.risks[0].roamStatus).toBe("OWNED");
      expect(r.data.confidenceAvg).toBe(3.8);
    }
    expect(database.confidenceVoteTally.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", piPlanId: "pi1" }),
      })
    );
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    competencyAssessment: {
      findMany: vi.fn().mockResolvedValue([
        {
          competency: "TEAM_TECHNICAL_AGILITY",
          score: 4.1,
          assessedAt: new Date("2026-02-01"),
        },
        {
          competency: "TEAM_TECHNICAL_AGILITY",
          score: 3.8,
          assessedAt: new Date("2026-01-01"),
        },
        {
          competency: "AGILE_PRODUCT_DELIVERY",
          score: 3.5,
          assessedAt: new Date("2026-02-01"),
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listCompetencyScores } from "../../app/(cosmos)/actions/measure";

describe("listCompetencyScores", () => {
  it("returns the 7 SAFe competencies, tenant-scoped, with the latest score per competency", async () => {
    const r = await listCompetencyScores();
    expect(r.ok).toBe(true);
    expect(database.competencyAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data).toHaveLength(7);
      const tta = r.data.find((c) => c.competency === "TEAM_TECHNICAL_AGILITY");
      expect(tta?.score).toBe(4.1); // latest by assessedAt, not first array item
      const apd = r.data.find((c) => c.competency === "AGILE_PRODUCT_DELIVERY");
      expect(apd?.score).toBe(3.5);
      const noData = r.data.find(
        (c) => c.competency === "LEAN_AGILE_LEADERSHIP"
      );
      expect(noData?.score).toBeNull();
    }
  });

  it("computes the prev-cycle delta from the second-most-recent assessment", async () => {
    const r = await listCompetencyScores();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const tta = r.data.find((c) => c.competency === "TEAM_TECHNICAL_AGILITY");
      // latest 4.1, prior 3.8 -> delta +0.3
      expect(tta?.prevScore).toBe(3.8);
      expect(tta?.delta).toBe(0.3);

      const apd = r.data.find((c) => c.competency === "AGILE_PRODUCT_DELIVERY");
      // only one assessment on record -> no prior cycle, honest null
      expect(apd?.prevScore).toBeNull();
      expect(apd?.delta).toBeNull();
    }
  });
});

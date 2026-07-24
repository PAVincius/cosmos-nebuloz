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
            plannedValue: 10,
            achievedValue: 7,
            teamId: "tm1",
          },
        ],
        risks: [{ id: "r1", title: "Risco A", roamStatus: "OWNED" }],
        sprints: [{ name: "Sprint 3" }],
      }),
      findMany: vi.fn().mockResolvedValue([
        { id: "piB", name: "PI Mais Recente", ppm: 88 },
        { id: "piA", name: "PI Anterior", ppm: 81.4 },
      ]),
    },
    team: {
      findMany: vi.fn().mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]),
    },
    confidenceVoteTally: {
      findFirst: vi.fn().mockResolvedValue({ aggregateScore: 3.8 }),
    },
    aRT: {
      count: vi.fn().mockResolvedValue(3),
    },
  },
}));

import { database } from "@repo/database";
import {
  getActiveArtCount,
  getActivePiPlanning,
  listRecentPiPredictability,
} from "../../app/(cosmos)/actions/piplanning";

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
      expect(r.data.activeSprintName).toBe("Sprint 3");
      expect(r.data.objectives[0].plannedValue).toBe(10);
      expect(r.data.objectives[0].achievedValue).toBe(7);
      expect(r.data.objectives[0].teamName).toBe("Squad Alpha");
    }
    expect(database.confidenceVoteTally.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", piPlanId: "pi1" }),
      })
    );
    expect(database.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", id: { in: ["tm1"] } }),
      })
    );
  });
});

describe("listRecentPiPredictability", () => {
  it("returns tenant-scoped closed-PI PPM history, oldest→newest", async () => {
    const r = await listRecentPiPredictability();
    expect(r.ok).toBe(true);
    expect(database.pIPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          status: "CLOSED",
          ppm: { not: null },
        }),
      })
    );
    if (r.ok) {
      expect(r.data.map((p) => p.label)).toEqual([
        "PI Anterior",
        "PI Mais Recente",
      ]);
      expect(r.data[1].ppmPct).toBe(88);
    }
  });
});

describe("getActiveArtCount", () => {
  it("returns the tenant-scoped count of active ARTs", async () => {
    const r = await getActiveArtCount();
    expect(r.ok).toBe(true);
    expect(database.aRT.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", status: "ACTIVE" }),
      })
    );
    if (r.ok) {
      expect(r.data).toBe(3);
    }
  });
});

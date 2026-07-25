import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    sprint: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "s1", name: "Sprint 12", capacity: 40, velocity: 35 },
        ]),
    },
  },
}));

import { database } from "@repo/database";
import {
  listRecentSprints,
  listTeamPredictability,
} from "../../app/(cosmos)/actions/velocity";

describe("listRecentSprints", () => {
  it("returns tenant-scoped closed sprints with computed say-do ratio", async () => {
    const r = await listRecentSprints();
    expect(r.ok).toBe(true);
    expect(database.sprint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", status: "CLOSED" },
      })
    );
    if (r.ok) {
      expect(r.data[0].sayDoRatioPct).toBe(88);
    }
  });
});

describe("listTeamPredictability", () => {
  it("is tenant-scoped to closed sprints with capacity and velocity", async () => {
    vi.mocked(database.sprint.findMany).mockResolvedValueOnce([
      {
        teamId: "team-1",
        capacity: 40,
        velocity: 36,
        team: { name: "Squad Atlas" },
      },
    ] as never);

    const r = await listTeamPredictability();
    expect(r.ok).toBe(true);
    expect(database.sprint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t1",
          status: "CLOSED",
          capacity: { not: null },
          velocity: { not: null },
        },
      })
    );
  });

  it("averages the say-do ratio per team across multiple closed sprints", async () => {
    vi.mocked(database.sprint.findMany).mockResolvedValueOnce([
      {
        teamId: "team-1",
        capacity: 40,
        velocity: 40,
        team: { name: "Squad Atlas" },
      },
      {
        teamId: "team-1",
        capacity: 40,
        velocity: 20,
        team: { name: "Squad Atlas" },
      },
      {
        teamId: "team-2",
        capacity: 30,
        velocity: 30,
        team: { name: "Squad Orion" },
      },
    ] as never);

    const r = await listTeamPredictability();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(2);
      const atlas = r.data.find((t) => t.teamId === "team-1");
      // (100% + 50%) / 2 = 75%
      expect(atlas?.predictabilityPct).toBe(75);
      expect(atlas?.sprintCount).toBe(2);
      const orion = r.data.find((t) => t.teamId === "team-2");
      expect(orion?.predictabilityPct).toBe(100);
      // best-first
      expect(r.data[0].teamId).toBe("team-2");
    }
  });
});

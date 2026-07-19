import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    team: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "tm1", name: "Squad Alpha", velocity: 40 }]),
    },
    teamCapacitySnapshot: {
      findMany: vi.fn().mockResolvedValue([
        {
          teamId: "tm1",
          expectedSpNextSprint: 38,
          actualSpDelivered: 35,
          actualCapacityUtil: 0.92,
          recordedAt: new Date(),
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listTeamCapacity } from "../../app/(cosmos)/actions/capacity";

describe("listTeamCapacity", () => {
  it("returns tenant-scoped teams joined to their latest capacity snapshot", async () => {
    const r = await listTeamCapacity();
    expect(r.ok).toBe(true);
    expect(database.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].teamName).toBe("Squad Alpha");
      expect(r.data[0].actualSp).toBe(35);
      expect(r.data[0].utilizationPct).toBe(92);
    }
  });
});

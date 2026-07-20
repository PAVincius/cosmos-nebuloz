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
      findMany: vi.fn().mockResolvedValue([
        {
          id: "tm1",
          name: "Squad Alpha",
          focusArea: "Pagamentos",
          color: "#2563eb",
          wip: 5,
          velocity: 40,
          members: [{ name: "Ana" }, { name: "Bruno" }],
        },
      ]),
      findFirst: vi.fn(),
    },
    teamCapacitySnapshot: {
      findMany: vi.fn(),
    },
  },
}));

import { database } from "@repo/database";
import { getTeam, listTeams } from "../../app/(cosmos)/actions/teams";

describe("listTeams", () => {
  it("returns tenant-scoped teams with computed member count", async () => {
    const r = await listTeams();
    expect(r.ok).toBe(true);
    expect(database.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].memberCount).toBe(2);
    }
  });
});

describe("getTeam", () => {
  it("returns tenant-scoped team detail with members and recent capacity", async () => {
    (
      database as never as {
        teamCapacitySnapshot: { findMany: ReturnType<typeof vi.fn> };
      }
    ).teamCapacitySnapshot = {
      findMany: vi.fn().mockResolvedValue([
        {
          recordedAt: new Date("2026-01-01"),
          expectedSpNextSprint: 38,
          actualSpDelivered: 35,
        },
      ]),
    };
    (
      database.team as never as { findFirst: ReturnType<typeof vi.fn> }
    ).findFirst = vi.fn().mockResolvedValue({
      id: "tm1",
      name: "Squad Alpha",
      focusArea: "Pagamentos",
      velocity: 40,
      wip: 5,
      members: [{ name: "Ana", role: "Lead" }],
    });
    const r = await getTeam("tm1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data?.members[0].name).toBe("Ana");
      expect(r.data?.recentCapacity[0].actualSp).toBe(35);
    }
  });
});

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
    },
  },
}));

import { database } from "@repo/database";
import { listTeams } from "../../app/(cosmos)/actions/teams";

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

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
        features: [
          {
            id: "f1",
            title: "Feature A",
            storyPoints: 5,
            statusId: "IN_PROGRESS",
            assignedTeamId: "tm1",
          },
        ],
      }),
    },
    team: {
      findMany: vi.fn().mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]),
    },
  },
}));

import { database } from "@repo/database";
import { getActiveProgramBoard } from "../../app/(cosmos)/actions/program";

describe("getActiveProgramBoard", () => {
  it("returns tenant-scoped teams with their assigned features", async () => {
    const r = await getActiveProgramBoard();
    expect(r.ok).toBe(true);
    expect(database.pIPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
    if (r.ok && r.data) {
      expect(r.data.teams[0].name).toBe("Squad Alpha");
      expect(r.data.teams[0].features[0].title).toBe("Feature A");
    }
  });
});

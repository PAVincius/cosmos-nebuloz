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
import { listRecentSprints } from "../../app/(cosmos)/actions/velocity";

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

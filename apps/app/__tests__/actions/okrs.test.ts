import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    oKR: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "o1",
          title: "Crescer TPV",
          status: "ON_TRACK",
          ownerId: "u1",
          keyResults: [
            {
              id: "kr1",
              title: "TPV anual",
              current: 30,
              target: 100,
              unit: "bi",
            },
          ],
        },
      ]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([{ id: "u1", name: "Marina Alves" }]),
    },
  },
}));

import { database } from "@repo/database";
import { listOkrs } from "../../app/(cosmos)/actions/okrs";

describe("listOkrs", () => {
  it("returns tenant-scoped OKRs with resolved owner names and KR progress", async () => {
    const r = await listOkrs();
    expect(r.ok).toBe(true);
    expect(database.oKR.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", archivedAt: null },
      })
    );
    if (r.ok) {
      expect(r.data[0].ownerName).toBe("Marina Alves");
      expect(r.data[0].keyResults[0].progressPct).toBe(30);
    }
  });
});

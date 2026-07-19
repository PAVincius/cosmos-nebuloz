import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: { epic: { findFirst: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { database } from "@repo/database";
import { getEpic } from "../../app/(cosmos)/actions/epics";

describe("getEpic", () => {
  it("returns tenant-scoped epic with features", async () => {
    (
      database.epic.findFirst as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "e1",
      title: "X",
      lifecycleStatus: "IMPLEMENTING",
      wsjf: 12,
      sizePoints: 8,
      investScore: 70,
      investBreakdown: null,
      hypothesis: null,
      descriptionMd: null,
      features: [{ id: "f1", title: "F", wsjfScore: 3, progressPct: 50 }],
    });
    const r = await getEpic("e1");
    expect(r.ok).toBe(true);
    expect(database.epic.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1", tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data?.features[0].id).toBe("f1");
    }
  });
});

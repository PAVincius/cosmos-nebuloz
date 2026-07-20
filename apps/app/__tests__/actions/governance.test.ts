import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    governedEpic: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "g1",
          governanceStatus: "review",
          investmentEstimate: 250_000,
          submittedAt: new Date("2026-02-01"),
          epic: { title: "Migração multi-tenant" },
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listGovernedEpics } from "../../app/(cosmos)/actions/governance";

describe("listGovernedEpics", () => {
  it("returns tenant-scoped governed epics with resolved epic title", async () => {
    const r = await listGovernedEpics();
    expect(r.ok).toBe(true);
    expect(database.governedEpic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].epicTitle).toBe("Migração multi-tenant");
      expect(typeof r.data[0].submittedAt).toBe("string");
    }
  });
});

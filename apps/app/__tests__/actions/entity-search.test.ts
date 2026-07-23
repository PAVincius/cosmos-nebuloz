import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findMany: vi.fn().mockResolvedValue([
        { id: "e1", title: "Antifraude em tempo real" },
        { id: "e2", title: "Onboarding digital" },
      ]),
    },
    feature: { findMany: vi.fn().mockResolvedValue([]) },
    team: { findMany: vi.fn().mockResolvedValue([]) },
    strategicTheme: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { database } from "@repo/database";
import { searchEntities } from "../../app/(cosmos)/actions/entity-search";

describe("searchEntities", () => {
  it("returns tenant-scoped, case-insensitive matches capped at 10", async () => {
    const r = await searchEntities("epic", "anti");
    expect(r.ok).toBe(true);
    expect(database.epic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t1",
          title: { contains: "anti", mode: "insensitive" },
        },
        take: 10,
      })
    );
    if (r.ok) {
      expect(r.data).toEqual([
        { id: "e1", label: "Antifraude em tempo real" },
        { id: "e2", label: "Onboarding digital" },
      ]);
    }
  });

  it("rejects an unknown kind", async () => {
    // @ts-expect-error — intentionally invalid kind to test runtime validation
    const r = await searchEntities("invalid", "foo");
    expect(r.ok).toBe(false);
  });
});

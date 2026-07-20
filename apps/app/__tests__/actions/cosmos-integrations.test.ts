import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    integration: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "i1",
          source: "github",
          name: "GitHub Corp",
          status: "ACTIVE",
          lastSyncAt: new Date("2026-02-01"),
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listIntegrations } from "../../app/(cosmos)/actions/integrations";

describe("listIntegrations", () => {
  it("returns tenant-scoped integrations without config/mapping fields", async () => {
    const r = await listIntegrations();
    expect(r.ok).toBe(true);
    expect(database.integration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
        select: {
          id: true,
          source: true,
          name: true,
          status: true,
          lastSyncAt: true,
        },
      })
    );
    if (r.ok) {
      expect(typeof r.data[0].lastSyncAt).toBe("string");
    }
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    dependencyLink: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "d1",
          description: "Fila depende do isolamento",
          status: "at-risk",
          boardStatus: "IDENTIFIED",
          criticalPath: true,
          blockingFeature: { title: "Tenant isolation layer" },
          blockedFeature: { title: "Pix agendado · fila" },
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listDependencies } from "../../app/(cosmos)/actions/dependencies";

describe("listDependencies", () => {
  it("returns tenant-scoped dependencies with resolved feature titles", async () => {
    const r = await listDependencies();
    expect(r.ok).toBe(true);
    expect(database.dependencyLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].blockingTitle).toBe("Tenant isolation layer");
      expect(r.data[0].blockedTitle).toBe("Pix agendado · fila");
    }
  });
});

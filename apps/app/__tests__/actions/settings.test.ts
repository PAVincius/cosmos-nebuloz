import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    tenantMember: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "m1",
          role: "ADMIN",
          user: { name: "Marina Alves", email: "marina@cosmos.local" },
        },
      ]),
    },
    tenantSSOConfig: {
      findUnique: vi.fn().mockResolvedValue({ enabled: true }),
    },
  },
}));

import { database } from "@repo/database";
import { getWorkspaceSettings } from "../../app/(cosmos)/actions/settings";

describe("getWorkspaceSettings", () => {
  it("returns tenant-scoped members and SSO status without SSO secrets", async () => {
    const r = await getWorkspaceSettings();
    expect(r.ok).toBe(true);
    expect(database.tenantMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    expect(database.tenantSSOConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data.members[0].userName).toBe("Marina Alves");
      expect(r.data.ssoEnabled).toBe(true);
    }
  });
});

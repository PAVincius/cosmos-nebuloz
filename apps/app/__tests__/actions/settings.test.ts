import { beforeEach, describe, expect, it, vi } from "vitest";

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

const matureWorkspaceMocks = vi.hoisted(() => ({
  getWorkspaceSettings: vi.fn(),
  updateWorkspace: vi.fn(),
}));
vi.mock("../../app/actions/settings/workspace", () => ({
  getWorkspaceSettings: matureWorkspaceMocks.getWorkspaceSettings,
  updateWorkspace: matureWorkspaceMocks.updateWorkspace,
}));

import { database } from "@repo/database";
import {
  getWorkspaceSettings,
  getWorkspaceTab,
  updateWorkspaceInfo,
} from "../../app/(cosmos)/actions/settings";

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

// ─── Workspace tab (thin Result<T> adapter over the mature workspace.ts) ───

describe("getWorkspaceTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps the mature layer's tenant identity into the tab's Result<T> shape", async () => {
    matureWorkspaceMocks.getWorkspaceSettings.mockResolvedValue({
      tenant: {
        id: "t1",
        name: "Acme",
        slug: "acme",
        logo: null,
        plan: "ORBIT",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      membersCount: 3,
      members: [],
      invitations: [],
      currentUserRole: "ADMIN",
    });

    const r = await getWorkspaceTab();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.tenant.name).toBe("Acme");
      expect(r.data.tenant.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(r.data.membersCount).toBe(3);
      expect(r.data.currentUserRole).toBe("ADMIN");
    }
  });

  it("returns a Result error instead of throwing when the mature layer fails", async () => {
    matureWorkspaceMocks.getWorkspaceSettings.mockRejectedValue(
      new Error("Workspace não encontrado.")
    );

    const r = await getWorkspaceTab();

    expect(r.ok).toBe(false);
  });
});

describe("updateWorkspaceInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the ADMIN-gated updateWorkspace and returns ok on success", async () => {
    matureWorkspaceMocks.updateWorkspace.mockResolvedValue(undefined);

    const r = await updateWorkspaceInfo({ name: "New Name" });

    expect(matureWorkspaceMocks.updateWorkspace).toHaveBeenCalledWith({
      name: "New Name",
    });
    expect(r.ok).toBe(true);
  });

  it("returns a Result error (not a throw) when the RBAC gate rejects", async () => {
    matureWorkspaceMocks.updateWorkspace.mockRejectedValue(
      new Error("Role MEMBER not permitted. Required: ADMIN")
    );

    const r = await updateWorkspaceInfo({ name: "New Name" });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/not permitted/);
    }
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const RX_NOT_FOUND = /não encontrado/i;
const RX_OBRIGATORIO = /obrigatório/i;
const RX_JA_MEMBRO = /já é membro/i;
const RX_NAO_PODE = /você não pode/i;
const RX_ULTIMO_ADMIN = /último administrador/i;

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  renderInviteEmail: vi.fn().mockResolvedValue("<html>invite</html>"),
  resendSend: vi.fn().mockResolvedValue({ id: "email-1" }),
  tenantFindUnique: vi.fn(),
  tenantUpdate: vi.fn(),
  tenantMemberCount: vi.fn(),
  tenantMemberFindMany: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  tenantMemberUpdate: vi.fn(),
  tenantMemberDelete: vi.fn(),
  tenantInvitationFindMany: vi.fn(),
  tenantInvitationCreate: vi.fn(),
  tenantInvitationUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/email", () => ({
  renderInviteEmail: mocks.renderInviteEmail,
  resend: { emails: { send: mocks.resendSend } },
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: {
      findUnique: mocks.tenantFindUnique,
      update: mocks.tenantUpdate,
    },
    tenantMember: {
      count: mocks.tenantMemberCount,
      findMany: mocks.tenantMemberFindMany,
      findFirst: mocks.tenantMemberFindFirst,
      update: mocks.tenantMemberUpdate,
      delete: mocks.tenantMemberDelete,
    },
    tenantInvitation: {
      findMany: mocks.tenantInvitationFindMany,
      create: mocks.tenantInvitationCreate,
      updateMany: mocks.tenantInvitationUpdateMany,
    },
    user: { findUnique: mocks.userFindUnique },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import {
  cancelInvitation,
  getWorkspaceSettings,
  inviteMember,
  removeMember,
  updateMemberRole,
  updateWorkspace,
} from "../../app/actions/settings/workspace";

const adminCtx = { ...tenantCtx, role: "ADMIN" as const };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(adminCtx);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.tenantFindUnique.mockResolvedValue({
    id: adminCtx.tenantId,
    name: "Acme",
    slug: "acme",
    logo: null,
    plan: "GALAXY",
    createdAt: new Date(),
  });
  mocks.tenantMemberCount.mockResolvedValue(3);
  mocks.tenantMemberFindMany.mockResolvedValue([]);
  mocks.tenantInvitationFindMany.mockResolvedValue([]);
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.tenantInvitationCreate.mockResolvedValue({ id: "inv-1" });
  mocks.tenantInvitationUpdateMany.mockResolvedValue({ count: 0 });
  mocks.tenantUpdate.mockResolvedValue({});
  mocks.tenantMemberFindFirst.mockResolvedValue(null);
  mocks.tenantMemberUpdate.mockResolvedValue({});
  mocks.tenantMemberDelete.mockResolvedValue({});
});

// ─── getWorkspaceSettings ────────────────────────────────────────────────────

describe("getWorkspaceSettings", () => {
  it("returns workspace data with currentUserRole", async () => {
    const result = await getWorkspaceSettings();
    expect(result.tenant).toMatchObject({ name: "Acme" });
    expect(result.currentUserRole).toBe("ADMIN");
    expect(result.membersCount).toBe(3);
  });

  it("throws when tenant not found", async () => {
    mocks.tenantFindUnique.mockResolvedValue(null);
    await expect(getWorkspaceSettings()).rejects.toThrow(RX_NOT_FOUND);
  });
});

// ─── updateWorkspace ─────────────────────────────────────────────────────────

describe("updateWorkspace", () => {
  it("trims name and lowercases slug", async () => {
    await updateWorkspace({ name: "  Acme Corp  ", slug: "  ACME-CORP  " });
    expect(mocks.tenantUpdate).toHaveBeenCalledWith({
      where: { id: adminCtx.tenantId },
      data: { name: "Acme Corp", slug: "acme-corp" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("sets logo to null when empty string", async () => {
    await updateWorkspace({ logo: "" });
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { logo: null } })
    );
  });

  it("skips undefined fields", async () => {
    await updateWorkspace({});
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} })
    );
  });
});

// ─── inviteMember ────────────────────────────────────────────────────────────

describe("inviteMember", () => {
  it("creates invitation and sends email", async () => {
    mocks.userFindUnique.mockResolvedValueOnce(null); // no existing user
    mocks.userFindUnique.mockResolvedValueOnce({ name: "Admin" }); // inviter
    await inviteMember("new@x.com", "PO");
    expect(mocks.tenantInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@x.com",
          role: "PO",
          status: "PENDING",
          tenantId: adminCtx.tenantId,
        }),
      })
    );
    expect(mocks.resendSend).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("throws for empty email", async () => {
    await expect(inviteMember("", "PO")).rejects.toThrow(RX_OBRIGATORIO);
  });

  it("throws when user is already a member", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "existing-user" });
    mocks.tenantMemberFindFirst.mockResolvedValue({ id: "m1" });
    await expect(inviteMember("existing@x.com", "DEV")).rejects.toThrow(
      RX_JA_MEMBRO
    );
  });

  it("cancels existing pending invitations before creating new one", async () => {
    mocks.userFindUnique.mockResolvedValueOnce(null);
    mocks.userFindUnique.mockResolvedValueOnce({ name: "Admin" });
    await inviteMember("repeat@x.com", "SM");
    expect(mocks.tenantInvitationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "repeat@x.com",
          status: "PENDING",
        }),
        data: { status: "CANCELED" },
      })
    );
  });
});

// ─── removeMember ────────────────────────────────────────────────────────────

describe("removeMember", () => {
  it("removes member and revalidates", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue({
      id: "m1",
      role: "DEV",
      userId: "other-user",
    });
    await removeMember("m1");
    expect(mocks.tenantMemberDelete).toHaveBeenCalledWith({
      where: { id: "m1" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("throws when member not found", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue(null);
    await expect(removeMember("missing")).rejects.toThrow(RX_NOT_FOUND);
  });

  it("throws when removing self", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue({
      id: "m1",
      role: "ADMIN",
      userId: adminCtx.userId,
    });
    await expect(removeMember("m1")).rejects.toThrow(RX_NAO_PODE);
  });

  it("throws when removing last admin", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue({
      id: "m1",
      role: "ADMIN",
      userId: "other-admin",
    });
    mocks.tenantMemberCount.mockResolvedValue(1);
    await expect(removeMember("m1")).rejects.toThrow(RX_ULTIMO_ADMIN);
  });
});

// ─── updateMemberRole ────────────────────────────────────────────────────────

describe("updateMemberRole", () => {
  it("updates member role", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue({ id: "m1", role: "DEV" });
    await updateMemberRole("m1", "SM");
    expect(mocks.tenantMemberUpdate).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { role: "SM" },
    });
  });

  it("throws when member not found", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue(null);
    await expect(updateMemberRole("missing", "SM")).rejects.toThrow(
      RX_NOT_FOUND
    );
  });

  it("throws when downgrading last admin", async () => {
    mocks.tenantMemberFindFirst.mockResolvedValue({ id: "m1", role: "ADMIN" });
    mocks.tenantMemberCount.mockResolvedValue(1);
    await expect(updateMemberRole("m1", "DEV")).rejects.toThrow(
      RX_ULTIMO_ADMIN
    );
  });
});

// ─── cancelInvitation ────────────────────────────────────────────────────────

describe("cancelInvitation", () => {
  it("cancels invitation and revalidates", async () => {
    await cancelInvitation("inv-1");
    expect(mocks.tenantInvitationUpdateMany).toHaveBeenCalledWith({
      where: { id: "inv-1", tenantId: adminCtx.tenantId },
      data: { status: "CANCELED" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });
});

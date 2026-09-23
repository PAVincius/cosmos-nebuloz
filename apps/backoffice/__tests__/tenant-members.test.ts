// tenant-members.test.ts — SRD FR-4.2, e sobretudo FR-4.2.4: o tenant não pode
// ficar sem dono. O README lista esse guard entre as regras que "não podem ser
// reimplementadas por aproximação" — e ele não existia no código: um grep por
// LAST_ADMIN_BLOCKED em apps e packages não retorna nada, apesar de um teste do
// app mockar essa rejeição como se a camada existisse.
//
// Nota de vocabulário: o handoff fala em OWNER; o enum MemberRole deste schema
// é ADMIN|STE|RTE|SM|PO|DEV|MEMBER, sem OWNER. ADMIN é o papel que administra o
// tenant, então é ele que o guard protege.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  revalidatePath: vi.fn(),
  tenantFindFirst: vi.fn(),
  memberFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  memberCount: vi.fn(),
  memberUpdate: vi.fn(),
  logPlatformAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: { findFirst: mocks.tenantFindFirst },
    tenantMember: {
      findMany: mocks.memberFindMany,
      findFirst: mocks.memberFindFirst,
      count: mocks.memberCount,
      update: mocks.memberUpdate,
    },
  },
}));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import {
  listTenantMembers,
  updateTenantMemberRoleAction,
} from "../app/actions/tenant-members";

const admin = {
  userId: "u-staff",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: true,
};
const tenant = { id: "t-1", slug: "vanta-saude", name: "Vanta Saúde" };
const membroAdmin = {
  id: "tm-1",
  role: "ADMIN",
  tenantId: "t-1",
  createdAt: new Date("2026-01-10T00:00:00.000Z"),
  user: { id: "u-1", name: "Ana", email: "ana@vanta.com" },
};

function resetarMocks() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
}

describe("listTenantMembers", () => {
  beforeEach(() => {
    resetarMocks();
    mocks.requirePlatformStaff.mockResolvedValue({
      ...admin,
      canWrite: false,
    });
    mocks.tenantFindFirst.mockResolvedValue(tenant);
    mocks.memberFindMany.mockResolvedValue([membroAdmin]);
  });

  it("MEMBER lê a lista — leitura é de todo staff", async () => {
    const res = await listTenantMembers("vanta-saude");

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("recusa slug inexistente sem inventar tenant", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);

    const res = await listTenantMembers("nao-existe");

    expect(res.ok).toBe(false);
    expect(mocks.memberFindMany).not.toHaveBeenCalled();
  });
});

describe("updateTenantMemberRoleAction — guard de último ADMIN", () => {
  beforeEach(() => {
    resetarMocks();
    mocks.requirePlatformStaff.mockResolvedValue(admin);
    mocks.tenantFindFirst.mockResolvedValue(tenant);
    mocks.memberFindFirst.mockResolvedValue(membroAdmin);
    mocks.memberUpdate.mockResolvedValue({ ...membroAdmin, role: "MEMBER" });
  });

  it("bloqueia rebaixar o ÚLTIMO ADMIN, nomeando o motivo", async () => {
    mocks.memberCount.mockResolvedValue(1); // ele é o único

    const res = await updateTenantMemberRoleAction({
      slug: "vanta-saude",
      memberId: "tm-1",
      role: "MEMBER",
    });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    // Nomear o motivo é parte da regra: "não pode" sem porquê faz o operador
    // tentar de novo por outro caminho.
    expect(res.error).toContain("último ADMIN");
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });

  it("permite rebaixar quando há outro ADMIN", async () => {
    mocks.memberCount.mockResolvedValue(2);

    const res = await updateTenantMemberRoleAction({
      slug: "vanta-saude",
      memberId: "tm-1",
      role: "MEMBER",
    });

    expect(res.ok).toBe(true);
    expect(mocks.memberUpdate).toHaveBeenCalled();
  });

  it("não conta ADMIN quando o alvo já não é ADMIN — promover nunca é bloqueado", async () => {
    mocks.memberFindFirst.mockResolvedValue({ ...membroAdmin, role: "DEV" });

    const res = await updateTenantMemberRoleAction({
      slug: "vanta-saude",
      memberId: "tm-1",
      role: "ADMIN",
    });

    expect(res.ok).toBe(true);
    // A contagem só importa quando se está tirando um ADMIN. Contar sempre
    // seria uma ida ao banco por mudança de papel sem nenhuma decisão a tomar.
    expect(mocks.memberCount).not.toHaveBeenCalled();
  });

  it("recusa MEMBER do back-office — mudar papel é escrita", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Seu papel no back-office permite apenas leitura.");
    });

    const res = await updateTenantMemberRoleAction({
      slug: "vanta-saude",
      memberId: "tm-1",
      role: "MEMBER",
    });

    expect(res.ok).toBe(false);
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });

  it("recusa membro de outro tenant — guard de IDOR", async () => {
    mocks.memberFindFirst.mockResolvedValue(null);

    const res = await updateTenantMemberRoleAction({
      slug: "vanta-saude",
      memberId: "tm-de-outro",
      role: "MEMBER",
    });

    expect(res.ok).toBe(false);
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });

  // PRD do back-office: papel de staff muda por SQL, não pelo painel. Sem o
  // filtro, um ADMIN promovia ou rebaixava outro staff chamando esta action
  // com o slug do tenant interno.
  it("recusa o tenant interno — papel de staff não muda por aqui", async () => {
    // Como o banco responde: sem `isSystem: false` no filtro, o slug do tenant
    // interno acha o tenant interno.
    mocks.tenantFindFirst.mockImplementation(
      async (args: { where: { slug: string; isSystem?: boolean } }) =>
        args.where.isSystem === false
          ? null
          : { id: "system", slug: "nebuloz", name: "Nebuloz" }
    );
    mocks.memberCount.mockResolvedValue(2);

    const res = await updateTenantMemberRoleAction({
      slug: "nebuloz",
      memberId: "tm-1",
      role: "MEMBER",
    });

    expect(res.ok).toBe(false);
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
    expect(mocks.logPlatformAudit).not.toHaveBeenCalled();
  });

  it("audita a mudança com papel anterior e novo", async () => {
    mocks.memberCount.mockResolvedValue(2);

    await updateTenantMemberRoleAction({
      slug: "vanta-saude",
      memberId: "tm-1",
      role: "MEMBER",
    });

    expect(mocks.logPlatformAudit).toHaveBeenCalled();
    const arg = mocks.logPlatformAudit.mock.calls[0];
    expect(JSON.stringify(arg)).toContain("ADMIN");
    expect(JSON.stringify(arg)).toContain("MEMBER");
  });
});

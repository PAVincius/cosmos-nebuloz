import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  tenantFindUniqueOrThrow: vi.fn(),
  charterSettingsFindUnique: vi.fn(),
  membershipFindMany: vi.fn(),
  membershipFindUnique: vi.fn(),
  membershipCount: vi.fn(),
  membershipUpsert: vi.fn(),
  tenantMemberFindMany: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireCtx,
}));
// setMemberCharterRole chama revalidatePath no caminho de sucesso — sem
// mock, a chamada real lança fora de um request Next.js (mesmo padrão de
// grounded-draft.test.ts).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      tenant: { findUniqueOrThrow: h.tenantFindUniqueOrThrow },
      charterSettings: { findUnique: h.charterSettingsFindUnique },
      charterMembership: {
        findMany: h.membershipFindMany,
        findUnique: h.membershipFindUnique,
        count: h.membershipCount,
        upsert: h.membershipUpsert,
      },
      tenantMember: {
        findMany: h.tenantMemberFindMany,
        findFirst: h.tenantMemberFindFirst,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  getSettings,
  setMemberCharterRole,
} from "../../app/(charter)/actions/settings";

// cuid válido: MemberRoleSchema.userId usa z.string().cuid() — "u-1" falha a
// validação de formato antes de chegar a qualquer regra de governança.
const USER_1 = "cuser0000000000000000001";
const USER_2 = "cuser0000000000000000002";

const compliance = {
  tenantId: "t-1",
  userId: USER_1,
  charterRole: "COMPLIANCE",
  user: { name: "Bia", email: "bia@x.com" },
};

describe("getSettings", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(compliance);
    h.tenantFindUniqueOrThrow.mockResolvedValue({
      name: "Aurora Bank",
      slug: "aurora",
    });
    h.charterSettingsFindUnique.mockResolvedValue(null);
    h.membershipFindMany.mockResolvedValue([
      {
        userId: USER_1,
        role: "COMPLIANCE",
        user: { name: "Bia", email: "bia@x.com" },
      },
    ]);
    h.tenantMemberFindMany.mockResolvedValue([
      { userId: USER_1, user: { name: "Bia", email: "bia@x.com" } },
    ]);
  });

  it("tenant novo: o único membro já tem CharterMembership, unassignedMembers vem vazia", async () => {
    const res = await getSettings();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.unassignedMembers).toEqual([]);
  });

  it("membro do tenant sem papel de Charter aparece em unassignedMembers", async () => {
    // Passo 3 da montagem manda a pessoa para /charter/settings "atribuir
    // papéis" — sem esta lista, não existe candidato para atribuir a nada.
    h.tenantMemberFindMany.mockResolvedValue([
      { userId: USER_1, user: { name: "Bia", email: "bia@x.com" } },
      { userId: USER_2, user: { name: "Caio", email: "caio@x.com" } },
    ]);

    const res = await getSettings();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.unassignedMembers).toEqual([
      { userId: USER_2, name: "Caio", email: "caio@x.com" },
    ]);
  });
});

describe("setMemberCharterRole", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(compliance);
    h.tenantMemberFindFirst.mockResolvedValue({ id: "tm-1" });
    h.membershipUpsert.mockResolvedValue({});
    h.auditCreate.mockResolvedValue({});
  });

  it("recusa tirar o papel Compliance da última pessoa que o tem", async () => {
    // O gatilho real do bug: o único Compliance do tenant trocando o próprio
    // papel pelo Select de "Membros do Charter" — sem este guard, a troca
    // passa e o tenant fica sem ninguém que atribua papel ou publique
    // política, e sem forma de reverter pelo produto.
    h.membershipFindUnique.mockResolvedValue({ role: "COMPLIANCE" });
    h.membershipCount.mockResolvedValue(1);

    const res = await setMemberCharterRole({ userId: USER_1, role: "LEGAL" });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("última pessoa com papel Compliance");
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });

  it("permite a troca quando há mais de um Compliance no tenant", async () => {
    h.membershipFindUnique.mockResolvedValue({ role: "COMPLIANCE" });
    h.membershipCount.mockResolvedValue(2);

    const res = await setMemberCharterRole({ userId: USER_1, role: "LEGAL" });

    expect(res.ok).toBe(true);
    expect(h.membershipUpsert).toHaveBeenCalled();
  });

  it("não consulta a contagem quando o alvo não é Compliance", async () => {
    // O guard só importa quando a troca de fato reduziria o número de
    // Compliance — recusar sem essa condição bloquearia toda atribuição.
    h.membershipFindUnique.mockResolvedValue({ role: "LEGAL" });

    const res = await setMemberCharterRole({
      userId: USER_2,
      role: "SECURITY",
    });

    expect(res.ok).toBe(true);
    expect(h.membershipCount).not.toHaveBeenCalled();
  });
});

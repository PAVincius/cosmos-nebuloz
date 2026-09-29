import { beforeEach, describe, expect, it, vi } from "vitest";

// Atribuição de papel de adoção — SA-05.
//
// O guard e a matriz são os REAIS: o que se quer provar é que TEAM_MEMBER é
// barrado pela matriz de verdade, e não por um mock que diz "não". Só sessão,
// módulo e resolução de papel são simulados.

const h = vi.hoisted(() => ({
  role: "CONSULTANT" as string | null,
  requireTenantSession: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  tenantMemberFindMany: vi.fn(),
  membershipFindUnique: vi.fn(),
  membershipFindMany: vi.fn(),
  membershipUpsert: vi.fn(),
  auditCreate: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@repo/auth/server", () => ({
  AuthError: h.AuthError,
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/rbac", async () => {
  const matrix = await import("../../../../packages/rbac/src/scaffold-matrix");
  return {
    ...matrix,
    hasModule: async () => true,
    getScaffoldRole: async () => h.role,
  };
});
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      tenantMember: {
        findFirst: h.tenantMemberFindFirst,
        findMany: h.tenantMemberFindMany,
      },
      scaffoldMembership: {
        findUnique: h.membershipFindUnique,
        findMany: h.membershipFindMany,
        upsert: h.membershipUpsert,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  assignScaffoldRole,
  listScaffoldMembers,
} from "@/app/(scaffold)/actions/memberships";

const USER = "clx0000000000000000user001";
const ACTOR = "clx0000000000000000actor01";

beforeEach(() => {
  vi.clearAllMocks();
  h.role = "CONSULTANT";
  h.requireTenantSession.mockResolvedValue({
    tenantId: "t1",
    userId: ACTOR,
    role: "ADMIN",
    user: { name: "Marina", email: "m@x.com" },
  });
  h.tenantMemberFindFirst.mockResolvedValue({ userId: USER });
  h.membershipFindUnique.mockResolvedValue(null);
  h.membershipUpsert.mockResolvedValue({ userId: USER, role: "PROCESS_OWNER" });
});

describe("assignScaffoldRole", () => {
  it("consultor atribui papel a membro do próprio tenant", async () => {
    const r = await assignScaffoldRole({ userId: USER, role: "PROCESS_OWNER" });

    expect(r.ok).toBe(true);
    expect(h.membershipUpsert).toHaveBeenCalledTimes(1);
    const arg = h.membershipUpsert.mock.calls[0]?.[0];
    expect(arg.where).toEqual({
      tenantId_userId: { tenantId: "t1", userId: USER },
    });
    expect(arg.create).toMatchObject({
      tenantId: "t1",
      userId: USER,
      role: "PROCESS_OWNER",
      updatedBy: ACTOR,
    });
    expect(arg.update).toMatchObject({
      role: "PROCESS_OWNER",
      updatedBy: ACTOR,
    });
  });

  it("administrador do Scaffold também atribui", async () => {
    h.role = "ADMIN";
    const r = await assignScaffoldRole({ userId: USER, role: "CONSULTANT" });
    expect(r.ok).toBe(true);
  });

  it("TEAM_MEMBER recebe erro de permissão e nada é gravado", async () => {
    h.role = "TEAM_MEMBER";
    const r = await assignScaffoldRole({ userId: USER, role: "CONSULTANT" });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Requer papel");
    }
    expect(h.membershipUpsert).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it.each([
    "PROCESS_OWNER",
    "TRANSFORMATION_LEAD",
  ])("%s não atribui papel", async (role) => {
    h.role = role;
    const r = await assignScaffoldRole({ userId: USER, role: "CONSULTANT" });
    expect(r.ok).toBe(false);
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });

  it("sem papel de adoção nenhum, recusa antes de qualquer leitura", async () => {
    h.role = null;
    const r = await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });
    expect(r.ok).toBe(false);
    expect(h.tenantMemberFindFirst).not.toHaveBeenCalled();
  });

  it("nunca cruza tenant: usuário de outro tenant é recusado", async () => {
    h.tenantMemberFindFirst.mockResolvedValue(null);
    const r = await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MEMBER_NOT_IN_TENANT");
    }
    // O tenant vem da sessão, não da entrada.
    expect(h.tenantMemberFindFirst.mock.calls[0]?.[0].where).toEqual({
      tenantId: "t1",
      userId: USER,
    });
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });

  it("ignora tenantId vindo da entrada", async () => {
    await assignScaffoldRole({
      userId: USER,
      role: "TEAM_MEMBER",
      tenantId: "t-outro",
    } as never);
    expect(h.membershipUpsert.mock.calls[0]?.[0].create.tenantId).toBe("t1");
  });

  it("rejeita papel fora do enum", async () => {
    const r = await assignScaffoldRole({
      userId: USER,
      role: "ROOT",
    } as never);
    expect(r.ok).toBe(false);
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });

  it("audita antes → depois na mesma escrita", async () => {
    h.membershipFindUnique.mockResolvedValue({ role: "TEAM_MEMBER" });
    await assignScaffoldRole({ userId: USER, role: "PROCESS_OWNER" });

    const audit = h.auditCreate.mock.calls[0]?.[0].data;
    expect(audit.tenantId).toBe("t1");
    expect(audit.action).toBe("scaffold.membership.assign");
    expect(audit.entityType).toBe("scaffold.membership");
    expect(audit.diff).toEqual([
      ["Papel de adoção", "TEAM_MEMBER", "PROCESS_OWNER"],
    ]);
  });

  it("primeira atribuição audita 'sem papel' como antes", async () => {
    await assignScaffoldRole({ userId: USER, role: "PROCESS_OWNER" });
    const audit = h.auditCreate.mock.calls[0]?.[0].data;
    expect(audit.diff).toEqual([["Papel de adoção", "—", "PROCESS_OWNER"]]);
  });
});

describe("assignScaffoldRole — sem escalada de privilégio", () => {
  it("CONSULTANT não concede ADMIN a outra pessoa", async () => {
    const r = await assignScaffoldRole({ userId: USER, role: "ADMIN" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ROLE_ASSIGNMENT_FORBIDDEN");
    }
    expect(h.membershipUpsert).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("CONSULTANT não rebaixa ADMIN", async () => {
    h.membershipFindUnique.mockResolvedValue({ role: "ADMIN" });
    const r = await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });
    expect(r.ok).toBe(false);
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });

  it("CONSULTANT não cria nem rebaixa outro CONSULTANT", async () => {
    const criar = await assignScaffoldRole({
      userId: USER,
      role: "CONSULTANT",
    });
    expect(criar.ok).toBe(false);
    h.membershipFindUnique.mockResolvedValue({ role: "CONSULTANT" });
    const rebaixar = await assignScaffoldRole({
      userId: USER,
      role: "TEAM_MEMBER",
    });
    expect(rebaixar.ok).toBe(false);
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });

  it("ADMIN concede e retira ADMIN", async () => {
    h.role = "ADMIN";
    const dar = await assignScaffoldRole({ userId: USER, role: "ADMIN" });
    expect(dar.ok).toBe(true);
    h.membershipFindUnique.mockResolvedValue({ role: "ADMIN" });
    const tirar = await assignScaffoldRole({
      userId: USER,
      role: "TEAM_MEMBER",
    });
    expect(tirar.ok).toBe(true);
  });

  it.each([
    "CONSULTANT",
    "ADMIN",
  ])("%s não altera o próprio papel", async (role) => {
    h.role = role;
    const r = await assignScaffoldRole({
      userId: ACTOR,
      role: "TEAM_MEMBER",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("SELF_ROLE_CHANGE");
    }
    // Recusa antes de ler ou gravar qualquer coisa.
    expect(h.tenantMemberFindFirst).not.toHaveBeenCalled();
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });
});

describe("listScaffoldMembers", () => {
  it("lista membros do tenant com papel atual e sem papel", async () => {
    h.tenantMemberFindMany.mockResolvedValue([
      { userId: "a", user: { name: "Ana", email: "a@x.com" } },
      { userId: "b", user: { name: null, email: "b@x.com" } },
    ]);
    h.membershipFindMany.mockResolvedValue([
      { userId: "a", role: "CONSULTANT" },
    ]);

    const r = await listScaffoldMembers();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual([
        { userId: "a", name: "Ana", email: "a@x.com", role: "CONSULTANT" },
        { userId: "b", name: "b@x.com", email: "b@x.com", role: null },
      ]);
    }
    expect(h.tenantMemberFindMany.mock.calls[0]?.[0].where).toEqual({
      tenantId: "t1",
    });
    expect(h.membershipFindMany.mock.calls[0]?.[0].where).toEqual({
      tenantId: "t1",
    });
  });

  it("TEAM_MEMBER não lista", async () => {
    h.role = "TEAM_MEMBER";
    const r = await listScaffoldMembers();
    expect(r.ok).toBe(false);
    expect(h.tenantMemberFindMany).not.toHaveBeenCalled();
  });
});

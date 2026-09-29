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
  executeRaw: vi.fn(),
  invalidate: vi.fn(),
  calls: [] as string[],
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
    invalidateScaffoldRoleCache: h.invalidate,
    getScaffoldRole: async () => h.role,
  };
});
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      $executeRaw: h.executeRaw,
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
  h.calls.length = 0;
  h.executeRaw.mockImplementation(async () => {
    h.calls.push("lock");
  });
  h.membershipFindUnique.mockImplementation(async () => {
    h.calls.push("read");
    return null;
  });
  h.membershipUpsert.mockImplementation(async () => {
    h.calls.push("write");
    return { userId: USER, role: "PROCESS_OWNER" };
  });
  h.invalidate.mockImplementation(async () => {
    h.calls.push("invalidate");
  });
  h.role = "CONSULTANT";
  h.requireTenantSession.mockResolvedValue({
    tenantId: "t1",
    userId: ACTOR,
    role: "ADMIN",
    user: { name: "Marina", email: "m@x.com" },
  });
  h.tenantMemberFindFirst.mockResolvedValue({ userId: USER });
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
    // Nada de "assign" na trilha: só a tentativa negada.
    expect(h.auditCreate.mock.calls.map((c) => c[0].data.action)).toEqual([
      "scaffold.membership.assign_denied",
    ]);
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

describe("assignScaffoldRole — cache e concorrência", () => {
  it("invalida o cache do papel depois de gravar, para rebaixar valer já", async () => {
    await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });
    expect(h.invalidate).toHaveBeenCalledWith("t1", USER);
    expect(h.calls.indexOf("invalidate")).toBeGreaterThan(
      h.calls.indexOf("write")
    );
  });

  it("não invalida quando nada foi gravado", async () => {
    h.role = "TEAM_MEMBER";
    await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });
    h.role = "CONSULTANT";
    await assignScaffoldRole({ userId: USER, role: "ADMIN" });
    expect(h.invalidate).not.toHaveBeenCalled();
  });

  it("trava a linha da pessoa antes de ler o papel atual (TOCTOU)", async () => {
    await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });
    expect(h.calls.slice(0, 3)).toEqual(["lock", "read", "write"]);
    // O trinco é por tenant e pessoa: duas atribuições à mesma pessoa
    // serializam, inclusive quando ainda não há linha para bloquear.
    // Tagged template: [strings, ...valores].
    expect(h.executeRaw.mock.calls[0]?.slice(1)).toContain(`t1:${USER}`);
  });
});

describe("assignScaffoldRole — tentativas negadas viram auditoria", () => {
  const denied = () =>
    h.auditCreate.mock.calls
      .map((c) => c[0].data)
      .filter((d) => d.action === "scaffold.membership.assign_denied");

  it("SELF_ROLE_CHANGE", async () => {
    await assignScaffoldRole({ userId: ACTOR, role: "ADMIN" });
    const [a] = denied();
    expect(a).toMatchObject({
      tenantId: "t1",
      actorId: ACTOR,
      entityType: "scaffold.membership",
      entityId: ACTOR,
    });
    expect(a.metadata.note).toContain("SELF_ROLE_CHANGE");
    expect(a.metadata.note).toContain("ADMIN");
  });

  it("ROLE_ASSIGNMENT_FORBIDDEN", async () => {
    await assignScaffoldRole({ userId: USER, role: "ADMIN" });
    const [a] = denied();
    expect(a.entityId).toBe(USER);
    expect(a.metadata.note).toContain("ROLE_ASSIGNMENT_FORBIDDEN");
  });

  it("MEMBER_NOT_IN_TENANT", async () => {
    h.tenantMemberFindFirst.mockResolvedValue(null);
    await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });
    const [a] = denied();
    expect(a.entityId).toBe(USER);
    expect(a.metadata.note).toContain("MEMBER_NOT_IN_TENANT");
  });

  it("a recusa continua chegando ao chamador, com o código", async () => {
    const r = await assignScaffoldRole({ userId: USER, role: "ADMIN" });
    expect(r).toMatchObject({ ok: false, code: "ROLE_ASSIGNMENT_FORBIDDEN" });
    expect(h.membershipUpsert).not.toHaveBeenCalled();
  });

  it("papel sem permissão nem chega ao banco: sem auditoria de negada", async () => {
    // O guard barra antes; não há transação para auditar.
    h.role = "TEAM_MEMBER";
    await assignScaffoldRole({ userId: USER, role: "TEAM_MEMBER" });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });
});

describe("listScaffoldMembers — o que cada linha aceita (Crivo F5)", () => {
  const ALL = [
    "TEAM_MEMBER",
    "PROCESS_OWNER",
    "TRANSFORMATION_LEAD",
    "SPONSOR",
    "TEAM_LEAD",
    "CONSULTANT",
    "ADMIN",
  ];
  const people = [
    { userId: "p-membro", user: { name: "Membro", email: "m@x.com" } },
    { userId: "p-admin", user: { name: "Admin", email: "a@x.com" } },
    { userId: "p-cons", user: { name: "Consultor", email: "c@x.com" } },
    { userId: "p-sem", user: { name: "Sem papel", email: "s@x.com" } },
    { userId: ACTOR, user: { name: "Eu", email: "eu@x.com" } },
  ];
  const memberships = [
    { userId: "p-membro", role: "TEAM_MEMBER" },
    { userId: "p-admin", role: "ADMIN" },
    { userId: "p-cons", role: "CONSULTANT" },
    { userId: ACTOR, role: "CONSULTANT" },
  ];
  const row = (rows: { userId: string }[], id: string) =>
    rows.find((r) => r.userId === id) as unknown as {
      assignable: string[];
      lockedReason: string | null;
    };

  beforeEach(() => {
    h.tenantMemberFindMany.mockResolvedValue(people);
    h.membershipFindMany.mockResolvedValue(memberships);
  });

  it("consultor oferece só os papéis abaixo dele, nunca ADMIN nem CONSULTANT", async () => {
    const r = await listScaffoldMembers();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const below = ALL.filter(
        (x) => x !== "ADMIN" && x !== "CONSULTANT"
      ).sort();
      expect([...row(r.data, "p-membro").assignable].sort()).toEqual(below);
      expect([...row(r.data, "p-sem").assignable].sort()).toEqual(below);
      expect(row(r.data, "p-membro").lockedReason).toBeNull();
    }
  });

  it("papel que o consultor não mexe vem travado, com o motivo", async () => {
    const r = await listScaffoldMembers();
    if (r.ok) {
      for (const id of ["p-admin", "p-cons"]) {
        expect(row(r.data, id).assignable).toEqual([]);
        expect(row(r.data, id).lockedReason).toMatch(/administrador/i);
      }
    }
  });

  it("ninguém altera o próprio papel: a própria linha vem travada", async () => {
    const r = await listScaffoldMembers();
    if (r.ok) {
      expect(row(r.data, ACTOR).assignable).toEqual([]);
      expect(row(r.data, ACTOR).lockedReason).toMatch(/próprio/i);
    }
  });

  it("administrador oferece todos os papéis, menos na própria linha", async () => {
    h.role = "ADMIN";
    const r = await listScaffoldMembers();
    if (r.ok) {
      expect([...row(r.data, "p-cons").assignable].sort()).toEqual(
        [...ALL].sort()
      );
      expect([...row(r.data, "p-admin").assignable].sort()).toEqual(
        [...ALL].sort()
      );
      expect(row(r.data, ACTOR).assignable).toEqual([]);
    }
  });

  it("o que a lista oferece é exatamente o que assignScaffoldRole aceita", async () => {
    // A tela nunca oferece o que o servidor vai recusar, e nunca esconde o que
    // ele aceitaria: as duas pontas usam a mesma regra.
    const { canAssignScaffoldRole } = await import(
      "../../../../packages/rbac/src/scaffold-matrix"
    );
    const r = await listScaffoldMembers();
    if (r.ok) {
      for (const p of r.data) {
        const current = (p.role ?? null) as never;
        const offered = new Set(row([p], p.userId).assignable);
        for (const target of ALL) {
          const expected =
            p.userId !== ACTOR &&
            canAssignScaffoldRole("CONSULTANT", current, target as never);
          expect(offered.has(target), `${p.userId} → ${target}`).toBe(expected);
        }
      }
    }
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
      expect(r.data).toMatchObject([
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

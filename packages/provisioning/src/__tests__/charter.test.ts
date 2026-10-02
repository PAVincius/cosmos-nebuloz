import { describe, expect, it, vi } from "vitest";
import { bootstrapCharter, POLICY_SECTIONS } from "../charter";
import { CHARTER_CLAUSES } from "../charter-clauses";

function makeDb(
  options: {
    policyExists?: boolean;
    userExists?: boolean;
    tenantExists?: boolean;
    isMember?: boolean;
  } = {}
) {
  const {
    policyExists = false,
    userExists = true,
    tenantExists = true,
    isMember = true,
  } = options;
  return {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(userExists ? { id: "user-compliance" } : null),
    },
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          tenantExists ? { id: "tenant-abc", slug: "vanta-saude" } : null
        ),
    },
    tenantMember: {
      findFirst: vi.fn().mockResolvedValue(isMember ? { id: "tm-1" } : null),
    },
    charterMembership: { upsert: vi.fn().mockResolvedValue({ id: "cm-1" }) },
    charterSettings: { upsert: vi.fn().mockResolvedValue({ id: "cs-1" }) },
    charterPolicy: {
      findFirst: vi
        .fn()
        .mockResolvedValue(policyExists ? { id: "policy-existente" } : null),
      create: vi.fn().mockResolvedValue({ id: "policy-novo" }),
    },
    charterPolicySection: {
      createMany: vi.fn().mockResolvedValue({ count: 9 }),
    },
    charterClause: {
      createMany: vi.fn().mockResolvedValue({ count: 8 }),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

function depsFor(db: ReturnType<typeof makeDb>) {
  return {
    withTenantDb: vi.fn(
      async (_tenantId: string, fn: (client: never) => Promise<unknown>) =>
        fn(db as never)
    ),
  };
}

describe("bootstrapCharter — membro do tenant", () => {
  it("recusa conta que existe mas não é membro deste tenant (USER_NOT_MEMBER)", async () => {
    const db = makeDb({ isMember: false });

    await expect(
      bootstrapCharter(depsFor(db) as never, {
        tenantId: "tenant-abc",
        complianceEmail: "ana@vanta.exemplo",
        actorUserId: "user-staff",
      })
    ).rejects.toMatchObject({ code: "USER_NOT_MEMBER" });

    expect(db.charterMembership.upsert).not.toHaveBeenCalled();
    expect(db.charterPolicy.create).not.toHaveBeenCalled();
  });
});

describe("bootstrapCharter", () => {
  it("cria a política com as nove seções em DRAFT", async () => {
    const db = makeDb();

    const result = await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.created).toBe(true);
    expect(result.clausesCreated).toBe(8);
    const { data } = db.charterPolicySection.createMany.mock.calls[0][0];
    expect(data).toHaveLength(9);
    expect(data.every((s: { status: string }) => s.status === "DRAFT")).toBe(
      true
    );
    expect(data.map((s: { ordinal: number }) => s.ordinal)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("dá o papel COMPLIANCE ao responsável", async () => {
    const db = makeDb();

    await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    const args = db.charterMembership.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({
      tenantId: "tenant-abc",
      userId: "user-compliance",
      role: "COMPLIANCE",
    });
  });

  it("escreve dentro de withTenantDb — a RLS do Charter recusa INSERT sem contexto", async () => {
    const db = makeDb();
    const deps = depsFor(db);

    await bootstrapCharter(deps as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(deps.withTenantDb).toHaveBeenCalledWith(
      "tenant-abc",
      expect.any(Function)
    );
  });

  it("é idempotente: com política existente não cria outra", async () => {
    const db = makeDb({ policyExists: true });

    const result = await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.created).toBe(false);
    expect(result.clausesCreated).toBe(8);
    expect(db.charterPolicy.create).not.toHaveBeenCalled();
    expect(db.charterPolicySection.createMany).not.toHaveBeenCalled();
    // O papel continua sendo garantido — upsert, não create.
    expect(db.charterMembership.upsert).toHaveBeenCalledTimes(1);
  });

  it("cria as cláusulas faltantes mesmo quando a política já existe", async () => {
    const db = makeDb({ policyExists: true });

    await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(db.charterClause.createMany).toHaveBeenCalledTimes(1);
    const args = db.charterClause.createMany.mock.calls[0][0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data).toHaveLength(8);
  });

  it("grava clauses_bootstrapped com o count real e target explícito quando cria cláusulas", async () => {
    const db = makeDb({ policyExists: false });
    db.charterClause.createMany = vi.fn().mockResolvedValue({ count: 8 });

    const result = await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.clausesCreated).toBe(8);
    const clauseAuditCall = db.auditLog.create.mock.calls.find(
      (call) => call[0].data.action === "charter.clauses_bootstrapped"
    );
    expect(clauseAuditCall).toBeDefined();
    expect(clauseAuditCall?.[0].data.metadata.target).toBe(
      "vanta-saude · 8 cláusulas criadas"
    );
  });

  it("não grava clauses_bootstrapped e devolve clausesCreated 0 quando nenhuma cláusula nova foi criada (re-provisionamento)", async () => {
    const db = makeDb({ policyExists: true });
    db.charterClause.createMany = vi.fn().mockResolvedValue({ count: 0 });

    const result = await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.clausesCreated).toBe(0);
    const clauseAuditCall = db.auditLog.create.mock.calls.find(
      (call) => call[0].data.action === "charter.clauses_bootstrapped"
    );
    expect(clauseAuditCall).toBeUndefined();
  });

  it("nunca atualiza uma cláusula existente", async () => {
    for (const policyExists of [false, true]) {
      const db = makeDb({ policyExists });

      await bootstrapCharter(depsFor(db) as never, {
        tenantId: "tenant-abc",
        complianceEmail: "ana@vanta.exemplo",
        actorUserId: "user-staff",
      });

      expect(db.charterClause.update).not.toHaveBeenCalled();
      expect(db.charterClause.upsert).not.toHaveBeenCalled();
    }
  });

  it("cria as 8 cláusulas quando o tenant ainda não tem Charter", async () => {
    const db = makeDb({ policyExists: false });

    await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(db.charterClause.createMany).toHaveBeenCalledTimes(1);
    const args = db.charterClause.createMany.mock.calls[0][0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data).toHaveLength(8);
    expect(
      args.data.every((c: { tenantId: string }) => c.tenantId === "tenant-abc")
    ).toBe(true);
    expect(args.data.map((c: { code: string }) => c.code)).toEqual(
      CHARTER_CLAUSES.map((c) => c.code)
    );
  });

  it("falha com USER_NOT_FOUND quando o e-mail não tem conta", async () => {
    const db = makeDb({ userExists: false });

    await expect(
      bootstrapCharter(depsFor(db) as never, {
        tenantId: "tenant-abc",
        complianceEmail: "ninguem@vanta.exemplo",
        actorUserId: "user-staff",
      })
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });

    expect(db.charterClause.createMany).not.toHaveBeenCalled();
  });

  it("falha com TENANT_NOT_FOUND antes de consultar usuário ou escrever", async () => {
    const db = makeDb({ tenantExists: false });

    await expect(
      bootstrapCharter(depsFor(db) as never, {
        tenantId: "tenant-fantasma",
        complianceEmail: "ana@vanta.exemplo",
        actorUserId: "user-staff",
      })
    ).rejects.toMatchObject({
      code: "TENANT_NOT_FOUND",
      message: expect.stringContaining("tenant-fantasma"),
    });

    // O tenant é a primeira verificação: nada abaixo dela roda.
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.charterMembership.upsert).not.toHaveBeenCalled();
    expect(db.charterPolicy.create).not.toHaveBeenCalled();
    expect(db.charterClause.createMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("normaliza o e-mail (trim + minúsculas) antes de procurar a conta", async () => {
    const db = makeDb();

    await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "  Ana@Vanta.Exemplo ",
      actorUserId: "user-staff",
    });

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ana@vanta.exemplo" },
      select: { id: true },
    });
  });

  it("a lista de seções tem nove entradas com ordinal único", () => {
    expect(POLICY_SECTIONS).toHaveLength(9);
    expect(new Set(POLICY_SECTIONS.map((s) => s.ordinal)).size).toBe(9);
  });
});

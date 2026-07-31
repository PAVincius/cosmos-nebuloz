import { describe, expect, it, vi } from "vitest";
import { bootstrapCharter, POLICY_SECTIONS } from "../charter";

function makeDb(
  options: { policyExists?: boolean; userExists?: boolean } = {}
) {
  const { policyExists = false, userExists = true } = options;
  return {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(userExists ? { id: "user-compliance" } : null),
    },
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "tenant-abc", slug: "vanta-saude" }),
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

describe("bootstrapCharter", () => {
  it("cria a política com as nove seções em DRAFT", async () => {
    const db = makeDb();

    const result = await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.created).toBe(true);
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
    expect(db.charterPolicy.create).not.toHaveBeenCalled();
    expect(db.charterPolicySection.createMany).not.toHaveBeenCalled();
    // O papel continua sendo garantido — upsert, não create.
    expect(db.charterMembership.upsert).toHaveBeenCalledTimes(1);
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
  });

  it("a lista de seções tem nove entradas com ordinal único", () => {
    expect(POLICY_SECTIONS).toHaveLength(9);
    expect(new Set(POLICY_SECTIONS.map((s) => s.ordinal)).size).toBe(9);
  });
});

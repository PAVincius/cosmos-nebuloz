import { describe, expect, it, vi } from "vitest";
import { bootstrapScaffold } from "../scaffold";

function makeDb(
  options: {
    membershipExists?: boolean;
    existingRole?: string;
    userExists?: boolean;
    isMember?: boolean;
    raceLost?: boolean;
    tenantExists?: boolean;
  } = {}
) {
  const {
    membershipExists = false,
    existingRole = "CONSULTANT",
    userExists = true,
    isMember = true,
    raceLost = false,
    tenantExists = true,
  } = options;
  return {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(userExists ? { id: "user-admin" } : null),
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
    scaffoldMembership: {
      // Depois do insert (ou do ON CONFLICT DO NOTHING) a linha existe. `raceLost`
      // = outro processo inseriu antes de nós: count 0 e o papel é o dele.
      findUnique: vi
        .fn()
        .mockResolvedValue(
          membershipExists || raceLost
            ? { id: "sm-0", role: raceLost ? "CONSULTANT" : existingRole }
            : { id: "sm-1", role: "ADMIN" }
        ),
      createMany: vi
        .fn()
        .mockResolvedValue({ count: membershipExists || raceLost ? 0 : 1 }),
    },
    scaffoldSettings: { upsert: vi.fn().mockResolvedValue({ id: "ss-1" }) },
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

const INPUT = {
  tenantId: "tenant-abc",
  adminEmail: "  Ana@Vanta.Exemplo ",
  actorUserId: "user-staff",
  actorName: "Staff",
};

describe("bootstrapScaffold", () => {
  it("dá o papel ADMIN ao primeiro administrador, com o e-mail normalizado", async () => {
    const db = makeDb();

    const result = await bootstrapScaffold(depsFor(db) as never, INPUT);

    expect(result).toEqual({
      membershipId: "sm-1",
      created: true,
      role: "ADMIN",
    });
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "ana@vanta.exemplo" } })
    );
    const { data, skipDuplicates } =
      db.scaffoldMembership.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data[0]).toMatchObject({
      tenantId: "tenant-abc",
      userId: "user-admin",
      role: "ADMIN",
      updatedBy: "user-staff",
    });
  });

  it("cria as configurações do tenant sem sobrescrever as existentes", async () => {
    const db = makeDb();

    await bootstrapScaffold(depsFor(db) as never, INPUT);

    const args = db.scaffoldSettings.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: "tenant-abc" });
    expect(args.update).toEqual({});
  });

  it("roda dentro do contexto do tenant (RLS)", async () => {
    const db = makeDb();
    const deps = depsFor(db);

    await bootstrapScaffold(deps as never, INPUT);

    expect(deps.withTenantDb).toHaveBeenCalledWith(
      "tenant-abc",
      expect.any(Function)
    );
  });

  it("audita o provisionamento", async () => {
    const db = makeDb();

    await bootstrapScaffold(depsFor(db) as never, INPUT);

    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("scaffold.bootstrapped");
    expect(data.entityType).toBe("ScaffoldMembership");
  });

  it("não rebaixa quem já tem papel: mantém e audita como ignorado", async () => {
    const db = makeDb({ membershipExists: true, existingRole: "CONSULTANT" });

    const result = await bootstrapScaffold(depsFor(db) as never, INPUT);

    expect(result).toEqual({
      membershipId: "sm-0",
      created: false,
      // Devolve o papel que a pessoa JÁ tem, para o chamador não achar que virou ADMIN.
      role: "CONSULTANT",
    });
    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("scaffold.bootstrap_skipped");
  });

  it("recusa tenant inexistente", async () => {
    const db = makeDb({ tenantExists: false });

    await expect(
      bootstrapScaffold(depsFor(db) as never, INPUT)
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
    expect(db.scaffoldMembership.createMany).not.toHaveBeenCalled();
  });

  it("recusa e-mail sem conta, dizendo o que fazer", async () => {
    const db = makeDb({ userExists: false });

    await expect(
      bootstrapScaffold(depsFor(db) as never, INPUT)
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    expect(db.scaffoldMembership.createMany).not.toHaveBeenCalled();
  });

  it("recusa conta que existe mas não é membro DESTE tenant (USER_NOT_MEMBER)", async () => {
    // Sem isto, bastava saber o e-mail de qualquer conta da plataforma para
    // enfiá-la como ADMIN no tenant de um cliente.
    const db = makeDb({ isMember: false });

    await expect(
      bootstrapScaffold(depsFor(db) as never, INPUT)
    ).rejects.toMatchObject({ code: "USER_NOT_MEMBER" });

    expect(db.tenantMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-abc", userId: "user-admin" },
      })
    );
    expect(db.scaffoldMembership.createMany).not.toHaveBeenCalled();
    expect(db.scaffoldSettings.upsert).not.toHaveBeenCalled();
  });

  it("corrida: outro processo criou o papel entre o find e o insert vira 'já existia', sem erro", async () => {
    const db = makeDb({ raceLost: true });

    const result = await bootstrapScaffold(depsFor(db) as never, INPUT);

    expect(result).toEqual({
      membershipId: "sm-0",
      created: false,
      role: "CONSULTANT",
    });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe(
      "scaffold.bootstrap_skipped"
    );
  });
});

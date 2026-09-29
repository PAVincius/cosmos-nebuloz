import { describe, expect, it, vi } from "vitest";
import { bootstrapScaffold } from "../scaffold";

function makeDb(
  options: {
    membershipExists?: boolean;
    existingRole?: string;
    userExists?: boolean;
    tenantExists?: boolean;
  } = {}
) {
  const {
    membershipExists = false,
    existingRole = "CONSULTANT",
    userExists = true,
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
    scaffoldMembership: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          membershipExists ? { id: "sm-0", role: existingRole } : null
        ),
      create: vi.fn().mockResolvedValue({ id: "sm-1" }),
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

    expect(result).toEqual({ membershipId: "sm-1", created: true });
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "ana@vanta.exemplo" } })
    );
    const { data } = db.scaffoldMembership.create.mock.calls[0][0];
    expect(data).toMatchObject({
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

    expect(result).toEqual({ membershipId: "sm-0", created: false });
    expect(db.scaffoldMembership.create).not.toHaveBeenCalled();
    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("scaffold.bootstrap_skipped");
  });

  it("recusa tenant inexistente", async () => {
    const db = makeDb({ tenantExists: false });

    await expect(
      bootstrapScaffold(depsFor(db) as never, INPUT)
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
    expect(db.scaffoldMembership.create).not.toHaveBeenCalled();
  });

  it("recusa e-mail sem conta, dizendo o que fazer", async () => {
    const db = makeDb({ userExists: false });

    await expect(
      bootstrapScaffold(depsFor(db) as never, INPUT)
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    expect(db.scaffoldMembership.create).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { bootstrapMeridian, MERIDIAN_BATTERY } from "../meridian";

function makeDb(
  options: { templateExists?: boolean; userExists?: boolean } = {}
) {
  const { templateExists = false, userExists = true } = options;
  return {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(userExists ? { id: "user-consultor" } : null),
    },
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "tenant-abc", slug: "vanta-saude" }),
    },
    meridianMembership: { upsert: vi.fn().mockResolvedValue({ id: "mm-1" }) },
    meridianTemplate: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          templateExists ? { id: "template-existente" } : null
        ),
      create: vi.fn().mockResolvedValue({ id: "template-novo" }),
    },
    meridianQuestion: {
      createMany: vi.fn().mockResolvedValue({ count: 15 }),
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

describe("bootstrapMeridian", () => {
  it("cria o template com a bateria inteira", async () => {
    const db = makeDb();

    const result = await bootstrapMeridian(depsFor(db) as never, {
      tenantId: "tenant-abc",
      consultantEmail: "marina@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.created).toBe(true);
    const { data } = db.meridianQuestion.createMany.mock.calls[0][0];
    expect(data).toHaveLength(MERIDIAN_BATTERY.length);
    expect(
      data.every(
        (q: { templateId: string }) => q.templateId === "template-novo"
      )
    ).toBe(true);
  });

  it("cria o template destravado — travar é decisão do primeiro uso", async () => {
    const db = makeDb();

    await bootstrapMeridian(depsFor(db) as never, {
      tenantId: "tenant-abc",
      consultantEmail: "marina@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(db.meridianTemplate.create.mock.calls[0][0].data).not.toHaveProperty(
      "lockedAt"
    );
  });

  it("dá o papel CONSULTANT ao responsável", async () => {
    const db = makeDb();

    await bootstrapMeridian(depsFor(db) as never, {
      tenantId: "tenant-abc",
      consultantEmail: "Marina@Vanta.Exemplo ",
      actorUserId: "user-staff",
    });

    expect(db.user.findUnique.mock.calls[0][0].where.email).toBe(
      "marina@vanta.exemplo"
    );
    expect(db.meridianMembership.upsert.mock.calls[0][0].create).toMatchObject({
      tenantId: "tenant-abc",
      userId: "user-consultor",
      role: "CONSULTANT",
    });
  });

  it("escreve dentro de withTenantDb — a RLS recusa INSERT sem contexto", async () => {
    const db = makeDb();
    const deps = depsFor(db);

    await bootstrapMeridian(deps as never, {
      tenantId: "tenant-abc",
      consultantEmail: "marina@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(deps.withTenantDb).toHaveBeenCalledWith(
      "tenant-abc",
      expect.any(Function)
    );
  });

  it("é idempotente: com template existente não cria outro", async () => {
    const db = makeDb({ templateExists: true });

    const result = await bootstrapMeridian(depsFor(db) as never, {
      tenantId: "tenant-abc",
      consultantEmail: "marina@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.created).toBe(false);
    expect(db.meridianTemplate.create).not.toHaveBeenCalled();
    expect(db.meridianQuestion.createMany).not.toHaveBeenCalled();
    // O papel continua sendo garantido — upsert, não create.
    expect(db.meridianMembership.upsert).toHaveBeenCalledTimes(1);
  });

  it("falha com USER_NOT_FOUND quando o e-mail não tem conta", async () => {
    const db = makeDb({ userExists: false });

    await expect(
      bootstrapMeridian(depsFor(db) as never, {
        tenantId: "tenant-abc",
        consultantEmail: "ninguem@vanta.exemplo",
        actorUserId: "user-staff",
      })
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("a bateria tem três perguntas por eixo, com código e ordinal únicos", () => {
    expect(MERIDIAN_BATTERY).toHaveLength(15);
    expect(new Set(MERIDIAN_BATTERY.map((q) => q.code)).size).toBe(15);

    for (const axis of [
      "DATA",
      "PROCESS",
      "PEOPLE",
      "GOVERNANCE",
      "INFRASTRUCTURE",
    ]) {
      const doEixo = MERIDIAN_BATTERY.filter((q) => q.axis === axis);
      expect(doEixo.map((q) => q.ordinal)).toEqual([1, 2, 3]);
    }
  });

  it("só a pergunta invertida é SCALE com rótulos — é o par que o motor exige", () => {
    // `inverted` sem escala normalizaria em silêncio pelo caminho errado; é a
    // combinação, não cada campo, que o scoring depende.
    for (const q of MERIDIAN_BATTERY) {
      expect(q.scaleLabels.length > 0).toBe(q.type === "SCALE");
      if (q.inverted) {
        expect(q.type).toBe("SCALE");
      }
    }
  });
});

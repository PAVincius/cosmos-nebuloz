import { beforeEach, describe, expect, it, vi } from "vitest";
import { contractModule, setModuleStatus } from "../modules";

function makeDb() {
  return {
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "tenant-abc", slug: "vanta-saude" }),
    },
    tenantModule: {
      upsert: vi.fn().mockResolvedValue({ id: "tm-1" }),
      update: vi.fn().mockResolvedValue({ id: "tm-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

describe("contractModule", () => {
  let db: ReturnType<typeof makeDb>;
  let invalidateModuleCache: (tenantId: string) => Promise<void>;

  beforeEach(() => {
    db = makeDb();
    invalidateModuleCache = vi.fn().mockResolvedValue(undefined) as (
      tenantId: string
    ) => Promise<void>;
  });

  it("faz upsert do módulo com ACTIVE por padrão", async () => {
    await contractModule(
      db,
      { invalidateModuleCache },
      {
        tenantId: "tenant-abc",
        module: "CHARTER",
        actorUserId: "user-staff",
      }
    );

    const args = db.tenantModule.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      tenantId_module: { tenantId: "tenant-abc", module: "CHARTER" },
    });
    expect(args.create.status).toBe("ACTIVE");
    expect(args.update.status).toBe("ACTIVE");
  });

  it("invalida o cache — sem isso o cliente espera 5 min para ver o módulo", async () => {
    await contractModule(
      db,
      { invalidateModuleCache },
      {
        tenantId: "tenant-abc",
        module: "CHARTER",
        actorUserId: "user-staff",
      }
    );

    expect(invalidateModuleCache).toHaveBeenCalledWith("tenant-abc");
  });

  it("registra na trilha com o slug e o módulo no alvo", async () => {
    await contractModule(
      db,
      { invalidateModuleCache },
      {
        tenantId: "tenant-abc",
        module: "CHARTER",
        actorUserId: "user-staff",
      }
    );

    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("module.contracted");
    expect(data.metadata.target).toBe("vanta-saude · CHARTER");
  });

  it("rodar duas vezes não cria duas linhas — upsert, não create", async () => {
    const input = {
      tenantId: "tenant-abc",
      module: "CHARTER" as const,
      actorUserId: "user-staff",
    };

    await contractModule(db, { invalidateModuleCache }, input);
    await contractModule(db, { invalidateModuleCache }, input);

    expect(db.tenantModule.upsert).toHaveBeenCalledTimes(2);
    expect(
      (db.tenantModule as unknown as { create?: unknown }).create
    ).toBeUndefined();
  });

  it("falha com TENANT_NOT_FOUND quando o tenant não existe", async () => {
    db.tenant.findUnique.mockResolvedValue(null);

    await expect(
      contractModule(
        db,
        { invalidateModuleCache },
        {
          tenantId: "nao-existe",
          module: "CHARTER",
          actorUserId: "user-staff",
        }
      )
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
  });
});

describe("setModuleStatus", () => {
  it("suspende sem apagar dado e invalida o cache", async () => {
    const db = makeDb();
    const invalidateModuleCache = vi.fn().mockResolvedValue(undefined) as (
      tenantId: string
    ) => Promise<void>;

    await setModuleStatus(
      db,
      { invalidateModuleCache },
      {
        tenantId: "tenant-abc",
        module: "CHARTER",
        status: "SUSPENDED",
        actorUserId: "user-staff",
      }
    );

    expect(db.tenantModule.update).toHaveBeenCalledWith({
      where: {
        tenantId_module: { tenantId: "tenant-abc", module: "CHARTER" },
      },
      data: { status: "SUSPENDED", updatedBy: "user-staff" },
    });
    expect(invalidateModuleCache).toHaveBeenCalledWith("tenant-abc");

    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("module.status_changed");
  });
});

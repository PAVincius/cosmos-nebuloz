import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ProvisionDb, provisionTenant } from "../tenant";

const INVITE_TTL_DAYS = 14;

function makeDb(options: { ownerExists: boolean }) {
  const db = {
    tenant: {
      // Slug sempre livre (uniqueSlug); por id, devolve o tenant recém-criado
      // (requireTenant, chamado por contractModule) — um mock plano com
      // `null` sempre quebra a segunda consulta.
      findUnique: vi.fn(
        async (args: { where: { slug?: string; id?: string } }) =>
          args.where.id ? { id: args.where.id, slug: "vanta" } : null
      ),
      create: vi.fn().mockResolvedValue({ id: "tenant-new", slug: "vanta" }),
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.ownerExists ? { id: "user-owner" } : null),
    },
    tenantMember: { create: vi.fn().mockResolvedValue({ id: "member-1" }) },
    tenantInvitation: { create: vi.fn().mockResolvedValue({ id: "invite-1" }) },
    tenantModule: {
      // findUnique não é usado por contractModule, mas ModuleDb o exige
      // estruturalmente (é compartilhado com setModuleStatus).
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "tm-1" }),
      update: vi.fn().mockResolvedValue({ id: "tm-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  // A transação recebe o mesmo objeto: o teste prova a composição das chamadas,
  // não o comportamento transacional do Prisma. Sem vi.fn aqui — nenhum teste
  // verifica chamadas a $transaction, e envolvê-la apagaria o genérico `<T>`
  // da assinatura real (vi.fn não preserva funções genéricas).
  const $transaction: ProvisionDb["$transaction"] = (fn) => fn(db as never);
  return Object.assign(db, { $transaction });
}

describe("provisionTenant", () => {
  let invalidateModuleCache: (tenantId: string) => Promise<void>;

  beforeEach(() => {
    invalidateModuleCache = vi.fn().mockResolvedValue(undefined) as (
      tenantId: string
    ) => Promise<void>;
  });

  it("cria o tenant com slug derivado do nome", async () => {
    const db = makeDb({ ownerExists: true });

    const result = await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta Saúde",
        ownerEmail: "ana@vanta.exemplo",
        modules: [{ module: "COSMOS" }],
        actorUserId: "user-staff",
      }
    );

    expect(db.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Vanta Saúde",
          slug: "vanta-saude",
        }),
      })
    );
    expect(result.tenantId).toBe("tenant-new");
  });

  it("liga o dono como ADMIN quando o e-mail já tem conta", async () => {
    const db = makeDb({ ownerExists: true });

    const result = await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta",
        ownerEmail: "ana@vanta.exemplo",
        modules: [],
        actorUserId: "user-staff",
      }
    );

    expect(db.tenantMember.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-new",
        userId: "user-owner",
        role: "ADMIN",
      },
    });
    expect(db.tenantInvitation.create).not.toHaveBeenCalled();
    expect(result.ownerLinked).toBe(true);
  });

  it("deixa convite pendente quando o e-mail ainda não tem conta", async () => {
    const db = makeDb({ ownerExists: false });

    const result = await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta",
        ownerEmail: "novo@vanta.exemplo",
        modules: [],
        actorUserId: "user-staff",
      }
    );

    expect(db.tenantMember.create).not.toHaveBeenCalled();
    const args = db.tenantInvitation.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      tenantId: "tenant-new",
      email: "novo@vanta.exemplo",
      role: "ADMIN",
      inviterId: "user-staff",
    });
    expect(args.data.expiresAt).toBeInstanceOf(Date);
    expect(result.ownerLinked).toBe(false);
  });

  it("contrata os módulos pedidos", async () => {
    const db = makeDb({ ownerExists: true });

    await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta",
        ownerEmail: "ana@vanta.exemplo",
        modules: [{ module: "COSMOS" }, { module: "CHARTER", status: "TRIAL" }],
        actorUserId: "user-staff",
      }
    );

    expect(db.tenantModule.upsert).toHaveBeenCalledTimes(2);
  });

  it("registra o provisionamento na trilha", async () => {
    const db = makeDb({ ownerExists: true });

    await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta",
        ownerEmail: "ana@vanta.exemplo",
        modules: [],
        actorUserId: "user-staff",
      }
    );

    const actions = db.auditLog.create.mock.calls.map(
      (call) => call[0].data.action
    );
    expect(actions).toContain("tenant.provisioned");
  });

  // `platformStaff` é o que põe a linha em "Atividade do staff" no
  // back-office. O autocadastro do app usa esta mesma função, e o cliente
  // que cria o próprio workspace aparecia lá como se fosse da equipe.
  it("autocadastro não entra como ato de staff", async () => {
    const db = makeDb({ ownerExists: true });

    await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta",
        ownerEmail: "ana@vanta.exemplo",
        modules: [{ module: "COSMOS", status: "TRIAL" }],
        actorUserId: "user-ana",
        platformStaff: false,
      }
    );

    const marcas = db.auditLog.create.mock.calls.map(
      (call) => call[0].data.metadata.platformStaff
    );
    // Uma linha do módulo, uma do provisionamento — nenhuma de staff.
    expect(marcas).toEqual([false, false]);
  });

  it("provisionamento pelo back-office segue como ato de staff", async () => {
    const db = makeDb({ ownerExists: true });

    await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta",
        ownerEmail: "ana@vanta.exemplo",
        modules: [{ module: "COSMOS" }],
        actorUserId: "user-staff",
      }
    );

    const marcas = db.auditLog.create.mock.calls.map(
      (call) => call[0].data.metadata.platformStaff
    );
    expect(marcas).toEqual([true, true]);
  });

  it("o convite vence em 14 dias", async () => {
    const db = makeDb({ ownerExists: false });

    await provisionTenant(
      db,
      { invalidateModuleCache },
      {
        name: "Vanta",
        ownerEmail: "novo@vanta.exemplo",
        modules: [],
        actorUserId: "user-staff",
      }
    );

    const { expiresAt } = db.tenantInvitation.create.mock.calls[0][0].data;
    const days = Math.round(
      (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    expect(days).toBe(INVITE_TTL_DAYS);
  });
});

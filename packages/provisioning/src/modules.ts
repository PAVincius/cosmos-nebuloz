import type { ModuleStatus, ProductModule } from "@repo/database";
import { logPlatformAudit } from "./audit";
import { ProvisioningError } from "./errors";

export type ModuleDeps = {
  invalidateModuleCache: (tenantId: string) => Promise<void>;
};

/** Só o que estas funções usam do client. Sintaxe de método em todos os campos:
 *  sob `strictFunctionTypes` a forma propriedade-com-seta é contravariante e o
 *  client real do Prisma não seria atribuível a este tipo. */
export type ModuleDb = {
  tenant: {
    findUnique(args: {
      where: { id: string };
      select?: unknown;
    }): Promise<{ id: string; slug: string } | null>;
  };
  tenantModule: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    upsert(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  };
  auditLog: { create(args: { data: unknown }): Promise<unknown> };
};

export type ContractModuleInput = {
  tenantId: string;
  module: ProductModule;
  status?: ModuleStatus;
  seats?: number | null;
  expiresAt?: Date | null;
  actorUserId: string;
  actorName?: string | null;
};

async function requireTenant(db: ModuleDb, tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    throw new ProvisioningError(
      "TENANT_NOT_FOUND",
      `Nenhum tenant com id ${tenantId}.`
    );
  }
  return tenant;
}

/** Contratação de módulo. Upsert porque contratar de novo o mesmo módulo é
 *  renovação, não erro — a unique (tenantId, module) já existe no schema. */
export async function contractModule(
  db: ModuleDb,
  deps: ModuleDeps,
  input: ContractModuleInput
): Promise<{ id: string }> {
  const tenant = await requireTenant(db, input.tenantId);
  const status = input.status ?? "ACTIVE";

  const row = await db.tenantModule.upsert({
    where: {
      tenantId_module: { tenantId: input.tenantId, module: input.module },
    },
    create: {
      tenantId: input.tenantId,
      module: input.module,
      status,
      seats: input.seats ?? null,
      expiresAt: input.expiresAt ?? null,
      updatedBy: input.actorUserId,
    },
    update: {
      status,
      seats: input.seats ?? null,
      expiresAt: input.expiresAt ?? null,
      updatedBy: input.actorUserId,
    },
  });

  // O gate lê de um cache com TTL de 5 min. Sem invalidar, o cliente contrata e
  // continua vendo "módulo não contratado" por até cinco minutos.
  await deps.invalidateModuleCache(input.tenantId);

  await logPlatformAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: "module.contracted",
    entityType: "TenantModule",
    entityId: row.id,
    target: `${tenant.slug} · ${input.module}`,
  });

  return row;
}

export type SetModuleStatusInput = {
  tenantId: string;
  module: ProductModule;
  status: ModuleStatus;
  actorUserId: string;
  actorName?: string | null;
};

/** Muda a situação da contratação. SUSPENDED e CANCELED fecham a porta sem
 *  apagar dado — é o que `hasModule` já implementa, e é o gatilho que a fatia
 *  de cobrança vai chamar quando o pagamento falhar. */
export async function setModuleStatus(
  db: ModuleDb,
  deps: ModuleDeps,
  input: SetModuleStatusInput
): Promise<{ id: string }> {
  const tenant = await requireTenant(db, input.tenantId);

  // Sem isto, mudar a situação de um módulo nunca contratado estoura o erro
  // nativo do Prisma (P2025) em vez de uma causa nomeada — e quem chama, na
  // tela ou no gatilho de cobrança, não tem como distinguir "não contratado"
  // de "banco fora do ar".
  const existing = await db.tenantModule.findUnique({
    where: {
      tenantId_module: { tenantId: input.tenantId, module: input.module },
    },
  });
  if (!existing) {
    throw new ProvisioningError(
      "MODULE_NOT_CONTRACTED",
      `O módulo ${input.module} não está contratado para este cliente.`
    );
  }

  const row = await db.tenantModule.update({
    where: {
      tenantId_module: { tenantId: input.tenantId, module: input.module },
    },
    data: { status: input.status, updatedBy: input.actorUserId },
  });

  await deps.invalidateModuleCache(input.tenantId);

  await logPlatformAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: "module.status_changed",
    entityType: "TenantModule",
    entityId: row.id,
    target: `${tenant.slug} · ${input.module} → ${input.status}`,
  });

  return row;
}

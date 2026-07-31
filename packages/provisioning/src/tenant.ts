import type { ModuleStatus, ProductModule } from "@repo/database";
import { logPlatformAudit } from "./audit";
import { contractModule, type ModuleDb, type ModuleDeps } from "./modules";
import { type SlugChecker, uniqueSlug } from "./slug";

const INVITE_TTL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProvisionTenantInput = {
  name: string;
  ownerEmail: string;
  modules: {
    module: ProductModule;
    status?: ModuleStatus;
    seats?: number | null;
    expiresAt?: Date | null;
  }[];
  actorUserId: string;
  actorName?: string | null;
};

export type ProvisionTenantResult = {
  tenantId: string;
  slug: string;
  /** false quando o dono ainda não tem conta e ficou só o convite pendente. */
  ownerLinked: boolean;
};

/** O que `provisionTenant` usa de dentro da transação. Estende `ModuleDb` e
 *  `SlugChecker` porque delega a eles. Sintaxe de método em tudo, pelo mesmo
 *  motivo dos outros: bivariância deixa o client real do Prisma caber. */
export type ProvisionTx = ModuleDb &
  SlugChecker & {
    tenant: {
      create(args: {
        data: { name: string; slug: string };
      }): Promise<{ id: string; slug: string }>;
    };
    user: {
      findUnique(args: {
        where: { email: string };
        select?: unknown;
      }): Promise<{ id: string } | null>;
    };
    tenantMember: { create(args: { data: unknown }): Promise<{ id: string }> };
    tenantInvitation: {
      create(args: { data: unknown }): Promise<{ id: string }>;
    };
  };

export type ProvisionDb = {
  $transaction<T>(fn: (tx: ProvisionTx) => Promise<T>): Promise<T>;
};

export async function provisionTenant(
  db: ProvisionDb,
  deps: ModuleDeps,
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const name = input.name.trim();
  const email = input.ownerEmail.trim().toLowerCase();

  return await db.$transaction(async (t) => {
    const slug = await uniqueSlug(t, name);
    const tenant = await t.tenant.create({ data: { name, slug } });

    const owner = await t.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (owner) {
      await t.tenantMember.create({
        data: { tenantId: tenant.id, userId: owner.id, role: "ADMIN" },
      });
    } else {
      // Vender antes da pessoa se cadastrar é a ordem normal do comercial. O
      // tenant nasce sem dono e o convite espera.
      await t.tenantInvitation.create({
        data: {
          tenantId: tenant.id,
          email,
          role: "ADMIN",
          inviterId: input.actorUserId,
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS),
        },
      });
    }

    for (const mod of input.modules) {
      await contractModule(t, deps, {
        tenantId: tenant.id,
        module: mod.module,
        status: mod.status,
        seats: mod.seats,
        expiresAt: mod.expiresAt,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
      });
    }

    await logPlatformAudit(t, {
      tenantId: tenant.id,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: "tenant.provisioned",
      entityType: "Tenant",
      entityId: tenant.id,
      target: tenant.slug,
      note: owner ? `dono ${email}` : `convite pendente para ${email}`,
    });

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      ownerLinked: Boolean(owner),
    };
  });
}

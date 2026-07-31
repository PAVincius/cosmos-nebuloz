"use server";

import { ProvisioningError, platformDb } from "@repo/provisioning";
import { requirePlatformStaff } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  modules: { module: string; status: string; expiresAt: string | null }[];
};

/** Separado da action para poder ser testado sem banco: o filtro `isSystem`
 *  é a regra que não pode ser esquecida em nenhuma listagem. */
export function clientListArgs() {
  return {
    where: { isSystem: false },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      modules: {
        select: { module: true, status: true, expiresAt: true },
        orderBy: { module: "asc" as const },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" as const },
  };
}

export async function listClients(): Promise<Result<ClientRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const rows = await platformDb.tenant.findMany(clientListArgs());

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt.toISOString(),
      memberCount: row._count.members,
      modules: row.modules.map((m) => ({
        module: m.module,
        status: m.status,
        expiresAt: m.expiresAt?.toISOString() ?? null,
      })),
    }));
  });
}

export type ClientDetail = ClientRow & {
  members: { name: string | null; email: string; role: string }[];
  charter: {
    moduleContracted: boolean;
    hasCompliance: boolean;
    hasPolicy: boolean;
  };
};

/** Separado da action pelo mesmo motivo do `clientListArgs`: o filtro
 *  `isSystem` precisa ser testável sem banco. Slug do tenant interno não abre
 *  tela de cliente. */
export function clientDetailArgs(slug: string) {
  return {
    where: { slug, isSystem: false },
    select: {
      ...clientListArgs().select,
      members: {
        select: {
          role: true,
          user: { select: { name: true, email: true } },
        },
      },
      charterMemberships: { select: { role: true } },
      charterPolicies: { select: { id: true }, take: 1 },
    },
  };
}

export async function getClient(slug: string): Promise<Result<ClientDetail>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const tenant = await platformDb.tenant.findFirst(clientDetailArgs(slug));

    if (!tenant) {
      throw new ProvisioningError(
        "TENANT_NOT_FOUND",
        `Nenhum cliente com o slug ${slug}.`
      );
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt.toISOString(),
      memberCount: tenant._count.members,
      modules: tenant.modules.map((m) => ({
        module: m.module,
        status: m.status,
        expiresAt: m.expiresAt?.toISOString() ?? null,
      })),
      members: tenant.members.map((m) => ({
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      charter: {
        moduleContracted: tenant.modules.some(
          (m) =>
            m.module === "CHARTER" && ["ACTIVE", "TRIAL"].includes(m.status)
        ),
        hasCompliance: tenant.charterMemberships.some(
          (m) => m.role === "COMPLIANCE"
        ),
        hasPolicy: tenant.charterPolicies.length > 0,
      },
    };
  });
}

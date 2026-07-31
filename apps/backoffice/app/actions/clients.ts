"use server";

import { platformDb } from "@repo/provisioning";
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

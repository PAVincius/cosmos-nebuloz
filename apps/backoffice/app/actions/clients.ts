"use server";

import { ProvisioningError, platformDb } from "@repo/provisioning";
import { clientDetailArgs, clientListArgs } from "@/lib/client-queries";
import { requirePlatformStaff } from "@/lib/guard";
import {
  janela,
  type Listagem,
  listagem,
  type OpcoesDePagina,
} from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  /** SubscriptionPlan do tenant. Real, vem do schema — a tela mostra. */
  plan: string;
  memberCount: number;
  modules: { module: string; status: string; expiresAt: string | null }[];
};

/**
 * Sem opções, a lista de sempre (até o teto de `lib/paginacao.ts`); com
 * `{ pagina }`, `{ itens, temMais }` para a carteira mostrar mais. A forma do
 * retorno segue o argumento — ver `Listagem`.
 */
export async function listClients<
  O extends OpcoesDePagina | undefined = undefined,
>(opcoes?: O): Promise<Result<Listagem<ClientRow, O>>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const rows = await platformDb.tenant.findMany({
      ...clientListArgs(),
      ...janela(opcoes),
    });

    const linhas = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt.toISOString(),
      plan: row.plan,
      memberCount: row._count.members,
      modules: row.modules.map((m) => ({
        module: m.module,
        status: m.status,
        expiresAt: m.expiresAt?.toISOString() ?? null,
      })),
    }));
    return listagem(linhas, opcoes);
  });
}

export type ClientDetail = ClientRow & {
  members: { name: string | null; email: string; role: string }[];
  charter: {
    moduleContracted: boolean;
    hasCompliance: boolean;
    hasPolicy: boolean;
  };
  meridian: {
    moduleContracted: boolean;
    hasConsultant: boolean;
    hasTemplate: boolean;
  };
};

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
      plan: tenant.plan,
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
      meridian: {
        moduleContracted: tenant.modules.some(
          (m) =>
            m.module === "MERIDIAN" && ["ACTIVE", "TRIAL"].includes(m.status)
        ),
        hasConsultant: tenant.meridianMemberships.some(
          (m) => m.role === "CONSULTANT"
        ),
        hasTemplate: tenant.meridianTemplates.length > 0,
      },
    };
  });
}

export type ActivityRow = {
  id: string;
  action: string;
  target: string;
  actorName: string | null;
  createdAt: string;
};

const ACTIVITY_LIMIT = 100;

/** `platformStaff` é o campo que `logPlatformAudit` grava em todo ato de
 *  staff — é o que separa trilha de staff de ato do próprio cliente. */
export async function listStaffActivity(
  limit = ACTIVITY_LIMIT
): Promise<Result<ActivityRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const rows = await platformDb.auditLog.findMany({
      where: { metadata: { path: ["platformStaff"], equals: true } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, action: true, metadata: true, createdAt: true },
    });

    return rows.map((row) => {
      // Sem checagem de forma: JSON de `metadata` não tem schema garantido
      // pelo Prisma, só o que `logPlatformAudit` escreveu convencionalmente.
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const target = typeof meta.target === "string" ? meta.target : "—";
      const actorName =
        typeof meta.actorName === "string" ? meta.actorName : null;
      return {
        id: row.id,
        action: row.action,
        target,
        actorName,
        createdAt: row.createdAt.toISOString(),
      };
    });
  });
}

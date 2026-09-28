import "server-only";

import { database, withTenantDb } from "@repo/database";
import { listModules, MERIDIAN_ROLE_LABEL } from "@repo/rbac";
import {
  type MeridianContext,
  requireMeridianContext,
} from "@/lib/meridian/guards";
import { pickKnownModules } from "@/lib/shell-modules";

// Dados da casca. Uma consulta por render de layout — o layout não remonta
// entre rotas, então isto roda uma vez por navegação server-side, não por tela.

export type ModuleId = "COSMOS" | "CHARTER" | "SIGNAL" | "MERIDIAN";

const MODULE_IDS: readonly ModuleId[] = [
  "COSMOS",
  "CHARTER",
  "SIGNAL",
  "MERIDIAN",
];

export type MeridianShellData = {
  ctx: MeridianContext;
  modules: ModuleId[];
  organization: string;
  user: { name: string; role: string };
  badges: Record<string, number>;
  /** Conta ativa + contas da pessoa — AccountSwitcher (spec 009, US2). */
  activeTenantId: string;
  tenants: Array<{ id: string; name: string; role: string }>;
};

export async function getShellData(): Promise<MeridianShellData> {
  const ctx = await requireMeridianContext();

  const [modules, data, memberships] = await Promise.all([
    listModules(ctx.tenantId),
    withTenantDb(ctx.tenantId, async (db) => {
      const [tenant, contested, gapsOpen] = await Promise.all([
        db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { name: true },
        }),
        // Badge da fila = o que espera julgamento, não o total de eixos. Um
        // contador que só cresce vira ruído e a pessoa para de olhar.
        db.meridianAxisScore.count({
          where: { tenantId: ctx.tenantId, status: "CONTESTED" },
        }),
        db.meridianGap.count({
          where: { tenantId: ctx.tenantId, state: "OPEN" },
        }),
      ]);
      return { organization: tenant?.name ?? "—", contested, gapsOpen };
    }),
    // Mesma leitura de /api/tenants (TenantMember por userId, sem
    // cross-tenant — FR-014); não escopada a um tenant, então fora de
    // withTenantDb.
    database.tenantMember.findMany({
      where: { userId: ctx.userId },
      include: { tenant: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    ctx,
    modules: pickKnownModules(modules, MODULE_IDS),
    organization: data.organization,
    user: {
      name: ctx.user.name ?? ctx.user.email ?? "—",
      role: MERIDIAN_ROLE_LABEL[ctx.meridianRole],
    },
    badges: { queue: data.contested, registry: data.gapsOpen },
    activeTenantId: ctx.tenantId,
    tenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      role: m.role,
    })),
  };
}

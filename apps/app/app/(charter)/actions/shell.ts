import "server-only";

import { database, withTenantDb } from "@repo/database";
import { CHARTER_ROLE_LABEL, listModules } from "@repo/rbac";
import type { ModuleId } from "@/components/charter/shell";
import {
  type CharterContext,
  requireCharterContext,
} from "@/lib/charter/guards";
import { pickKnownModules } from "@/lib/shell-modules";

// A casca do Charter só desenha estes módulos no seletor (MODULE_META).
const MODULE_IDS: readonly ModuleId[] = ["COSMOS", "CHARTER", "SIGNAL"];

// Dados da casca. Uma consulta por render de layout — o layout não remonta entre
// rotas, então isto roda uma vez por navegação server-side, não por tela.

export type ShellData = {
  ctx: CharterContext;
  modules: ModuleId[];
  organization: string;
  user: { name: string; role: string };
  policy: { version: string | null; daysToReview: number | null } | null;
  badges: Record<string, number>;
  /** Conta ativa + contas da pessoa — AccountSwitcher (spec 009, US2). */
  activeTenantId: string;
  tenants: Array<{ id: string; name: string; role: string }>;
};

/** Dias corridos até a próxima revisão. Negativo = vencida. */
function daysUntil(date: Date | null): number | null {
  if (!date) {
    return null;
  }
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export async function getShellData(): Promise<ShellData> {
  const ctx = await requireCharterContext();

  const [modules, data, memberships] = await Promise.all([
    listModules(ctx.tenantId),
    withTenantDb(ctx.tenantId, async (db) => {
      const [tenant, policy, casesAwaiting, openMitigations, vendorsAtRisk] =
        await Promise.all([
          db.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { name: true },
          }),
          db.charterPolicy.findFirst({
            where: { tenantId: ctx.tenantId },
            select: { version: true, nextReview: true },
            orderBy: { createdAt: "asc" },
          }),
          // Badge de "Casos de Uso" = o que espera decisão, não o total. Um
          // contador que só cresce vira ruído e o usuário para de olhar.
          db.charterUseCase.count({
            where: {
              tenantId: ctx.tenantId,
              status: { in: ["SUBMITTED", "REVIEW", "CHANGES"] },
            },
          }),
          db.charterMitigation.count({
            where: {
              tenantId: ctx.tenantId,
              status: { in: ["OPEN", "PROGRESS"] },
              dueDate: { lt: new Date() },
            },
          }),
          db.charterVendor.count({
            where: {
              tenantId: ctx.tenantId,
              OR: [{ dpa: false }, { tier: "BLOCKED" }],
            },
          }),
        ]);
      return { tenant, policy, casesAwaiting, openMitigations, vendorsAtRisk };
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
    organization: data.tenant?.name ?? "Organização",
    user: {
      name: ctx.user.name ?? ctx.user.email ?? "Usuário",
      role: CHARTER_ROLE_LABEL[ctx.charterRole],
    },
    policy: data.policy
      ? {
          version: data.policy.version,
          daysToReview: daysUntil(data.policy.nextReview),
        }
      : null,
    badges: {
      cases: data.casesAwaiting,
      risk: data.openMitigations,
      vendors: data.vendorsAtRisk,
    },
    activeTenantId: ctx.tenantId,
    tenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      role: m.role,
    })),
  };
}

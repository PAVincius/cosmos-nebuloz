import "server-only";

import { database, withTenantDb } from "@repo/database";
import { listModules, SCAFFOLD_ROLE_LABEL } from "@repo/rbac";
import {
  requireScaffoldContext,
  type ScaffoldContext,
} from "@/lib/scaffold/guards";
import { DEFAULT_STALL_THRESHOLD_DAYS } from "@/lib/scaffold/stall";

// Dados da casca. Uma consulta por render de layout — o layout não remonta
// entre rotas, então isto roda uma vez por navegação server-side, não por tela.

export type ModuleId =
  | "COSMOS"
  | "CHARTER"
  | "SIGNAL"
  | "MERIDIAN"
  | "SCAFFOLD";

export type ScaffoldShellData = {
  ctx: ScaffoldContext;
  modules: ModuleId[];
  organization: string;
  user: { name: string; role: string };
  badges: Record<string, number>;
  stalledCount: number;
  totalTracks: number;
  stallThresholdDays: number;
  /** Conta ativa + contas da pessoa — AccountSwitcher (spec 009, US2). */
  activeTenantId: string;
  tenants: Array<{ id: string; name: string; role: string }>;
};

export async function getShellData(): Promise<ScaffoldShellData> {
  const ctx = await requireScaffoldContext();

  const [modules, data, memberships] = await Promise.all([
    listModules(ctx.tenantId),
    withTenantDb(ctx.tenantId, async (db) => {
      const [tenant, settings, stalled, total, awaitingCases] =
        await Promise.all([
          db.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { name: true },
          }),
          db.scaffoldSettings.findUnique({
            where: { tenantId: ctx.tenantId },
            select: { stallThresholdDays: true },
          }),
          // Badge = o que exige ação, não o total de trilhas. Um contador que
          // só cresce vira ruído e a pessoa para de olhar.
          db.scaffoldTrack.count({
            where: { tenantId: ctx.tenantId, status: "STALLED" },
          }),
          db.scaffoldTrack.count({
            where: {
              tenantId: ctx.tenantId,
              status: { in: ["ACTIVE", "STALLED"] },
            },
          }),
          db.scaffoldBusinessCase.count({
            where: {
              tenantId: ctx.tenantId,
              state: { in: ["AWAITING", "CONTESTED"] },
            },
          }),
        ]);
      return {
        organization: tenant?.name ?? "—",
        stalled,
        total,
        awaitingCases,
        stallThresholdDays:
          settings?.stallThresholdDays ?? DEFAULT_STALL_THRESHOLD_DAYS,
      };
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
    modules: modules as ModuleId[],
    organization: data.organization,
    user: {
      name: ctx.user.name ?? ctx.user.email ?? "—",
      role: SCAFFOLD_ROLE_LABEL[ctx.scaffoldRole],
    },
    // O badge de fila de gates NÃO entra: a fila é cross-tenant e vive no
    // back-office (ADR-0013, research §R4).
    badges: { portfolio: data.stalled, baselines: data.awaitingCases },
    stalledCount: data.stalled,
    totalTracks: data.total,
    stallThresholdDays: data.stallThresholdDays,
    activeTenantId: ctx.tenantId,
    tenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      role: m.role,
    })),
  };
}

import "server-only";

import { database, withTenantDb } from "@repo/database";
import { listModules, SIGNAL_ROLE_LABEL } from "@repo/rbac";
import { pickKnownModules } from "@/lib/shell-modules";
import { adoptionPct } from "@/lib/signal/adoption";
import { requireSignalContext, type SignalContext } from "@/lib/signal/guards";
import { computePortfolioRoi } from "@/lib/signal/roi";
import { isAtRisk, verdictOf } from "@/lib/signal/verdict";

// Dados da casca. Uma consulta por render de layout — o layout não remonta
// entre rotas, então isto roda uma vez por navegação server-side, não por tela.

export type ModuleId = "COSMOS" | "CHARTER" | "SIGNAL" | "MERIDIAN";

const MODULE_IDS: readonly ModuleId[] = [
  "COSMOS",
  "CHARTER",
  "SIGNAL",
  "MERIDIAN",
];

/** Contadores do sidebar. A chave é o id da tela, para a casca não precisar de
 *  um mapa paralelo. */
export type SignalBadges = {
  initiatives: number;
  alerts: number;
  evidence: number;
  reports: number;
  connections: number;
  mapping: number;
};

/** Card de portfólio do rodapé do sidebar. */
export type SignalPortfolio = {
  invested: number;
  returned: number;
  multiple: number | null;
  /** Investido das iniciativas com veredito VANITY ou STOP. */
  atRisk: number;
  fiscalYearLabel: string | null;
  currency: string;
};

export type SignalShellData = {
  ctx: SignalContext;
  modules: ModuleId[];
  organization: string;
  user: { name: string; role: string };
  badges: SignalBadges;
  /** Nulo se houver alerta WEAK aberto → o contador vira vermelho, não âmbar. */
  alertsTone: "red" | "amber" | null;
  /** Fontes não saudáveis, para o chip do topbar. */
  brokenConnections: number;
  portfolio: SignalPortfolio;
  bars: { adoptionBar: number; valueBar: number };
  /** Conta ativa + contas da pessoa — AccountSwitcher (spec 009, US2). */
  activeTenantId: string;
  tenants: Array<{ id: string; name: string; role: string }>;
};

const DEFAULT_BARS = { adoptionBar: 60, valueBar: 1.5 };

/**
 * Tom do contador de alertas no sidebar.
 *
 * WEAK ("usam e não rende") é o único que fica vermelho: os outros dois pedem
 * atenção, esse pede decisão. Contador vermelho em tudo não destaca nada.
 */
function alertsToneOf(open: number, weak: number): "red" | "amber" | null {
  if (weak > 0) {
    return "red";
  }
  return open > 0 ? "amber" : null;
}

export async function getShellData(): Promise<SignalShellData> {
  const ctx = await requireSignalContext();

  const [modules, data, memberships] = await Promise.all([
    listModules(ctx.tenantId),
    withTenantDb(ctx.tenantId, async (db) => {
      const where = { tenantId: ctx.tenantId };
      const [
        tenant,
        settings,
        activeInitiatives,
        openAlerts,
        weakAlerts,
        evidence,
        finalReports,
        unhealthyConnections,
        mappings,
      ] = await Promise.all([
        db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { name: true },
        }),
        db.signalSettings.findUnique({ where: { tenantId: ctx.tenantId } }),
        // O card de portfólio precisa das entradas, não só da contagem: o
        // investido e o retornado são somas das linhas da fórmula ativa.
        db.signalInitiative.findMany({
          where: { ...where, status: "ACTIVE" },
          select: {
            id: true,
            roiFormulas: {
              where: { state: "ACTIVE" },
              select: { entries: { select: { kind: true, total: true } } },
            },
            adoption: {
              orderBy: { periodStart: "desc" },
              take: 1,
              select: { activeUsers: true, licensedUsers: true },
            },
          },
        }),
        db.signalAlert.count({ where: { ...where, state: "OPEN" } }),
        // Alerta WEAK ("usam e não rende") é o único que torna o contador
        // vermelho: os outros dois pedem atenção, esse pede decisão.
        db.signalAlert.count({
          where: { ...where, state: "OPEN", kind: "WEAK" },
        }),
        db.signalMetricObservation.count({ where }),
        db.signalReportSnapshot.count({ where: { ...where, state: "FINAL" } }),
        db.signalConnection.count({
          where: { ...where, health: { not: "HEALTHY" } },
        }),
        db.signalMetricMapping.count({ where }),
      ]);

      return {
        organization: tenant?.name ?? "—",
        settings,
        activeInitiatives,
        openAlerts,
        weakAlerts,
        evidence,
        finalReports,
        unhealthyConnections,
        mappings,
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

  const bars = data.settings
    ? {
        adoptionBar: data.settings.adoptionBar,
        valueBar: Number(data.settings.valueBar),
      }
    : DEFAULT_BARS;

  const perInitiative = data.activeInitiatives.map((initiative) => {
    const entries = (initiative.roiFormulas[0]?.entries ?? []).map((e) => ({
      kind: e.kind,
      label: "",
      total: Number(e.total),
      sourceLabel: "",
    }));
    const roi = computePortfolioRoi([
      {
        invested: entries
          .filter((e) => e.kind === "COST")
          .reduce((a, e) => a + e.total, 0),
        returned: entries
          .filter((e) => e.kind === "RETURN")
          .reduce((a, e) => a + e.total, 0),
      },
    ]);
    const snapshot = initiative.adoption[0];
    const pct = snapshot
      ? adoptionPct({
          activeUsers: snapshot.activeUsers,
          licensedUsers: snapshot.licensedUsers,
        })
      : 0;
    return {
      invested: roi.invested,
      returned: roi.returned,
      verdict: verdictOf({ adoptionPct: pct, multiple: roi.multiple }, bars),
    };
  });

  const portfolio = computePortfolioRoi(perInitiative);
  const atRisk = perInitiative
    .filter((i) => isAtRisk(i.verdict))
    .reduce((a, i) => a + i.invested, 0);

  return {
    ctx,
    modules: pickKnownModules(modules, MODULE_IDS),
    organization: data.organization,
    user: {
      name: ctx.user.name ?? ctx.user.email ?? "—",
      role: SIGNAL_ROLE_LABEL[ctx.signalRole],
    },
    badges: {
      initiatives: data.activeInitiatives.length,
      alerts: data.openAlerts,
      evidence: data.evidence,
      reports: data.finalReports,
      connections: data.unhealthyConnections,
      mapping: data.mappings,
    },
    alertsTone: alertsToneOf(data.openAlerts, data.weakAlerts),
    brokenConnections: data.unhealthyConnections,
    portfolio: {
      ...portfolio,
      atRisk,
      fiscalYearLabel: data.settings?.fiscalYearLabel ?? null,
      currency: data.settings?.currency ?? "BRL",
    },
    bars,
    activeTenantId: ctx.tenantId,
    tenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      role: m.role,
    })),
  };
}

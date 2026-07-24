// Tenant-scoped cost anomaly detection routine — reads BillingEntry,
// groups by (service, accountId), computes a monthly baseline via
// lib/cost/anomaly-detection.ts, and writes CostAnomaly rows for breaches.
//
// Idempotency: CostAnomaly's DB unique constraint is
// (tenantId, themeId, service, period) — themeId is nullable, and Postgres
// treats NULLs as distinct in unique indexes, so that constraint does NOT
// dedupe rows sharing the same (tenantId, service, period) with different
// accountId when themeId is null (the common case here, since detection
// groups by accountId, not themeId). We therefore rely on an explicit
// find-then-create guarded by (tenantId, service, accountId, period)
// before every insert. This is a find-then-create race window, not a DB
// guarantee — the same class of risk noted for FlowMetricSnapshot
// elsewhere in this codebase. Acceptable here because detection is
// triggered by a single ADMIN action (or a future single-concurrency
// Inngest job), not by concurrent user requests; a real fix would add a
// migration for a proper unique index, which is out of scope per the
// "no migration unless trivial" constraint.
import { database } from "@repo/database";
import {
  DEFAULT_SENSITIVITY_THRESHOLD,
  detectCostAnomaly,
} from "./anomaly-detection";

export const COST_ANOMALY_RULE_ID = "R-COST-01";

// Trailing months of BillingEntry history considered for the baseline
// (excludes the current, in-progress month).
const LOOKBACK_MONTHS = 6;

// AnomalyRuleConfig.artId is non-nullable in its unique key in practice —
// existing cost/flow rule configs use "" as the tenant-wide (no ART scope)
// sentinel (see app/actions/intelligence/anomalyRules.ts). Cost anomalies
// are tenant-wide, not per-ART, so we reuse that convention.
const TENANT_WIDE_ART_SENTINEL = "";

function monthStart(date: Date, offsetMonths = 0): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1)
  );
}

type BillingGroup = {
  service: string;
  accountId: string;
  integrationId: string;
  monthly: Map<string, number>;
};

export type DetectCostAnomaliesResult = {
  evaluated: number;
  created: number;
};

export async function detectCostAnomaliesForTenant(
  tenantId: string,
  now: Date = new Date()
): Promise<DetectCostAnomaliesResult> {
  const currentMonthStart = monthStart(now);
  const currentMonthKey = currentMonthStart.toISOString();
  const historyStart = monthStart(now, -LOOKBACK_MONTHS);
  const nextMonthStart = monthStart(now, 1);

  const ruleConfig = await database.anomalyRuleConfig.findUnique({
    where: {
      tenantId_artId_ruleId: {
        tenantId,
        artId: TENANT_WIDE_ART_SENTINEL,
        ruleId: COST_ANOMALY_RULE_ID,
      },
    },
    select: { threshold: true, isDisabled: true },
  });

  if (ruleConfig?.isDisabled) {
    return { evaluated: 0, created: 0 };
  }
  const threshold = ruleConfig?.threshold ?? DEFAULT_SENSITIVITY_THRESHOLD;

  const entries = await database.billingEntry.findMany({
    where: {
      tenantId,
      usageStartDate: { gte: historyStart, lt: nextMonthStart },
    },
    select: {
      service: true,
      accountId: true,
      integrationId: true,
      usageStartDate: true,
      tenantAmount: true,
    },
  });

  const groups = new Map<string, BillingGroup>();
  for (const entry of entries) {
    const key = `${entry.service}::${entry.accountId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        service: entry.service,
        accountId: entry.accountId,
        integrationId: entry.integrationId,
        monthly: new Map(),
      };
      groups.set(key, group);
    }
    const monthKey = monthStart(entry.usageStartDate).toISOString();
    const amount = Number(entry.tenantAmount);
    group.monthly.set(monthKey, (group.monthly.get(monthKey) ?? 0) + amount);
  }

  let evaluated = 0;
  let created = 0;

  for (const group of groups.values()) {
    evaluated += 1;

    const current = group.monthly.get(currentMonthKey) ?? 0;
    const history = [...group.monthly.entries()]
      .filter(([monthKey]) => monthKey !== currentMonthKey)
      .map(([, total]) => total);

    const result = detectCostAnomaly({ current, history, threshold });
    if (!result) {
      continue;
    }

    // Idempotency guard — see module doc comment above.
    const existing = await database.costAnomaly.findFirst({
      where: {
        tenantId,
        service: group.service,
        accountId: group.accountId,
        period: currentMonthStart,
      },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    await database.costAnomaly.create({
      data: {
        tenantId,
        integrationId: group.integrationId,
        period: currentMonthStart,
        service: group.service,
        accountId: group.accountId,
        baselineMedian: result.median,
        baselineMAD: result.mad,
        actualAmount: result.actual,
        modifiedZScore: result.modifiedZScore,
        deltaAbs: result.deltaAbs,
        deltaPct: result.deltaPct,
        severity: result.severity,
        status: "OPEN",
      },
    });
    created += 1;
  }

  return { evaluated, created };
}

// Tenant-scoped cost anomaly detection routine — reads BillingEntry,
// groups by (service, accountId), computes a monthly baseline via
// lib/cost/anomaly-detection.ts, and writes CostAnomaly rows for breaches.
//
// Idempotency: CostAnomaly has a real DB unique constraint on
// (tenantId, service, accountId, period) — see migration
// 20260724050000_cost_anomaly_unique_key. We rely on that constraint
// directly: create() and, on a P2002 conflict, treat the racing loser as a
// caught no-op — the same pattern used for FlowMetricSnapshot/
// TeamCapacitySnapshot origination (app/actions/sprints/snapshot-origination.ts).
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

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

    // Idempotency guard — see module doc comment above. Relies on the DB
    // unique constraint: a racing/duplicate write hits P2002 and is treated
    // as a caught no-op rather than a double-inserted anomaly.
    try {
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
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  return { evaluated, created };
}

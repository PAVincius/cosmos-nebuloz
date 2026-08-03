"use server";

// anomalies.ts — Cost Anomalies screen actions. Backed by the CostAnomaly
// model (packages/database/prisma/schema/finops.prisma), detected from
// real BillingEntry data via lib/cost/detect-cost-anomalies.ts (median/MAD
// modified z-score). This is COST anomaly detection — a different model
// from the flow-anomaly pipeline (app/actions/flow-intelligence/*, the
// Anomaly/AnomalyDetectionRun models) — do not conflate the two.
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  DEFAULT_SENSITIVITY_THRESHOLD,
  SENSITIVITY_BOUNDS,
} from "@/lib/cost/anomaly-detection";
import {
  type CostAnomalyNarrativeResult,
  generateCostAnomalyNarrative,
} from "@/lib/cost/anomaly-narrative";
import {
  COST_ANOMALY_RULE_ID,
  detectCostAnomaliesForTenant,
} from "@/lib/cost/detect-cost-anomalies";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

const TENANT_WIDE_ART_SENTINEL = "";

function cacheTag(tenantId: string): string {
  return `cost-anomalies:${tenantId}`;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export type CostAnomalyView = {
  id: string;
  service: string | null;
  accountId: string | null;
  period: string;
  detectedAt: string;
  baselineMedian: number;
  baselineMAD: number;
  actualAmount: number;
  modifiedZScore: number;
  deltaAbs: number;
  deltaPct: number;
  severity: string;
  status: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
};

export type CostAnomaliesList = {
  items: CostAnomalyView[];
  hasBillingData: boolean;
};

export async function listCostAnomalies(): Promise<Result<CostAnomaliesList>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const [rows, anyBilling] = await Promise.all([
      database.costAnomaly.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
      }),
      database.billingEntry.findFirst({
        where: { tenantId: ctx.tenantId },
        select: { id: true },
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        service: r.service,
        accountId: r.accountId,
        period: r.period.toISOString(),
        detectedAt: r.detectedAt.toISOString(),
        baselineMedian: Number(r.baselineMedian),
        baselineMAD: Number(r.baselineMAD),
        actualAmount: Number(r.actualAmount),
        modifiedZScore: Number(r.modifiedZScore),
        deltaAbs: Number(r.deltaAbs),
        deltaPct: Number(r.deltaPct),
        severity: r.severity,
        status: r.status,
        acknowledgedBy: r.acknowledgedBy,
        acknowledgedAt: r.acknowledgedAt
          ? r.acknowledgedAt.toISOString()
          : null,
      })),
      hasBillingData: anyBilling !== null,
    };
  });
}

export type AnomalySensitivity = {
  threshold: number;
  isDefault: boolean;
  bounds: { min: number; max: number };
};

export async function getAnomalySensitivity(): Promise<
  Result<AnomalySensitivity>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const config = await database.anomalyRuleConfig.findUnique({
      where: {
        tenantId_artId_ruleId: {
          tenantId: ctx.tenantId,
          artId: TENANT_WIDE_ART_SENTINEL,
          ruleId: COST_ANOMALY_RULE_ID,
        },
      },
      select: { threshold: true },
    });

    return {
      threshold: config
        ? Number(config.threshold)
        : DEFAULT_SENSITIVITY_THRESHOLD,
      isDefault: !config,
      bounds: SENSITIVITY_BOUNDS,
    };
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const SetSensitivitySchema = z.object({
  threshold: z.number(),
});

export async function setAnomalySensitivity(
  raw: unknown
): Promise<Result<{ threshold: number }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const { threshold } = SetSensitivitySchema.parse(raw);
    if (
      threshold < SENSITIVITY_BOUNDS.min ||
      threshold > SENSITIVITY_BOUNDS.max
    ) {
      throw new Error(
        `Sensibilidade fora dos limites (${SENSITIVITY_BOUNDS.min}–${SENSITIVITY_BOUNDS.max}).`
      );
    }

    const config = await database.anomalyRuleConfig.upsert({
      where: {
        tenantId_artId_ruleId: {
          tenantId: ctx.tenantId,
          artId: TENANT_WIDE_ART_SENTINEL,
          ruleId: COST_ANOMALY_RULE_ID,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        artId: TENANT_WIDE_ART_SENTINEL,
        ruleId: COST_ANOMALY_RULE_ID,
        threshold,
      },
      update: { threshold },
      select: { threshold: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "AnomalyRuleConfig",
      entityId: COST_ANOMALY_RULE_ID,
      diff: { threshold: String(threshold) },
    });
    revalidateTag(cacheTag(ctx.tenantId), "max");

    return { threshold: Number(config.threshold) };
  });
}

// story-021 AC-008 ("Threshold reset to default"): the override row is
// DELETED, not rewritten with today's default. Rewriting would pin 3.5 as the
// tenant's own choice — indistinguishable from "follows the platform" in the
// data, and it would ignore any future change to the platform default.
// deleteMany (not delete) because deleting a row that is not there is the
// normal case, not an error: delete would throw P2025 and turn a legitimate
// no-op into a failure the caller has to special-case.
export async function resetAnomalySensitivity(): Promise<
  Result<{ threshold: number; wasOverridden: boolean }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const { count } = await database.anomalyRuleConfig.deleteMany({
      where: {
        tenantId: ctx.tenantId,
        artId: TENANT_WIDE_ART_SENTINEL,
        ruleId: COST_ANOMALY_RULE_ID,
      },
    });

    // Nothing was overridden — nothing changed, so nothing is audited. An
    // audit entry for a no-op is a false record of a change.
    if (count > 0) {
      await logAudit(ctx.tenantId, {
        userId: ctx.userId,
        action: "deleted",
        entityType: "AnomalyRuleConfig",
        entityId: COST_ANOMALY_RULE_ID,
        diff: {
          threshold: `override→padrão (${DEFAULT_SENSITIVITY_THRESHOLD})`,
        },
      });
      revalidateTag(cacheTag(ctx.tenantId), "max");
    }

    return {
      threshold: DEFAULT_SENSITIVITY_THRESHOLD,
      wasOverridden: count > 0,
    };
  });
}

const AcknowledgeSchema = z.object({
  id: z.string().min(1),
  status: z
    .enum(["ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"])
    .default("ACKNOWLEDGED"),
});

export async function acknowledgeCostAnomaly(
  raw: unknown
): Promise<Result<{ id: string; status: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE", "RTE"], ctx);

    const { id, status } = AcknowledgeSchema.parse(raw);

    // IDOR guard — id + tenantId together, updateMany never touches rows
    // outside the caller's tenant even if `id` is guessed/enumerated.
    const result = await database.costAnomaly.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        status,
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new Error("Anomalia não encontrada.");
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "CostAnomaly",
      entityId: id,
      diff: { status },
    });
    revalidateTag(cacheTag(ctx.tenantId), "max");

    return { id, status };
  });
}

export async function detectCostAnomaliesNow(): Promise<
  Result<{ evaluated: number; created: number }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const result = await detectCostAnomaliesForTenant(ctx.tenantId);

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "CostAnomalyDetectionRun",
      entityId: ctx.tenantId,
      diff: {
        evaluated: String(result.evaluated),
        created: String(result.created),
      },
    });
    revalidateTag(cacheTag(ctx.tenantId), "max");

    return result;
  });
}

const NarrativeSchema = z.object({ id: z.string().min(1) });

export async function generateCostAnomalyNarrativeAction(
  raw: unknown
): Promise<Result<CostAnomalyNarrativeResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { id } = NarrativeSchema.parse(raw);

    const anomaly = await database.costAnomaly.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        service: true,
        accountId: true,
        actualAmount: true,
        baselineMedian: true,
        deltaPct: true,
        modifiedZScore: true,
        severity: true,
      },
    });

    if (!anomaly) {
      throw new Error("Anomalia não encontrada.");
    }

    return generateCostAnomalyNarrative({
      service: anomaly.service,
      accountId: anomaly.accountId,
      actualAmount: Number(anomaly.actualAmount),
      baselineMedian: Number(anomaly.baselineMedian),
      deltaPct: Number(anomaly.deltaPct),
      modifiedZScore: Number(anomaly.modifiedZScore),
      severity: anomaly.severity,
    });
  });
}

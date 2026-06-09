"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type DetectedAnomaly, runAllRules } from "./anomaly-rules";

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const err = (error: string): Err => ({ ok: false, error });

export type AnalyzeResult = {
  runId: string;
  anomalies: DetectedAnomaly[];
  autoCreatedActionIds: string[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    priority: string;
  };
};

async function createAutoActionsForCritical(
  criticalAnomalies: DetectedAnomaly[],
  snapshot: { scope: string; scopeId: string },
  tenantId: string,
  runId: string
): Promise<string[]> {
  const ids: string[] = [];
  for (const anomaly of criticalAnomalies) {
    const action = await database.improvementAction.create({
      data: {
        tenantId,
        title: `[Auto] ${anomaly.rule} — ação imediata necessária`,
        scope: snapshot.scope,
        scopeId: snapshot.scopeId,
        relatedMetric: anomaly.suggestedMetric ?? anomaly.metric,
        status: "OPEN",
        source: "ai_copilot",
        sourceRunId: runId,
      },
    });
    ids.push(action.id);
  }
  return ids;
}

export async function analyzeFlowAnomalies(
  snapshotId: string,
  trigger: "manual" | "scheduled" | "snapshot_created" = "manual"
): Promise<Ok<AnalyzeResult> | Err> {
  const { tenantId } = await requireTenantSession(await headers());

  const snapshot = await database.flowMetricSnapshot.findFirst({
    where: { id: snapshotId, tenantId },
  });
  if (!snapshot) {
    return err("Snapshot not found");
  }

  const run = await database.anomalyDetectionRun.create({
    data: {
      tenantId,
      scope: snapshot.scope,
      scopeId: snapshot.scopeId,
      snapshotId,
      trigger,
      status: "RUNNING",
    },
  });

  const [history, openActions, latestAssessment] = await Promise.all([
    database.flowMetricSnapshot.findMany({
      where: {
        tenantId,
        scope: snapshot.scope,
        scopeId: snapshot.scopeId,
        isArchived: false,
        id: { not: snapshotId },
      },
      orderBy: { recordedAt: "desc" },
      take: 4,
      select: {
        flowVelocityTotal: true,
        flowPredictability: true,
        flowTimeAvgHours: true,
      },
    }),
    database.improvementAction.findMany({
      where: {
        tenantId,
        scopeId: snapshot.scopeId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { id: true, dueDate: true, status: true },
    }),
    database.competencyAssessment.findFirst({
      where: { tenantId, scopeId: snapshot.scopeId },
      orderBy: { assessedAt: "desc" },
      select: { assessedAt: true },
    }),
  ]);

  const anomalies = runAllRules({
    current: {
      flowVelocityTotal: snapshot.flowVelocityTotal,
      flowTimeAvgDays: (snapshot.flowTimeAvgHours ?? 0) / 24,
      flowEfficiency: snapshot.flowEfficiency,
      flowPredictability: snapshot.flowPredictability,
      flowLoadCurrent: snapshot.flowLoadCurrent,
      flowDistribution:
        (snapshot.flowDistribution as Record<string, number>) ?? {},
    },
    history: history.map((h) => ({
      flowVelocityTotal: h.flowVelocityTotal,
      flowPredictability: h.flowPredictability,
      flowTimeAvgDays:
        h.flowTimeAvgHours != null ? h.flowTimeAvgHours / 24 : undefined,
    })),
    openActions: openActions.map((a) => ({
      id: a.id,
      dueDate: a.dueDate,
      status: a.status,
    })),
    latestAssessmentAt: latestAssessment?.assessedAt ?? null,
    now: new Date(),
  });

  if (anomalies.length > 0) {
    await database.anomaly.createMany({
      data: anomalies.map((a) => ({
        tenantId,
        runId: run.id,
        rule: a.rule,
        severity: a.severity,
        metric: a.metric,
        delta: a.delta,
        metadata: JSON.parse(JSON.stringify(a.metadata)),
      })),
    });
  }

  const criticalAnomalies = anomalies.filter((a) => a.severity === "CRITICAL");
  const autoCreatedActionIds = await createAutoActionsForCritical(
    criticalAnomalies,
    { scope: snapshot.scope, scopeId: snapshot.scopeId },
    tenantId,
    run.id
  );

  const bySeverity: Record<string, number> = {};
  for (const a of anomalies) {
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  }

  let priority: string;
  if (bySeverity.CRITICAL > 0) {
    priority = "CRITICAL";
  } else if (bySeverity.HIGH > 0) {
    priority = "HIGH";
  } else if (bySeverity.MEDIUM > 0) {
    priority = "MEDIUM";
  } else if (anomalies.length > 0) {
    priority = "LOW";
  } else {
    priority = "HEALTHY";
  }

  const summary = { total: anomalies.length, bySeverity, priority };

  await database.anomalyDetectionRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", summary, completedAt: new Date() },
  });

  return ok({ runId: run.id, anomalies, autoCreatedActionIds, summary });
}

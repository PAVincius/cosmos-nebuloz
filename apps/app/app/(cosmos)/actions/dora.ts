"use server";

// dora.ts — DORA metrics (Track 2 foundation, item a), by explicit product
// decision: only deployment frequency and lead time are wired. Change
// failure rate and MTTR need incident data with no source today (no
// Incident model, no PagerDuty/Opsgenie/etc integration) — they are
// returned as an explicit "unavailable" marker, never as a fabricated 0
// (a 0 change-failure-rate reads as "zero failures ever", which nothing
// backs). Scope is tenant-wide (all production deployments aggregated):
// a per-ART breakdown would need a repo→ART mapping that GitHubDeploymentEvent
// doesn't have (only githubRepo, no artId) — a real follow-up, not invented here.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import {
  computeDORAMetrics,
  type DeploymentRecord,
} from "@/lib/github/dora-metrics";
import { type Result, safeAction } from "../../actions/_base";

const WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const VALID_DEPLOYMENT_STATES = new Set<DeploymentRecord["state"]>([
  "success",
  "failure",
  "error",
]);
function isDeploymentRecordState(
  state: string
): state is DeploymentRecord["state"] {
  return VALID_DEPLOYMENT_STATES.has(state as DeploymentRecord["state"]);
}

export type DoraMetricValue =
  | { status: "measured"; value: number }
  | { status: "unavailable"; reason: string };

/** Metrics with no data source at all today — always this shape, never "measured". */
export type DoraUnavailableMetric = { status: "unavailable"; reason: string };

export type DoraMetricsView = {
  windowDays: number;
  hasProductionDeployments: boolean;
  totalProductionDeployments: number;
  successfulProductionDeployments: number;
  /** deployments/day, over the window */
  deploymentFrequency: DoraMetricValue;
  /** avg hours from first commit to deploy */
  leadTimeHours: DoraMetricValue;
  /** always unavailable today — no Incident model / incident-source integration */
  changeFailureRate: DoraUnavailableMetric;
  /** always unavailable today — no Incident model / incident-source integration */
  mttrHours: DoraUnavailableMetric;
};

const NO_INCIDENT_SOURCE = "sem fonte de incidente";
const NO_RECOGNIZED_DEPLOYMENT_STATE =
  "nenhum deployment de produção com estado reconhecido";

export async function getDoraMetrics(): Promise<Result<DoraMetricsView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const since = new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY);
    const events = await database.gitHubDeploymentEvent.findMany({
      where: {
        tenantId: ctx.tenantId,
        environment: "production",
        deployedAt: { gte: since },
      },
      select: { deployedAt: true, firstCommitAt: true, state: true },
    });

    if (events.length === 0) {
      const noDeployments = "nenhum deployment de produção registrado";
      return {
        windowDays: WINDOW_DAYS,
        hasProductionDeployments: false,
        totalProductionDeployments: 0,
        successfulProductionDeployments: 0,
        deploymentFrequency: { status: "unavailable", reason: noDeployments },
        leadTimeHours: { status: "unavailable", reason: noDeployments },
        changeFailureRate: {
          status: "unavailable",
          reason: NO_INCIDENT_SOURCE,
        },
        mttrHours: { status: "unavailable", reason: NO_INCIDENT_SOURCE },
      };
    }

    const deployments: DeploymentRecord[] = events
      .filter((e) => isDeploymentRecordState(e.state))
      .map((e) => ({
        deployedAt: e.deployedAt,
        firstCommitAt: e.firstCommitAt,
        state: e.state as DeploymentRecord["state"],
      }));

    const metrics = computeDORAMetrics(deployments, [], WINDOW_DAYS);

    const successful = deployments.filter((d) => d.state === "success");
    // firstCommitAt is written nowhere in the GitHub ingestion pipeline today
    // (see github-pull.ts handleDeploymentStatus) — computeDORAMetrics()
    // silently averages over an empty array (→ 0) when no deployment has it
    // set. Surfacing that 0 as "0h lead time" would be the same fabrication
    // this task explicitly rules out for CFR/MTTR, so it's gated on an
    // actual sample existing.
    const leadTimeSampleSize = successful.filter(
      (d) => d.firstCommitAt != null
    ).length;

    return {
      windowDays: WINDOW_DAYS,
      hasProductionDeployments: true,
      totalProductionDeployments: deployments.length,
      successfulProductionDeployments: successful.length,
      // Production events existed (events.length > 0 passed the guard above),
      // but every one may have an unrecognized GitHub state (closed set,
      // isDeploymentRecordState) — deployments then ends up empty and
      // computeDORAMetrics([...]) would return a real 0, which reads as
      // "measured zero deploys" despite unclassifiable production events
      // actually existing. Same fabrication class the CFR/MTTR markers guard
      // against, so gate on deployments.length rather than trusting the
      // computed value.
      deploymentFrequency:
        deployments.length > 0
          ? { status: "measured", value: metrics.deploymentFrequency }
          : { status: "unavailable", reason: NO_RECOGNIZED_DEPLOYMENT_STATE },
      leadTimeHours:
        leadTimeSampleSize > 0
          ? { status: "measured", value: metrics.avgLeadTimeHours }
          : {
              status: "unavailable",
              reason:
                "nenhum deployment de produção tem commit inicial vinculado",
            },
      changeFailureRate: { status: "unavailable", reason: NO_INCIDENT_SOURCE },
      mttrHours: { status: "unavailable", reason: NO_INCIDENT_SOURCE },
    };
  });
}

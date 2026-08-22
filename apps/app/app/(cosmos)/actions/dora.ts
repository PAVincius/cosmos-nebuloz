"use server";

// dora.ts — DORA metrics. Três das quatro são derivadas de
// GitHubDeploymentEvent: deployment frequency, lead time e change failure rate.
//
// Change failure rate aqui é *deployment de produção que falhou sobre
// deployment de produção concluído* — `state` em failure|error sobre
// success|failure|error. Isso não é idêntico à definição canônica do DORA
// ("deployment que degradou o serviço e exigiu remediação"): um deploy que
// sobe limpo e derruba a produção dez minutos depois não aparece aqui. É a
// fatia observável com a fonte que existe, e o denominador acompanha o número
// justamente para a leitora poder julgar — 50% sobre 4 deploys e 50% sobre 400
// não se leem igual.
//
// MTTR continua indisponível, e de propósito. "Tempo até restaurar" precisa de
// início e fim de incidente; não há model Incident nem integração de
// PagerDuty/Opsgenie no repo. Nenhum proxy é aceitável — usar duração de
// deployment, intervalo até o próximo deploy ou qualquer estimativa produziria
// um número que alguém usaria para decidir. Marcador explícito de
// indisponibilidade, com o motivo, nunca um 0.
//
// Escopo é o tenant inteiro (todos os deployments de produção agregados): uma
// quebra por ART exigiria um mapa repo→ART que GitHubDeploymentEvent não tem
// (só githubRepo, sem artId) — follow-up real, não inventado aqui.
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
type DoraUnavailableMetric = { status: "unavailable"; reason: string };

export type DoraMetricsView = {
  windowDays: number;
  hasProductionDeployments: boolean;
  /** deployments de produção concluídos (estado reconhecido) — o denominador */
  totalProductionDeployments: number;
  successfulProductionDeployments: number;
  /** deployments de produção em failure|error — o numerador do CFR */
  failedProductionDeployments: number;
  /** deployments/day, over the window */
  deploymentFrequency: DoraMetricValue;
  /** avg hours from first commit to deploy */
  leadTimeHours: DoraMetricValue;
  /** falha de deployment sobre deployment concluído, 0–1 (ver cabeçalho) */
  changeFailureRate: DoraMetricValue;
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
        failedProductionDeployments: 0,
        deploymentFrequency: { status: "unavailable", reason: noDeployments },
        leadTimeHours: { status: "unavailable", reason: noDeployments },
        changeFailureRate: { status: "unavailable", reason: noDeployments },
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
    // failure e error são os dois estados terminais de fracasso do GitHub;
    // deployment ainda em voo (pending, in_progress, queued) já ficou de fora
    // do array acima e portanto não entra nem no numerador nem no denominador.
    const failed = deployments.filter((d) => d.state !== "success");
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
      failedProductionDeployments: failed.length,
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
      // Mesmo portão do deploymentFrequency: sem deployment de estado
      // reconhecido não há denominador, e 0/0 viraria um 0% que leria como
      // "nenhum deploy jamais falhou".
      changeFailureRate:
        deployments.length > 0
          ? { status: "measured", value: failed.length / deployments.length }
          : { status: "unavailable", reason: NO_RECOGNIZED_DEPLOYMENT_STATE },
      mttrHours: { status: "unavailable", reason: NO_INCIDENT_SOURCE },
    };
  });
}

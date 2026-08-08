import { database } from "@repo/database";
import { resend } from "@repo/email";
import { keys } from "@repo/email/keys";
import { log } from "@repo/observability/log";
import { computeArtHealth } from "@/lib/analytics/art-health";
import { inngest } from "./client";

export const runScheduledReport = inngest.createFunction(
  {
    id: "scheduled-report-run",
    concurrency: { limit: 5 },
    triggers: [{ event: "reporting/scheduled-report.run" }],
  },
  async ({ event, step }) => {
    const { reportId, executionId } = event.data as {
      reportId: string;
      executionId: string;
      triggeredBy?: string;
    };

    await step.run("mark-running", () =>
      database.scheduledReportExecution.update({
        where: { id: executionId },
        data: { status: "RUNNING", attempts: { increment: 1 } },
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report = await step.run(
      "load-report",
      () =>
        database.scheduledReport.findUniqueOrThrow({
          where: { id: reportId },
        }) as Promise<any>
    );

    const artifactRef = await step.run("generate-export", async () => {
      if (report.type === "EXECUTIVE_SUMMARY") {
        return generateExecutiveSummaryHtml(report);
      }
      return generateCsvExport(report);
    });

    await step.run("deliver", () => entregarRelatorio(report, artifactRef));

    const now = new Date();
    await step.run("mark-delivered", () =>
      database.$transaction([
        database.scheduledReportExecution.update({
          where: { id: executionId },
          data: {
            status: "DELIVERED",
            pdfUrl: artifactRef,
            executedAt: now,
          },
        }),
        database.scheduledReport.update({
          where: { id: reportId },
          data: { updatedAt: now },
        }),
      ])
    );

    database.auditLog
      .create({
        data: {
          tenantId: report.tenantId,
          action: "reporting.scheduled.delivered",
          actorType: "system",
          metadata: { reportId, executionId, recipients: report.recipients },
        },
      })
      .catch((e) => {
        log.error("[scheduled-report-runner] audit log failed", e);
      });

    return { reportId, executionId, status: "DELIVERED" };
  }
);

/**
 * O remetente vinha literal como "reports@cosmos.app" — domínio não
 * verificado no Resend faz o envio falhar, e o erro era engolido: o
 * `step.run` seguinte marcava DELIVERED do mesmo jeito, então o relatório
 * sumia sem erro visível. `RESEND_FROM` já existia em packages/email/keys.ts,
 * validado como email, e era ignorado.
 */
export async function entregarRelatorio(
  report: { name: string; type: string; recipients: string[] },
  html: string
): Promise<void> {
  if (report.recipients.length === 0 || report.type !== "EXECUTIVE_SUMMARY") {
    return;
  }

  const { error } = await resend.emails.send({
    from: keys().RESEND_FROM,
    to: report.recipients,
    subject: `Executive Summary: ${report.name}`,
    html,
  });

  if (error) {
    throw new Error(`Falha ao entregar relatório: ${error.message}`);
  }
}

// ── Executive Summary HTML (AC-004) ──────────────────────────────────────────

async function generateExecutiveSummaryHtml(report: {
  tenantId: string;
  name: string;
  artId: string | null;
}): Promise<string> {
  const artWhere = {
    tenantId: report.tenantId,
    status: "ACTIVE",
    ...(report.artId ? { id: report.artId } : {}),
  };

  const [arts, snapshots, anomalies] = await Promise.all([
    database.aRT.findMany({
      where: artWhere,
      select: {
        id: true,
        name: true,
        piPlans: {
          orderBy: { startDate: "desc" as const },
          take: 1,
          select: {
            piObjectives: { select: { status: true, isStretch: true } },
          },
        },
      },
    }),
    database.flowMetricSnapshot.findMany({
      where: {
        tenantId: report.tenantId,
        scope: "art",
        period: "pi",
        ...(report.artId ? { scopeId: report.artId } : {}),
      },
      orderBy: { recordedAt: "desc" as const },
      take: 20,
      select: {
        scopeId: true,
        flowEfficiency: true,
        flowTimeMedianHours: true,
      },
    }),
    database.anomaly.findMany({
      where: {
        tenantId: report.tenantId,
        status: "OPEN",
        severity: "CRITICAL",
        ...(report.artId ? { entityId: report.artId } : {}),
      },
      orderBy: { detectedAt: "desc" as const },
      take: 10,
      select: { rule: true, metric: true, entityType: true, detectedAt: true },
    }),
  ]);

  const snapshotByArt = new Map(snapshots.map((s) => [s.scopeId, s]));

  const artRows = arts.map((art) => {
    const objs = art.piPlans[0]?.piObjectives.filter((o) => !o.isStretch) ?? [];
    const achieved = objs.filter((o) => o.status === "ACHIEVED").length;
    const ppm = objs.length > 0 ? achieved / objs.length : 0;
    const snap = snapshotByArt.get(art.id);
    const critCount = anomalies.filter((a) => a.entityType === art.id).length;
    const state = computeArtHealth({
      anomalies: Array.from({ length: critCount }, () => ({
        severity: "CRITICAL",
      })),
      piPPM: ppm,
    });
    return {
      name: art.name,
      predictability: `${Math.round(ppm * 100)}%`,
      flowEff: snap ? `${Math.round(snap.flowEfficiency * 100)}%` : "—",
      cycleTime: snap ? `${Math.round(snap.flowTimeMedianHours / 24)}d` : "—",
      health: state,
      critAnomalies: critCount,
    };
  });

  const rows = artRows
    .map(
      (r) => `<tr>
      <td>${r.name}</td>
      <td>${r.predictability}</td>
      <td>${r.flowEff}</td>
      <td>${r.cycleTime}</td>
      <td>${r.health}</td>
      <td>${r.critAnomalies}</td>
    </tr>`
    )
    .join("\n");

  const anomalyRows = anomalies
    .map(
      (a) => `<tr>
      <td>${a.rule}</td>
      <td>${a.metric}</td>
      <td>${a.entityType ?? "—"}</td>
      <td>${a.detectedAt.toISOString().slice(0, 10)}</td>
    </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:sans-serif;color:#111}
  h1{color:#1e40af}
  table{border-collapse:collapse;width:100%;margin:16px 0}
  th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left}
  th{background:#f3f4f6}
</style></head>
<body>
<h1>${report.name}</h1>
<h2>ART Health Summary</h2>
<table>
  <thead><tr>
    <th>ART</th><th>Predictability</th><th>Flow Efficiency</th>
    <th>Cycle Time</th><th>Health</th><th>Critical Anomalies</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<h2>Critical Anomalies</h2>
<table>
  <thead><tr><th>Rule</th><th>Metric</th><th>Entity</th><th>Detected</th></tr></thead>
  <tbody>${anomalyRows || "<tr><td colspan='4'>None</td></tr>"}</tbody>
</table>
</body>
</html>`;
}

// ── CSV fallback (existing logic) ─────────────────────────────────────────────

async function generateCsvExport(report: {
  tenantId: string;
  config: unknown;
}): Promise<string> {
  const config = report.config as Record<string, unknown>;
  const entityType = (config.entityType as string) ?? "epics";
  let rows: Record<string, unknown>[] = [];

  if (entityType === "epics") {
    rows = await database.epic.findMany({
      where: { tenantId: report.tenantId },
      select: {
        id: true,
        title: true,
        statusId: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 10_000,
      orderBy: { createdAt: "desc" },
    });
  } else if (entityType === "features") {
    rows = await database.feature.findMany({
      where: { tenantId: report.tenantId },
      select: {
        id: true,
        title: true,
        statusId: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 10_000,
      orderBy: { createdAt: "desc" },
    });
  }

  return serializeToDataUrl(rows);
}

function serializeToDataUrl(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          const s =
            v instanceof Date ? v.toISOString() : (String(v ?? "") as string);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    ),
  ];
  return `data:text/csv;base64,${Buffer.from(lines.join("\n")).toString("base64")}`;
}

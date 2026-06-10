import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

export const runScheduledReport = inngest.createFunction(
  {
    id: "scheduled-report-run",
    concurrency: { limit: 5 },
  },
  { event: "reporting/scheduled-report.run" },
  async ({ event, step }) => {
    const { reportId, executionId } = event.data as {
      reportId: string;
      executionId: string;
    };

    await step.run("mark-running", () =>
      database.scheduledReportExecution.update({
        where: { id: executionId },
        data: { status: "RUNNING", attempts: { increment: 1 } },
      })
    );

    const report = await step.run("load-report", () =>
      database.scheduledReport.findUniqueOrThrow({
        where: { id: reportId },
        select: {
          id: true,
          tenantId: true,
          name: true,
          recipients: true,
          slackChannelId: true,
          config: true,
        },
      })
    );

    const csvUrl = await step.run("generate-export", async () => {
      // Build CSV rows from report config
      const config = report.config as Record<string, unknown>;
      const entityType = (config.entityType as string) ?? "epics";

      let rows: Record<string, unknown>[] = [];

      if (entityType === "epics") {
        rows = await database.epic.findMany({
          where: { tenantId: report.tenantId },
          select: {
            id: true,
            title: true,
            state: true,
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
            state: true,
            createdAt: true,
            updatedAt: true,
          },
          take: 10_000,
          orderBy: { createdAt: "desc" },
        });
      }

      return serializeToDataUrl(rows);
    });

    await step.run("mark-delivered", () =>
      database.scheduledReportExecution.update({
        where: { id: executionId },
        data: {
          status: "DELIVERED",
          pdfUrl: csvUrl,
          executedAt: new Date(),
        },
      })
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

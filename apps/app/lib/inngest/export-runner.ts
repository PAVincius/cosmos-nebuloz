import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

export const runExport = inngest.createFunction(
  {
    id: "reporting-export-run",
    concurrency: { limit: 3 },
    triggers: [{ event: "reporting/export.run" }],
  },
  async ({ event, step }) => {
    const { tenantId, userId, entityType, artId } = event.data as {
      tenantId: string;
      userId: string;
      entityType: string;
      artId?: string;
    };

    const rows = await step.run("fetch-rows", async () => {
      const where: Record<string, unknown> = { tenantId };
      if (artId) {
        where.artId = artId;
      }

      switch (entityType) {
        case "epics":
          return database.epic.findMany({
            where,
            take: 50_000,
            select: {
              id: true,
              title: true,
              statusId: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          });
        case "features":
          return database.feature.findMany({
            where,
            take: 50_000,
            select: {
              id: true,
              title: true,
              statusId: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          });
        case "stories":
          return database.story.findMany({
            where,
            take: 50_000,
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          });
        case "risks":
          return database.risk.findMany({
            where,
            take: 50_000,
            select: {
              id: true,
              title: true,
              severity: true,
              roamStatus: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          });
        case "impediments":
          return database.impediment.findMany({
            where,
            take: 50_000,
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          });
        default:
          return [];
      }
    });

    const dataUrl = await step.run("serialize", () =>
      toCsvDataUrl(rows as Record<string, unknown>[])
    );

    database.auditLog
      .create({
        data: {
          tenantId,
          action: "reporting.export.completed",
          actorType: "system",
          metadata: { entityType, rows: rows.length, userId },
        },
      })
      .catch((e) => {
        log.error("[export-runner] audit log failed", e);
      });

    return { rows: rows.length, dataUrl };
  }
);

function toCsvDataUrl(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "data:text/csv;base64,";
  }
  const hdrs = Object.keys(rows[0]);
  const lines = [
    hdrs.join(","),
    ...rows.map((r) =>
      hdrs
        .map((h) => {
          const v = r[h];
          const s = v instanceof Date ? v.toISOString() : String(v ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    ),
  ];
  return `data:text/csv;base64,${Buffer.from(lines.join("\n")).toString("base64")}`;
}

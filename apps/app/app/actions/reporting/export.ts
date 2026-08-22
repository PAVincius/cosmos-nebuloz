"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { cuid, type Result, safeAction } from "../_base";

const SYNC_ROW_LIMIT = 5000;

const ExportSchema = z.object({
  entityType: z.enum(["epics", "features", "stories", "risks", "impediments"]),
  artId: cuid.optional(),
  format: z.enum(["csv"]).default("csv"),
});

type ExportInput = z.infer<typeof ExportSchema>;
export type ExportResult =
  | { mode: "sync"; dataUrl: string; rows: number }
  | { mode: "async"; jobId: string };

export async function exportData(raw: unknown): Promise<Result<ExportResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = ExportSchema.parse(raw);

    const count = await countRows(ctx.tenantId, input);

    if (count <= SYNC_ROW_LIMIT) {
      const rows = await fetchRows(ctx.tenantId, input, count);
      return {
        mode: "sync" as const,
        dataUrl: toCsvDataUrl(rows),
        rows: rows.length,
      };
    }

    const { ids } = await inngest.send({
      name: "reporting/export.run",
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        entityType: input.entityType,
        artId: input.artId,
      },
    });

    return { mode: "async" as const, jobId: ids[0] };
  });
}

async function countRows(
  tenantId: string,
  input: ExportInput
): Promise<number> {
  const where = buildWhere(tenantId, input);
  switch (input.entityType) {
    case "epics":
      return database.epic.count({ where });
    case "features":
      return database.feature.count({ where });
    case "stories":
      return database.story.count({ where });
    case "risks":
      return database.risk.count({ where });
    case "impediments":
      return database.impediment.count({ where });
  }
}

async function fetchRows(
  tenantId: string,
  input: ExportInput,
  limit: number
): Promise<Record<string, unknown>[]> {
  const where = buildWhere(tenantId, input);
  const take = Math.min(limit, SYNC_ROW_LIMIT);

  switch (input.entityType) {
    case "epics":
      return database.epic.findMany({
        where,
        take,
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
        take,
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
        take,
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
        take,
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
        take,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
  }
}

function buildWhere(
  tenantId: string,
  input: ExportInput
): Record<string, unknown> {
  const where: Record<string, unknown> = { tenantId };
  if (input.artId) {
    where.artId = input.artId;
  }
  return where;
}

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

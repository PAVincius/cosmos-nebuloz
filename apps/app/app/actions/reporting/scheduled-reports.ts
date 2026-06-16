"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import {
  buildPage,
  cuid,
  nnStr,
  type Page,
  PaginationSchema,
  paginationArgs,
  type Result,
  safeAction,
} from "../_base";
import { enforce } from "../permissions";

const CRON_RE =
  /^(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)$/;

const CreateReportSchema = z.object({
  name: nnStr,
  cronExpression: z.string().regex(CRON_RE, "Invalid cron expression"),
  timezone: z.string().min(1).max(64).default("UTC"),
  recipients: z.array(z.string().email()).min(1).max(20),
  slackChannelId: z.string().max(64).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const UpdateReportSchema = CreateReportSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export async function createScheduledReport(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "ScheduledReport", "create");
    const data = CreateReportSchema.parse(raw);

    const report = await database.scheduledReport.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        cronExpression: data.cronExpression,
        timezone: data.timezone,
        recipients: data.recipients,
        slackChannelId: data.slackChannelId,
        config: data.config as import("@repo/database").Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return report;
  });
}

export async function updateScheduledReport(
  id: string,
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "ScheduledReport", "update");

    const validId = cuid.parse(id);
    const data = UpdateReportSchema.parse(raw);

    const existing = await database.scheduledReport.findFirst({
      where: { id: validId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Report not found");
    }

    const updated = await database.scheduledReport.update({
      where: { id: validId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.cronExpression && { cronExpression: data.cronExpression }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.recipients && { recipients: data.recipients }),
        ...(data.slackChannelId !== undefined && {
          slackChannelId: data.slackChannelId,
        }),
        ...(data.config && {
          config: data.config as import("@repo/database").Prisma.InputJsonValue,
        }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
      select: { id: true },
    });

    return updated;
  });
}

export async function deleteScheduledReport(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "ScheduledReport", "delete");

    const validId = cuid.parse(id);
    const existing = await database.scheduledReport.findFirst({
      where: { id: validId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Report not found");
    }

    await database.scheduledReport.delete({ where: { id: validId } });
    return { id: validId };
  });
}

export async function listScheduledReports(
  raw: unknown
): Promise<Result<Page<unknown>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { page, limit } = PaginationSchema.parse(raw ?? {});

    const where = { tenantId: ctx.tenantId };
    const [items, total] = await Promise.all([
      database.scheduledReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          executions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, executedAt: true, pdfUrl: true },
          },
        },
        ...paginationArgs(page, limit),
      }),
      database.scheduledReport.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

export async function listReportExecutions(
  reportId: string,
  raw: unknown
): Promise<Result<Page<unknown>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const validId = cuid.parse(reportId);

    const report = await database.scheduledReport.findFirst({
      where: { id: validId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!report) {
      throw new Error("Report not found");
    }

    const { page, limit } = PaginationSchema.parse(raw ?? {});

    const where = { reportId: validId, tenantId: ctx.tenantId };
    const [items, total] = await Promise.all([
      database.scheduledReportExecution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(page, limit),
      }),
      database.scheduledReportExecution.count({ where }),
    ]);

    return buildPage(items, total, page, limit);
  });
}

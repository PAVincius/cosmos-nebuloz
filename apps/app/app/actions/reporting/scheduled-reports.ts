"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { previousFireTime } from "@/lib/reporting/schedule";
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

/**
 * O regex antigo aceitava qualquer expressão com a forma certa de campos,
 * sem validar faixas ("99 * * * *" passava), e o timezone só checava
 * comprimento ("Sao Paulo" passava). `previousFireTime` já faz a validação
 * real (mesma usada pela varredura para decidir vencimento) — reaproveitar
 * aqui garante que nada inválido passa na criação/edição para só falhar em
 * silêncio depois, no cron.
 */
function cronValido(cronExpression: string): boolean {
  return (
    previousFireTime({ cronExpression, timezone: "UTC" }, new Date()) !== null
  );
}

function timezoneValido(timezone: string): boolean {
  return (
    previousFireTime({ cronExpression: "0 0 * * *", timezone }, new Date()) !==
    null
  );
}

const ScheduledReportFieldsSchema = z.object({
  name: nnStr,
  cronExpression: z.string(),
  timezone: z.string().min(1).max(64).default("UTC"),
  recipients: z.array(z.string().email()).min(1).max(20),
  slackChannelId: z.string().max(64).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const CreateReportSchema = ScheduledReportFieldsSchema.refine(
  (data) => cronValido(data.cronExpression),
  { message: "Expressão cron inválida", path: ["cronExpression"] }
).refine((data) => timezoneValido(data.timezone), {
  message: "Timezone inválido",
  path: ["timezone"],
});

const UpdateReportSchema = ScheduledReportFieldsSchema.partial()
  .extend({ enabled: z.boolean().optional() })
  .refine(
    (data) =>
      data.cronExpression === undefined || cronValido(data.cronExpression),
    { message: "Expressão cron inválida", path: ["cronExpression"] }
  )
  .refine(
    (data) => data.timezone === undefined || timezoneValido(data.timezone),
    { message: "Timezone inválido", path: ["timezone"] }
  );

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

"use server";

// Story-029 AC-005: PDF export rate-limited at 10/user/hour

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { inngest } from "@/lib/inngest/client";
import { type Result, safeAction } from "../_base";

const PDF_RATE_LIMIT = 10;
const PDF_RATE_WINDOW = 3600; // 1 hour in seconds

export type PdfExportResult =
  | { mode: "queued"; executionId: string }
  | { code: "RATE_LIMIT_EXCEEDED"; limit: number; resetAt: string };

export async function exportExecutivePdf(
  reportId: string
): Promise<Result<PdfExportResult>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());

    // AC-005: rate limit 10 exports/user/hour
    const { redis } = await import("@repo/rate-limit");
    const rlKey = `pdf-export:${tenantId}:${userId}`;
    const current = await redis.incr(rlKey);
    if (current === 1) {
      await redis.expire(rlKey, PDF_RATE_WINDOW);
    }

    if (current > PDF_RATE_LIMIT) {
      const ttl = await redis.ttl(rlKey);
      const resetAt = new Date(Date.now() + ttl * 1000).toISOString();
      return {
        code: "RATE_LIMIT_EXCEEDED" as const,
        limit: PDF_RATE_LIMIT,
        resetAt,
      };
    }

    const report = await database.scheduledReport.findFirst({
      where: { id: reportId, tenantId },
      select: { id: true, tenantId: true },
    });
    if (!report) {
      throw new Error("Report not found");
    }

    const execution = await database.scheduledReportExecution.create({
      data: {
        tenantId,
        reportId,
        status: "PENDING",
      },
      select: { id: true },
    });

    await inngest.send({
      name: "reporting/scheduled-report.run",
      data: { reportId, executionId: execution.id, triggeredBy: userId },
    });

    return { mode: "queued" as const, executionId: execution.id };
  });
}

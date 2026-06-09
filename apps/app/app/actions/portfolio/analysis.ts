"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { type Result, safeAction } from "../_base";

const LOCK_TTL_SECONDS = 600;
const LOCK_KEY_PREFIX = "portfolio:analysis:lock:";
const REPORT_TTL_DAYS = 90;

// ─── triggerPortfolioAnalysis ─────────────────────────────────────────────────

const triggerPortfolioAnalysisSchema = z.object({
  artId: z.string().min(1),
});

export async function triggerPortfolioAnalysis(raw: unknown): Promise<
  Result<{
    jobId: string;
    status: string;
    estimatedMinutes: number;
    reportId: string;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = triggerPortfolioAnalysisSchema.parse(raw);

    // AC-007: per-ART Upstash lock — prevents concurrent runs
    const lockKey = `${LOCK_KEY_PREFIX}${input.artId}`;
    const { redis } = await import("@repo/rate-limit");
    const acquired = await redis.set(lockKey, "1", {
      nx: true,
      ex: LOCK_TTL_SECONDS,
    });

    if (!acquired) {
      // Lock held — find the running report for context
      const running = await database.portfolioAnalysisReport.findFirst({
        where: {
          tenantId,
          artId: input.artId,
          completionStatus: { in: ["QUEUED", "RUNNING"] },
        },
        orderBy: { createdAt: "desc" },
        select: { jobId: true, createdAt: true },
      });

      throw new Error(
        `ANALYSIS_RUNNING: artId=${input.artId} jobId=${running?.jobId ?? "unknown"}`
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REPORT_TTL_DAYS);

    const report = await database.portfolioAnalysisReport.create({
      data: {
        tenantId,
        artId: input.artId,
        completionStatus: "QUEUED",
        expiresAt,
      },
      select: { id: true },
    });

    // Enqueue Inngest job — AC-006
    const { ids } = await inngest.send({
      name: "portfolio/analysis.requested",
      data: { artId: input.artId, tenantId, reportId: report.id },
    });

    const jobId = ids[0] ?? report.id;

    await database.portfolioAnalysisReport.update({
      where: { id: report.id },
      data: { jobId },
    });

    return {
      jobId,
      status: "QUEUED",
      estimatedMinutes: 5,
      reportId: report.id,
    };
  });
}

// ─── getPortfolioReport ───────────────────────────────────────────────────────

const getPortfolioReportSchema = z.object({
  reportId: z.string().min(1),
});

export async function getPortfolioReport(raw: unknown): Promise<
  Result<{
    id: string;
    completionStatus: string;
    epicCount: number;
    skippedCount: number;
    reportJson: unknown;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = getPortfolioReportSchema.parse(raw);

    const report = await database.portfolioAnalysisReport.findFirstOrThrow({
      where: { id: input.reportId, tenantId },
      select: {
        id: true,
        completionStatus: true,
        epicCount: true,
        skippedCount: true,
        reportJson: true,
      },
    });

    return report;
  });
}

// ─── buildPortfolioReport (pure) ──────────────────────────────────────────────

type EpicResult = {
  epicId: string;
  status: "COMPLETE" | "UNAVAILABLE";
  reason?: string;
  investScore?: number;
};

export function buildPortfolioReport(
  results: EpicResult[],
  priorReportJson?: { epicCategories?: Record<string, string> }
): {
  completionStatus: "COMPLETE" | "PARTIAL_SUCCESS";
  skippedEpics: EpicResult[];
  changes: { epicId: string; from: string; to: string }[];
} {
  const skippedEpics = results.filter((r) => r.status === "UNAVAILABLE");
  const completionStatus =
    skippedEpics.length > 0 ? "PARTIAL_SUCCESS" : "COMPLETE";

  // AC-009: change diff vs prior report
  const changes: { epicId: string; from: string; to: string }[] = [];
  if (priorReportJson?.epicCategories) {
    for (const result of results) {
      if (result.status !== "COMPLETE") {
        continue;
      }
      const category =
        result.investScore !== undefined
          ? result.investScore >= 70
            ? "READY"
            : result.investScore >= 40
              ? "NEEDS_WORK"
              : "NOT_READY"
          : "UNKNOWN";
      const prior = priorReportJson.epicCategories[result.epicId];
      if (prior && prior !== category) {
        changes.push({ epicId: result.epicId, from: prior, to: category });
      }
    }
  }

  return { completionStatus, skippedEpics, changes };
}

// re-export LOCK_TTL_SECONDS for testing
export { LOCK_TTL_SECONDS };

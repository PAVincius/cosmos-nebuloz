"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { type Result, safeAction } from "../_base";

// ─── triggerBillingSync ───────────────────────────────────────────────────────

const triggerBillingSyncSchema = z.object({
  integrationId: z.string().min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isBackfill: z.boolean().default(false),
});

export async function triggerBillingSync(raw: unknown): Promise<
  Result<{
    syncRunId: string;
    jobId: string;
    isBackfill: boolean;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = triggerBillingSyncSchema.parse(raw);

    // Verify integration belongs to tenant
    const integration = await database.integration.findFirstOrThrow({
      where: { id: input.integrationId, tenantId },
      select: { id: true, provider: true },
    });

    const syncRun = await database.billingSyncRun.create({
      data: {
        tenantId,
        integrationId: integration.id,
        status: "PENDING",
      },
      select: { id: true },
    });

    const { ids } = await inngest.send({
      name: "billing/sync.requested",
      data: {
        tenantId,
        integrationId: integration.id,
        syncRunId: syncRun.id,
        startDate: input.startDate,
        endDate: input.endDate,
        isBackfill: input.isBackfill,
      },
    });

    return {
      syncRunId: syncRun.id,
      jobId: ids[0] ?? syncRun.id,
      isBackfill: input.isBackfill,
    };
  });
}

// ─── getSyncStatus ────────────────────────────────────────────────────────────

const getSyncStatusSchema = z.object({
  syncRunId: z.string().min(1),
});

export async function getSyncStatus(raw: unknown): Promise<
  Result<{
    status: string;
    entriesProcessed: number;
    errorMessage: string | null;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = getSyncStatusSchema.parse(raw);

    const run = await database.billingSyncRun.findFirstOrThrow({
      where: { id: input.syncRunId, tenantId },
      select: { status: true, entriesProcessed: true, errorMessage: true },
    });

    return run;
  });
}

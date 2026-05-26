import { database } from "@repo/database";
import {
  type AwsAdapterConfig,
  fetchAwsPage,
} from "@/lib/billing-adapters/aws";
import {
  resolveMapping,
  type TagRuleInput,
} from "@/lib/billing-adapters/tag-rule-engine";
import { inngest } from "./client";

const BATCH_SIZE = 500;

type StagedRow = {
  payload: unknown;
};

type BillingEntryInsert = {
  tenantId: string;
  integrationId: string;
  provider: string;
  accountId: string;
  externalId: string;
  usageStartDate: Date;
  usageEndDate: Date;
  service: string;
  chargeCategory: string;
  billedCost: string;
  effectiveCost: string;
  listCost: string;
  unblendedAmount: string;
  amortizedAmount: string;
  usageQuantity: string | null;
  usageUnit: string | null;
  currency: string;
  fxRate: string;
  tenantCurrency: string;
  tenantAmount: string;
  tags: Record<string, string>;
  themeId: string | null;
  mappingRuleId: string | null;
  mappingConf: string;
};

type CostFields = Pick<
  BillingEntryInsert,
  | "billedCost"
  | "effectiveCost"
  | "listCost"
  | "unblendedAmount"
  | "amortizedAmount"
  | "usageQuantity"
  | "usageUnit"
  | "currency"
  | "tenantCurrency"
  | "tenantAmount"
>;

function extractCostFields(e: Record<string, unknown>): CostFields {
  return {
    billedCost: String(e.billedCost ?? "0"),
    effectiveCost: String(e.effectiveCost ?? "0"),
    listCost: String(e.listCost ?? "0"),
    unblendedAmount: String(e.unblendedAmount ?? "0"),
    amortizedAmount: String(e.amortizedAmount ?? "0"),
    usageQuantity: e.usageQuantity ? String(e.usageQuantity) : null,
    usageUnit: e.usageUnit ? String(e.usageUnit) : null,
    currency: String(e.currency ?? "USD"),
    tenantCurrency: String(e.tenantCurrency ?? "USD"),
    tenantAmount: String(e.tenantAmount ?? e.amortizedAmount ?? "0"),
  };
}

function mapStagedRowToEntry(
  row: StagedRow,
  tenantId: string,
  integrationId: string,
  tagRules: TagRuleInput[]
): BillingEntryInsert {
  const e = row.payload as Record<string, unknown>;
  const tags = (e.tags ?? {}) as Record<string, string>;
  const accountId = String(e.accountId ?? "");
  const mapping = resolveMapping(tagRules, tags, accountId);

  return {
    tenantId,
    integrationId,
    provider: String(e.provider ?? "AWS"),
    accountId,
    externalId: String(e.externalId ?? ""),
    usageStartDate: new Date(String(e.usageStartDate)),
    usageEndDate: new Date(String(e.usageEndDate)),
    service: String(e.service ?? ""),
    chargeCategory: String(e.chargeCategory ?? "Usage"),
    ...extractCostFields(e),
    fxRate: "1",
    tags,
    themeId: mapping.themeId,
    mappingRuleId: mapping.mappingRuleId,
    mappingConf: mapping.mappingConf,
  };
}

export const billingSyncFunction = inngest.createFunction(
  {
    id: "billing-sync",
    triggers: [{ event: "billing/sync.requested" }],
    concurrency: [
      { key: "event.data.integrationId", limit: 1 },
      { scope: "fn" as const, limit: 50 },
    ],
    retries: 3,
  },
  async ({ event, step }) => {
    const { tenantId, integrationId } = event.data as {
      tenantId: string;
      integrationId: string;
    };

    // ── Step 1: Load cursor + config ──────────────────────────────────────
    const context = await step.run("load-cursor", async () => {
      const integration = await database.integration.findFirstOrThrow({
        where: { id: integrationId, tenantId, status: "ACTIVE" },
      });

      const cursor = await database.billingSyncCursor.findUnique({
        where: { integrationId },
      });

      const now = new Date();
      const lookbackDays = cursor?.lookbackDays ?? 7;
      const startDate = cursor
        ? new Date(
            cursor.lastIngestedThrough.getTime() - lookbackDays * 86_400_000
          )
        : new Date(now.getTime() - 90 * 86_400_000);

      const syncRun = await database.billingSyncRun.create({
        data: {
          tenantId,
          integrationId,
          status: "RUNNING",
          currentStep: "load-cursor",
        },
      });

      return {
        config: integration.config as AwsAdapterConfig,
        syncRunId: syncRun.id,
        startDate: startDate.toISOString().split("T")[0] as string,
        endDate: now.toISOString().split("T")[0] as string,
      };
    });

    // ── Step 2: Fetch pages → stage ───────────────────────────────────────
    let page = 0;
    let nextToken: string | undefined;

    do {
      const pageResult = await step.run(`fetch-page-${page}`, async () => {
        const result = await fetchAwsPage({
          config: context.config,
          tenantId,
          startDate: context.startDate,
          endDate: context.endDate,
          nextPageToken: nextToken,
        });

        if (result.entries.length > 0) {
          await database.billingEntryStaging.createMany({
            data: result.entries.map((e) => ({
              tenantId,
              integrationId,
              syncRunId: context.syncRunId,
              payload: e as object,
              page,
            })),
          });
        }

        return {
          nextToken: result.nextPageToken,
          count: result.entries.length,
        };
      });

      nextToken = pageResult.nextToken;
      page += 1;
    } while (nextToken);

    // ── Step 3: Load tag rules ────────────────────────────────────────────
    const tagRules = await step.run("load-tag-rules", async () =>
      database.tagRule.findMany({
        where: { tenantId, enabled: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      })
    );

    // ── Step 4: Promote staged → BillingEntry ────────────────────────────
    const promotedCount = await step.run("promote-entries", async () => {
      const staged = await database.billingEntryStaging.findMany({
        where: { tenantId, integrationId, syncRunId: context.syncRunId },
        orderBy: { page: "asc" },
      });

      let count = 0;

      for (let i = 0; i < staged.length; i += BATCH_SIZE) {
        const batch = staged.slice(i, i + BATCH_SIZE);

        const ruleInputs: TagRuleInput[] = tagRules.map((r) => ({
          id: r.id,
          matchType: r.matchType,
          tagKey: r.tagKey,
          tagValue: r.tagValue,
          themeId: r.themeId,
          artId: r.artId,
          epicId: r.epicId,
          priority: r.priority,
          enabled: r.enabled,
        }));

        const entries = batch.map((row) =>
          mapStagedRowToEntry(row, tenantId, integrationId, ruleInputs)
        );

        await database.billingEntry.createMany({
          data: entries,
          skipDuplicates: true,
        });

        count += batch.length;
      }

      // Cleanup staging rows
      await database.billingEntryStaging.deleteMany({
        where: { tenantId, integrationId, syncRunId: context.syncRunId },
      });

      return count;
    });

    // ── Step 5: Aggregate CostSnapshot ───────────────────────────────────
    await step.run("aggregate-snapshots", async () => {
      await database.$executeRaw`
        INSERT INTO "CostSnapshot" (
          id, "tenantId", "themeId", "artId", "epicId", "okrId",
          period, granularity,
          "cloudCost", "peopleCost", "saasCost", "actualCost",
          "unmappedAmount", breakdown, "sourceCurrencies",
          currency, "fxStrategy", "fxConvertedAt", "syncedAt"
        )
        SELECT
          gen_random_uuid()::text,
          be."tenantId",
          be."themeId",
          NULL,
          NULL,
          NULL,
          DATE_TRUNC('day', be."usageStartDate"),
          'DAILY',
          SUM(be."tenantAmount") FILTER (WHERE be."chargeCategory" != 'Credit'),
          0,
          0,
          SUM(be."tenantAmount") FILTER (WHERE be."chargeCategory" != 'Credit'),
          SUM(be."tenantAmount") FILTER (WHERE be."mappingConf" = 'UNMAPPED'),
          '{}',
          '{}',
          'USD',
          'MONTH_AVG',
          NOW(),
          NOW()
        FROM "BillingEntry" be
        WHERE be."tenantId" = ${tenantId}
          AND be."integrationId" = ${integrationId}
        GROUP BY be."tenantId", be."themeId", DATE_TRUNC('day', be."usageStartDate")
        ON CONFLICT ("tenantId", "themeId", "artId", "epicId", "okrId", period, granularity)
        DO UPDATE SET
          "cloudCost"      = EXCLUDED."cloudCost",
          "actualCost"     = EXCLUDED."actualCost",
          "unmappedAmount" = EXCLUDED."unmappedAmount",
          "syncedAt"       = NOW()
      `;
    });

    // ── Step 6: Update UnmappedCostBucket ─────────────────────────────────
    await step.run("update-unmapped-bucket", async () => {
      await database.$executeRaw`
        INSERT INTO "UnmappedCostBucket" (
          id, "tenantId", "integrationId", period, amount, currency, "topTags", "entryCount"
        )
        SELECT
          gen_random_uuid()::text,
          ${tenantId},
          ${integrationId},
          DATE_TRUNC('month', "usageStartDate"),
          SUM("tenantAmount"),
          'USD',
          '[]',
          COUNT(*)
        FROM "BillingEntry"
        WHERE "tenantId" = ${tenantId}
          AND "integrationId" = ${integrationId}
          AND "mappingConf" = 'UNMAPPED'
        GROUP BY DATE_TRUNC('month', "usageStartDate")
        ON CONFLICT ("tenantId", "integrationId", period)
        DO UPDATE SET
          amount       = EXCLUDED.amount,
          "entryCount" = EXCLUDED."entryCount"
      `;
    });

    // ── Step 7: Advance cursor ────────────────────────────────────────────
    await step.run("advance-cursor", async () => {
      await database.billingSyncCursor.upsert({
        where: { integrationId },
        create: {
          integrationId,
          lastIngestedThrough: new Date(),
          lookbackDays: 7,
          backfillDays: 90,
          backfillComplete: true,
        },
        update: {
          lastIngestedThrough: new Date(),
          consecutiveFailures: 0,
        },
      });

      await database.billingSyncRun.update({
        where: { id: context.syncRunId },
        data: {
          status: "SUCCESS",
          currentStep: "done",
          entriesProcessed: promotedCount,
          finishedAt: new Date(),
        },
      });

      await database.integration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() },
      });
    });

    // ── Step 8: Emit downstream events ───────────────────────────────────
    await inngest.send([
      {
        name: "billing/snapshot.updated" as const,
        data: { tenantId, integrationId, period: new Date().toISOString() },
      },
    ]);

    return { success: true, entriesProcessed: promotedCount };
  }
);

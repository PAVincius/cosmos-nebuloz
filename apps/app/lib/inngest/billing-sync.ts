import { database } from "@repo/database";
import { decryptConfigSecrets } from "@repo/security/encrypt";
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
  chargeCategory: import("@repo/database").ChargeCategory;
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
  epicId: string | null;
  artId: string | null;
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
    chargeCategory: String(
      e.chargeCategory ?? "Usage"
    ) as import("@repo/database").ChargeCategory,
    ...extractCostFields(e),
    fxRate: "1",
    tags,
    themeId: mapping.themeId,
    epicId: mapping.epicId,
    artId: mapping.artId,
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
        // Par do `encryptConfigSecrets` em app/actions/billing: campo não
        // secreto passa direto, e linha antiga em claro cai no fallback do
        // decrypt. Sem isto, cifrar na escrita quebraria o sync.
        config: decryptConfigSecrets(
          integration.config as Record<string, unknown>
        ) as unknown as AwsAdapterConfig,
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
          be."artId",
          be."epicId",
          NULL,
          DATE_TRUNC('day', be."usageStartDate"),
          'DAILY',
          -- COALESCE(...,0) nas três: SUM(...) FILTER(...) devolve NULL (não
          -- 0) quando nenhuma linha do grupo bate o filtro — todo grupo cujas
          -- entradas são 100% não-Credit (o normal) já violava a NOT NULL de
          -- unmappedAmount antes desta correção, abortando o INSERT inteiro
          -- (statement único, uma linha ruim derruba todas). Achado ao provar
          -- que a soma bate — sem isto não dava nem para rodar a query contra
          -- um Postgres de verdade.
          COALESCE(SUM(be."tenantAmount") FILTER (WHERE be."chargeCategory" != 'Credit'), 0),
          0,
          0,
          COALESCE(SUM(be."tenantAmount") FILTER (WHERE be."chargeCategory" != 'Credit'), 0),
          COALESCE(SUM(be."tenantAmount") FILTER (WHERE be."mappingConf" = 'UNMAPPED'), 0),
          '{}',
          '{}',
          'USD',
          'MONTH_AVG',
          NOW(),
          NOW()
        FROM "BillingEntry" be
        WHERE be."tenantId" = ${tenantId}
          AND be."integrationId" = ${integrationId}
        -- Cada BillingEntry cai em exatamente um grupo: o agrupamento abaixo
        -- lista todas as colunas não-agregadas do SELECT (garantia do próprio
        -- Postgres — não compila SELECT de coluna não-agregada fora dele),
        -- então a partição é exaustiva e sem sobreposição por construção. Antes,
        -- artId/epicId eram NULL literal fora do agrupamento: linhas de épicos
        -- diferentes sob o mesmo tema caíam numa só linha (o total do dia
        -- batia, mas a quebra por épico/ART se perdia).
        GROUP BY be."tenantId", be."themeId", be."artId", be."epicId", DATE_TRUNC('day', be."usageStartDate")
        -- okrId segue NULL literal — não há resolução de OKR no pipeline.
        --
        -- NEB-185: o ON CONFLICT abaixo só "casa" quando NENHUMA das colunas
        -- da constraint é NULL — no Postgres, NULLS DISTINCT (padrão, e o
        -- único modo que o Prisma sabe declarar; NULLS NOT DISTINCT existe no
        -- Postgres 15+ mas não tem sintaxe no schema.prisma) trata NULL como
        -- nunca igual a NULL, então duas linhas com a mesma chave mas algum
        -- campo NULL nunca colidem. okrId é NULL literal em TODA linha desta
        -- query — logo o DO UPDATE abaixo nunca dispara hoje, com ou sem este
        -- fix: cada sync insere de novo em vez de atualizar. Bug pré-existente
        -- (não introduzido nem agravado por agrupar por artId/epicId), fora do
        -- escopo dos três defeitos do NEB-185 — requer NULLS NOT DISTINCT no
        -- índice (não representável em schema.prisma sem quebrar o
        -- "prisma migrate diff") ou reescrever o upsert. Sinalizado à parte.
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

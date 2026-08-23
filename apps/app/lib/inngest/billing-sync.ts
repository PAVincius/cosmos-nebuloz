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

// NEB-186 — agrega BillingEntry em CostSnapshot via DELETE+INSERT dentro de
// uma transação, não INSERT ... ON CONFLICT DO UPDATE. Dois defeitos
// pré-existentes tornavam o upsert incorreto e, juntos com o cron diário,
// inflavam o custo do dashboard a cada sync:
//
// 1. okrId é NULL literal em toda linha desta query, e o índice único do
//    Postgres usa NULLS DISTINCT (padrão — e o único modo que o
//    schema.prisma sabe declarar; NULLS NOT DISTINCT existe no Postgres 15+
//    mas não tem sintaxe no schema.prisma). Duas linhas com a mesma chave
//    mas algum campo NULL nunca colidem, então o DO UPDATE nunca disparava:
//    cada sync inseria de novo em vez de atualizar.
// 2. A agregação não tinha recorte temporal — reagregava o histórico inteiro
//    do tenant a cada execução.
//
// DELETE+INSERT resolve os dois de uma vez: idempotente por construção (a
// mesma janela reagregada duas vezes produz o mesmo resultado, provado em
// __tests__/finops/cost-snapshot-aggregation.test.ts), sem depender de
// semântica de NULL em índice único, e naturalmente limitado ao período.
//
// Intervalo: [startDate, endDate) é a mesma janela que load-cursor calculou
// e que fetchAwsPage usou para consultar a Cost Explorer API (TimePeriod
// Start/End, exclusivo no fim — mesma convenção da AWS). É o recorte exato
// do que este sync pode ter tocado: não precisa de outra fonte, e evita
// reprocessar o histórico inteiro a cada execução.
//
// Escopo do DELETE = escopo do SELECT que o substitui: mesmo tenantId, mesma
// granularity, mesmo intervalo de period. SEM filtro de integrationId —
// CostSnapshot não tem essa coluna (schema/finops.prisma): a tabela é
// desenhada como agregado por tenant/tema/ART/épico, não por integração.
// getCloudCostSummary (app/(cosmos)/actions/finops.ts) já lê assim, sem
// filtrar por integração. A query anterior escopava o SELECT a UMA
// integração (WHERE integrationId = ...) enquanto gravava numa chave
// tenant-wide — com duas integrações de billing no mesmo tenant, cada sync
// substituiria (EXCLUDED, não soma) a contribuição da outra na próxima
// execução dela. Agregar por tenant inteiro (todas as integrações) em vez de
// só a que disparou este sync resolve isso: cada linha volta a ser o total
// real daquela dimensão para aquele período, e o DELETE nunca apaga dado que
// o INSERT não vá recriar no mesmo passo.
export async function aggregateCostSnapshots(
  db: typeof database,
  params: { tenantId: string; startDate: Date; endDate: Date }
): Promise<void> {
  const { tenantId, startDate, endDate } = params;

  await db.$transaction([
    db.$executeRaw`
      DELETE FROM "CostSnapshot"
      WHERE "tenantId" = ${tenantId}
        AND granularity = 'DAILY'
        AND period >= ${startDate}
        AND period < ${endDate}
    `,
    db.$executeRaw`
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
        -- COALESCE(...,0): SUM(...) FILTER(...) devolve NULL (não 0) quando
        -- nenhuma linha do grupo bate o filtro. Para unmappedAmount isso
        -- acontece no caso NORMAL — grupo sem NENHUMA linha UNMAPPED, a
        -- maior parte do custo mapeado — e sem o COALESCE aqui o INSERT
        -- inteiro aborta em NOT NULL (statement único, uma linha ruim
        -- derruba todas). Prova de mutação em
        -- __tests__/finops/cost-snapshot-aggregation.test.ts. peopleCost e
        -- saasCost seguem 0 fixo: hoje só esta query escreve nestas colunas;
        -- se outra fonte passar a alimentá-las, este DELETE precisa ser
        -- revisto para não apagar o trabalho dela.
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
        AND be."usageStartDate" >= ${startDate}
        AND be."usageStartDate" < ${endDate}
      -- Cada BillingEntry cai em exatamente um grupo: o agrupamento abaixo
      -- lista todas as colunas não-agregadas do SELECT (garantia do próprio
      -- Postgres — não compila SELECT de coluna não-agregada fora dele),
      -- então a partição é exaustiva e sem sobreposição por construção.
      GROUP BY be."tenantId", be."themeId", be."artId", be."epicId", DATE_TRUNC('day', be."usageStartDate")
      -- okrId segue NULL literal — não há resolução de OKR no pipeline.
    `,
  ]);
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
      await aggregateCostSnapshots(database, {
        tenantId,
        startDate: new Date(context.startDate),
        endDate: new Date(context.endDate),
      });
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

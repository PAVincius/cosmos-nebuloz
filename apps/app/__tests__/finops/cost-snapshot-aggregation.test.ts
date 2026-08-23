/**
 * NEB-186 — prova, contra um Postgres de verdade, que aggregateCostSnapshots
 * (lib/inngest/billing-sync.ts) soma dinheiro certo e não duplica.
 *
 * O review de NEB-185/#108 provou que a suíte anterior desta agregação eram
 * asserções sobre o TEXTO do template SQL: removendo os três COALESCE, os
 * 19 testes continuavam verdes — nenhum protegia o número que vira o custo
 * do dashboard. Este arquivo roda a função real contra um Postgres real e
 * checa o resultado, não a string da query.
 *
 * Uses raw pg.Pool queries for fixture setup/teardown — mesmo padrão de
 * flow-intelligence.test.ts / meeting-intelligence.test.ts (bypassa o driver
 * adapter do Prisma para não pendurar em transação implícita entre pools
 * diferentes). aggregateCostSnapshots em si roda através do client Prisma
 * real (`@repo/database`), importado dinamicamente dentro de beforeAll —
 * import estático quebraria a suíte inteira quando RUN_DB_TESTS não está
 * setado, porque billing-sync.ts importa o singleton `@repo/database` no
 * escopo do módulo, que valida DATABASE_URL (via keys()/z.url()) na hora do
 * import.
 *
 * Requires a running Postgres instance. Skipped via describe.skip unless
 * RUN_DB_TESTS=1 AND DATABASE_URL estão setados — mesmo opt-in explícito das
 * outras suítes de banco deste repo (nunca por inferência: a DATABASE_URL do
 * build da Vercel aponta pra produção).
 */

// @vitest-environment node

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/cosmos_dev";

const IS_LOCAL_DB = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
const POOL_SSL = IS_LOCAL_DB ? undefined : { rejectUnauthorized: false };

const hasExplicitDb = Boolean(
  process.env.DATABASE_URL && process.env.RUN_DB_TESTS
);
const maybeDescribe = hasExplicitDb ? describe : describe.skip;

if (!hasExplicitDb) {
  console.log(
    "[cost-snapshot-aggregation] RUN_DB_TESTS não setado — pulando suíte de integração com banco."
  );
}

type AggregateCostSnapshots = (
  db: unknown,
  params: { tenantId: string; startDate: Date; endDate: Date }
) => Promise<void>;

let pool: Pool;
let aggregateCostSnapshots: AggregateCostSnapshots;
let realDatabase: unknown;

maybeDescribe(
  "aggregateCostSnapshots — soma de dinheiro contra Postgres real (NEB-186)",
  () => {
    const TS = Date.now();
    const TENANT = `test-neb186-${TS}`;
    const INTEGRATION = `test-neb186-integ-${TS}`;
    const THEME_A = `theme-a-${TS}`;
    const EPIC_1 = `epic-1-${TS}`;
    const EPIC_2 = `epic-2-${TS}`;

    // Um único dia, dentro da janela agregada — DATE_TRUNC('day', ...) reduz
    // qualquer hora-do-dia a este mesmo period.
    const DAY1 = new Date("2026-06-01T12:00:00Z");
    const DAY1_END = new Date("2026-06-01T13:00:00Z");
    // Janela passada para aggregateCostSnapshots — mesma semântica de
    // [Start, End) que a Cost Explorer API usa (fim exclusivo).
    const RANGE_START = new Date("2026-06-01T00:00:00Z");
    const RANGE_END = new Date("2026-06-02T00:00:00Z");

    async function insertBillingEntry(row: {
      externalId: string;
      themeId: string | null;
      epicId: string | null;
      chargeCategory: "Usage" | "Credit";
      mappingConf: "MAPPED" | "UNMAPPED";
      tenantAmount: string;
    }) {
      await pool.query(
        `INSERT INTO "BillingEntry" (
           id, "tenantId", "integrationId", provider, "accountId", "externalId",
           "usageStartDate", "usageEndDate", service, "chargeCategory",
           "billedCost", "effectiveCost", "unblendedAmount", "amortizedAmount",
           currency, "fxRate", "tenantCurrency", "tenantAmount", tags,
           "themeId", "epicId", "artId", "mappingConf"
         ) VALUES (
           gen_random_uuid()::text, $1, $2, 'AWS', 'acc-1', $3,
           $4, $5, 'EC2', $6::"ChargeCategory",
           $7, $7, $7, $7,
           'USD', 1, 'USD', $7, '{}'::jsonb,
           $8, $9, NULL, $10
         )`,
        [
          TENANT,
          INTEGRATION,
          row.externalId,
          DAY1,
          DAY1_END,
          row.chargeCategory,
          row.tenantAmount,
          row.themeId,
          row.epicId,
          row.mappingConf,
        ]
      );
    }

    async function costSnapshotCountAndSum(): Promise<{
      count: number;
      cloudCostSum: number;
    }> {
      const { rows } = await pool.query<{ count: string; sum: string | null }>(
        `SELECT count(*)::int AS count, COALESCE(SUM("cloudCost"), 0)::text AS sum
         FROM "CostSnapshot"
         WHERE "tenantId" = $1 AND granularity = 'DAILY'
           AND period >= $2 AND period < $3`,
        [TENANT, RANGE_START, RANGE_END]
      );
      return {
        count: rows[0].count as unknown as number,
        cloudCostSum: Number(rows[0].sum),
      };
    }

    async function nonCreditBillingEntrySum(): Promise<number> {
      const { rows } = await pool.query<{ sum: string | null }>(
        `SELECT COALESCE(SUM("tenantAmount"), 0)::text AS sum
         FROM "BillingEntry"
         WHERE "tenantId" = $1 AND "usageStartDate" >= $2 AND "usageStartDate" < $3
           AND "chargeCategory" != 'Credit'`,
        [TENANT, RANGE_START, RANGE_END]
      );
      return Number(rows[0].sum);
    }

    beforeAll(async () => {
      pool = new Pool({ connectionString: DATABASE_URL, ssl: POOL_SSL });

      const mod = await import("@/lib/inngest/billing-sync");
      aggregateCostSnapshots =
        mod.aggregateCostSnapshots as AggregateCostSnapshots;
      const dbMod = await import("@repo/database");
      realDatabase = dbMod.database;

      await pool.query(
        `INSERT INTO "Tenant" (id, name, slug, "updatedAt")
         VALUES ($1, $2, $3, now())`,
        [TENANT, "NEB-186 Aggregation Test Tenant", `neb186-${TS}`]
      );

      await pool.query(
        `INSERT INTO "Integration" (id, "tenantId", source, name, config, "updatedAt")
         VALUES ($1, $2, 'billing_aws', 'Test AWS', '{}'::jsonb, now())`,
        [INTEGRATION, TENANT]
      );

      await pool.query(
        `INSERT INTO "StrategicTheme" (id, "tenantId", title, "updatedAt")
         VALUES ($1, $2, 'Theme A', now())`,
        [THEME_A, TENANT]
      );

      await pool.query(
        `INSERT INTO "Epic" (id, "tenantId", title, "strategicThemeId", "updatedAt")
         VALUES ($1, $3, 'Epic 1', $2, now()), ($4, $3, 'Epic 2', $2, now())`,
        [EPIC_1, THEME_A, TENANT, EPIC_2]
      );

      // Fixture: mesmo tema (THEME_A), épicos diferentes (EPIC_1 / EPIC_2),
      // e epicId nulo convivendo com não-nulo sob o mesmo tema — exatamente
      // os três grupos que a agregação precisa distinguir.
      //
      //   E1 EPIC_1  Usage  MAPPED    100 → grupo G1 (EPIC_1, dia1)
      //   E2 EPIC_2  Usage  MAPPED     50 → grupo G2 (EPIC_2, dia1)
      //   E3 NULL    Usage  UNMAPPED   20 → grupo G3 (epicId NULL, dia1)
      //   E4 EPIC_1  Credit MAPPED     10 → mesmo grupo G1 (Credit exclui de
      //                                     cloudCost, mas ainda existe)
      //
      // G1 não tem NENHUMA linha UNMAPPED (E1 e E4 são MAPPED) — é o grupo
      // que prova o COALESCE do unmappedAmount.
      await insertBillingEntry({
        externalId: `e1-${TS}`,
        themeId: THEME_A,
        epicId: EPIC_1,
        chargeCategory: "Usage",
        mappingConf: "MAPPED",
        tenantAmount: "100.000000",
      });
      await insertBillingEntry({
        externalId: `e2-${TS}`,
        themeId: THEME_A,
        epicId: EPIC_2,
        chargeCategory: "Usage",
        mappingConf: "MAPPED",
        tenantAmount: "50.000000",
      });
      await insertBillingEntry({
        externalId: `e3-${TS}`,
        themeId: THEME_A,
        epicId: null,
        chargeCategory: "Usage",
        mappingConf: "UNMAPPED",
        tenantAmount: "20.000000",
      });
      await insertBillingEntry({
        externalId: `e4-${TS}`,
        themeId: THEME_A,
        epicId: EPIC_1,
        chargeCategory: "Credit",
        mappingConf: "MAPPED",
        tenantAmount: "10.000000",
      });
    });

    afterAll(async () => {
      await pool.query(`DELETE FROM "CostSnapshot" WHERE "tenantId" = $1`, [
        TENANT,
      ]);
      await pool.query(`DELETE FROM "BillingEntry" WHERE "tenantId" = $1`, [
        TENANT,
      ]);
      await pool.query(`DELETE FROM "Epic" WHERE "tenantId" = $1`, [TENANT]);
      await pool.query(`DELETE FROM "StrategicTheme" WHERE "tenantId" = $1`, [
        TENANT,
      ]);
      await pool.query(`DELETE FROM "Integration" WHERE "tenantId" = $1`, [
        TENANT,
      ]);
      await pool.query(`DELETE FROM "Tenant" WHERE id = $1`, [TENANT]);

      await pool.end();
      if (
        realDatabase &&
        typeof (realDatabase as { $disconnect?: () => Promise<void> })
          .$disconnect === "function"
      ) {
        await (
          realDatabase as { $disconnect: () => Promise<void> }
        ).$disconnect();
      }
    });

    it(
      "running the aggregation twice over the same BillingEntry rows yields " +
        "identical CostSnapshot count and cloudCost sum (idempotent DELETE+INSERT)",
      async () => {
        await aggregateCostSnapshots(realDatabase, {
          tenantId: TENANT,
          startDate: RANGE_START,
          endDate: RANGE_END,
        });
        const first = await costSnapshotCountAndSum();
        expect(first.count).toBe(3); // G1 (EPIC_1), G2 (EPIC_2), G3 (epicId null)
        expect(first.cloudCostSum).toBe(170); // 100 + 50 + 20 (E4's Credit 10 excluded)

        await aggregateCostSnapshots(realDatabase, {
          tenantId: TENANT,
          startDate: RANGE_START,
          endDate: RANGE_END,
        });
        const second = await costSnapshotCountAndSum();

        expect(second.count).toBe(first.count);
        expect(second.cloudCostSum).toBe(first.cloudCostSum);
      }
    );

    it(
      "cloudCost sum across the period equals the sum of non-Credit " +
        "BillingEntry tenantAmount for the same period (no double counting)",
      async () => {
        await aggregateCostSnapshots(realDatabase, {
          tenantId: TENANT,
          startDate: RANGE_START,
          endDate: RANGE_END,
        });

        const { cloudCostSum } = await costSnapshotCountAndSum();
        const expected = await nonCreditBillingEntrySum();

        expect(cloudCostSum).toBe(expected);
      }
    );

    it(
      "a group with zero UNMAPPED rows writes unmappedAmount = 0 instead of " +
        "aborting the INSERT (COALESCE proof — see mutation test in the report)",
      async () => {
        await expect(
          aggregateCostSnapshots(realDatabase, {
            tenantId: TENANT,
            startDate: RANGE_START,
            endDate: RANGE_END,
          })
        ).resolves.not.toThrow();

        const { rows } = await pool.query<{ unmappedAmount: string }>(
          `SELECT "unmappedAmount"::text AS "unmappedAmount"
           FROM "CostSnapshot"
           WHERE "tenantId" = $1 AND "themeId" = $2 AND "epicId" = $3
             AND "artId" IS NULL AND period >= $4 AND period < $5`,
          [TENANT, THEME_A, EPIC_1, RANGE_START, RANGE_END]
        );

        expect(rows).toHaveLength(1);
        expect(Number(rows[0].unmappedAmount)).toBe(0);
      }
    );
  }
);

// @vitest-environment node
//
// Proves that Postgres Row Level Security actually isolates tenants once the
// app connects through a non-BYPASSRLS role and withTenantDb is wired into
// the request path (Sec 4 / Sec 5 of the isolamento-tenant plan).
//
// TWO CONNECTIONS, ON PURPOSE:
//   - `database` (from @repo/database, built from DATABASE_URL) is the
//     PRIVILEGED connection. It is used ONLY for discovery ("which tenants
//     have data?") and control counts ("how many rows does tenant X really
//     have?"). It is not the subject of this test — today it's a superuser
//     with BYPASSRLS, so any query run through it sees every row regardless
//     of RLS policy.
//   - `restrictedPool` (a raw `pg` Pool built from RLS_TEST_DATABASE_URL) is
//     the RESTRICTED connection. Every query whose visibility is under test
//     runs through it. It must point at a role with NOSUPERUSER/NOBYPASSRLS
//     (see docs/runbooks/app-db-role.md) for RLS policies to apply at all.
//
// Using a single connection for both roles used to be this file's bug: the
// discovery query ran through the same restricted connection as the scoped
// queries under test, so once RLS started working, discovery itself saw
// zero rows and the whole suite silently skipped, "certifying" nothing.
//
// withTenantDb (packages/database/tenant-db.ts) is intentionally NOT reused
// for the restricted connection: it runs through the `database` singleton,
// which is built once from DATABASE_URL (the privileged URL). The restricted
// connection needs its own client pointed at a different connection string,
// so this file opens a `pg` Pool directly and mirrors withTenantDb's
// `SELECT set_config('app.tenant_id', $1, true)` inside an explicit
// transaction.
//
// TEMPORARY GATE: this whole suite is skipped unless RLS_ENFORCED=1 is set,
// so it doesn't redden the default `pnpm test` run before the infrastructure
// exists. Remove the `describe.skipIf` line (and this comment) once:
//   1. docs/runbooks/app-db-role.md has been executed by an operator — the
//      app's DATABASE_URL points at a role with NOSUPERUSER + NOBYPASSRLS, and
//   2. the RLS migrations (20260603000001_rls_tenant_isolation and friends)
//      are actually applied — Sec 5 of the plan.
// Until both are true, RLS_ENFORCED should not be set anywhere this test runs
// (including CI), and this test should stay skipped rather than red.
import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

if (!(process.env.DATABASE_URL && process.env.RLS_TEST_DATABASE_URL)) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
}

type Tenant = { id: string; slug: string };
type TenantPair = { a: Tenant; b: Tenant };
type Database = typeof import("@repo/database").database;

const RESTRICTED_TABLES = ["Epic", "Feature", "Story", "Task"] as const;
type TableName = (typeof RESTRICTED_TABLES)[number];

const CONTROL_COUNTERS: Record<
  TableName,
  (db: Database, tenantId: string) => Promise<number>
> = {
  Epic: (db, tenantId) => db.epic.count({ where: { tenantId } }),
  Feature: (db, tenantId) => db.feature.count({ where: { tenantId } }),
  Story: (db, tenantId) => db.story.count({ where: { tenantId } }),
  Task: (db, tenantId) => db.task.count({ where: { tenantId } }),
};

async function tenantHasDataInAllModels(
  database: Database,
  tenantId: string
): Promise<boolean> {
  const [epics, features, stories, tasks] = await Promise.all([
    database.epic.count({ where: { tenantId } }),
    database.feature.count({ where: { tenantId } }),
    database.story.count({ where: { tenantId } }),
    database.task.count({ where: { tenantId } }),
  ]);
  return epics > 0 && features > 0 && stories > 0 && tasks > 0;
}

/** Row count seen by the restricted connection with no tenant context set. */
async function restrictedTotalCount(
  pool: Pool,
  table: TableName
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "${table}"`
    );
    return result.rows[0].count;
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

/** tenantId of every row visible to the restricted connection once
 * app.tenant_id is set for the duration of the transaction — mirrors
 * withTenantDb's set_config call, against a different (restricted) client. */
async function restrictedTenantIdsForTenant(
  pool: Pool,
  table: TableName,
  tenantId: string
): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await client.query<{ tenantId: string }>(
      `SELECT "tenantId" FROM "${table}"`
    );
    return result.rows.map((row) => row.tenantId);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

// Discovered once at module load, guarded by RLS_ENFORCED so a normal
// `pnpm test` run never touches the database or imports @repo/database.
const RLS_ENFORCED = Boolean(process.env.RLS_ENFORCED);
const RLS_TEST_DATABASE_URL = process.env.RLS_TEST_DATABASE_URL;

let database: Database | undefined;
let restrictedPool: Pool | undefined;
let tenantPair: TenantPair | undefined;
let skipReason = "RLS_ENFORCED is not set";

if (RLS_ENFORCED) {
  if (RLS_TEST_DATABASE_URL) {
    const mod = await import("@repo/database");
    database = mod.database;

    const tenants = await database.tenant.findMany({
      select: { id: true, slug: true },
    });
    const checked = await Promise.all(
      tenants.map(async (tenant) => ({
        tenant,
        hasData: await tenantHasDataInAllModels(
          database as Database,
          tenant.id
        ),
      }))
    );
    const candidates = checked.filter((c) => c.hasData).map((c) => c.tenant);

    if (candidates.length < 2) {
      skipReason =
        `apenas ${candidates.length} tenant(s) com dados em Epic/Feature/Story/Task ` +
        "visíveis pela conexão privilegiada (DATABASE_URL) — este teste precisa de " +
        "pelo menos 2 para provar isolamento sem ser vacuamente verdadeiro. Semeie " +
        "um segundo tenant (apps/app/scripts/seed-tenants.ts) antes de rodar com " +
        "RLS_ENFORCED=1.";
    } else {
      const [a, b] = candidates;
      tenantPair = { a, b };
      restrictedPool = new Pool({ connectionString: RLS_TEST_DATABASE_URL });
    }
  } else {
    skipReason =
      "RLS_TEST_DATABASE_URL não está definida. Este teste precisa de uma segunda " +
      "conexão, com um role NOSUPERUSER/NOBYPASSRLS (ex.: cosmos_app — ver " +
      "docs/runbooks/app-db-role.md), separada do DATABASE_URL privilegiado usado " +
      "apenas para descoberta e contagens de controle. Sem ela o teste não consegue " +
      "exercitar RLS de verdade. Defina RLS_TEST_DATABASE_URL antes de rodar com " +
      "RLS_ENFORCED=1.";
  }
}

if (RLS_ENFORCED && !tenantPair) {
  // eslint-disable-next-line no-console
  console.warn(`[rls-effective] skipped: ${skipReason}`);
}

describe.skipIf(!RLS_ENFORCED)(
  "RLS effectively isolates tenants (RLS_ENFORCED=1)",
  () => {
    afterAll(async () => {
      if (database) {
        await database.$disconnect();
      }
      if (restrictedPool) {
        await restrictedPool.end();
      }
    });

    for (const table of RESTRICTED_TABLES) {
      it.skipIf(!tenantPair)(
        `${table}: deny by default when app.tenant_id is unset`,
        async () => {
          const pool = restrictedPool as Pool;

          const seenWithNoContext = await restrictedTotalCount(pool, table);

          expect(seenWithNoContext).toBe(0);
        }
      );

      it.skipIf(!tenantPair)(
        `${table}: exact scope and no leak for tenant A`,
        async () => {
          const pair = tenantPair as TenantPair;
          const db = database as Database;
          const pool = restrictedPool as Pool;

          const controlCountA = await CONTROL_COUNTERS[table](db, pair.a.id);
          expect(controlCountA).toBeGreaterThan(0);

          const tenantIdsSeenByA = await restrictedTenantIdsForTenant(
            pool,
            table,
            pair.a.id
          );

          // Both halves matter: length must match A's own unscoped count (so
          // an over-restrictive policy — deny-all, a broken current_setting
          // call, a pooler resetting SET LOCAL — can't pass by returning too
          // few rows), and every returned row must belong to A (so an
          // under-restrictive policy can't pass by leaking another tenant's
          // rows in — not just B's, any tenant's).
          expect(tenantIdsSeenByA.length).toBe(controlCountA);
          expect(tenantIdsSeenByA.every((id) => id === pair.a.id)).toBe(true);
        }
      );
    }
  }
);

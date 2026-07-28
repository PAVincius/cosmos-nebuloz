// @vitest-environment node
//
// Proves that Postgres Row Level Security actually isolates tenants once the
// app connects through a non-BYPASSRLS role and withTenantDb is wired into
// the request path (Sec 4 / Sec 5 of the isolamento-tenant plan). Today the
// app still connects as `postgres` — superuser, BYPASSRLS — so RLS policies
// are skipped entirely and this test WOULD fail if it ran.
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
import { afterAll, describe, expect, it } from "vitest";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
}

type Tenant = { id: string; slug: string };
type TenantPair = { a: Tenant; b: Tenant };
type Database = typeof import("@repo/database").database;
type WithTenantDb = typeof import("@repo/database").withTenantDb;

const RLS_ENFORCED = Boolean(process.env.RLS_ENFORCED);

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

// Discovered once at module load, guarded by RLS_ENFORCED so a normal
// `pnpm test` run never touches the database or imports @repo/database.
let database: Database | undefined;
let withTenantDb: WithTenantDb | undefined;
let tenantPair: TenantPair | undefined;
let skipReason = "RLS_ENFORCED is not set";

if (RLS_ENFORCED) {
  const mod = await import("@repo/database");
  database = mod.database;
  withTenantDb = mod.withTenantDb;

  const tenants = await database.tenant.findMany({
    select: { id: true, slug: true },
  });
  const checked = await Promise.all(
    tenants.map(async (tenant) => ({
      tenant,
      hasData: await tenantHasDataInAllModels(database as Database, tenant.id),
    }))
  );
  const candidates = checked.filter((c) => c.hasData).map((c) => c.tenant);

  if (candidates.length < 2) {
    skipReason =
      `apenas ${candidates.length} tenant(s) com dados em Epic/Feature/Story/Task ` +
      "no banco de dev — este teste precisa de pelo menos 2 para provar isolamento " +
      "sem ser vacuamente verdadeiro. Semeie um segundo tenant " +
      "(scripts/seed-tenants.ts ou SEED_SECOND_TENANT=1, se implementado) antes de " +
      "rodar com RLS_ENFORCED=1.";
  } else {
    const [a, b] = candidates;
    tenantPair = { a, b };
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
    });

    it.skipIf(!tenantPair)(
      "tenant A cannot see tenant B's Epic rows",
      async () => {
        const pair = tenantPair as TenantPair;
        const db = database as Database;
        const runAsTenantA = withTenantDb as WithTenantDb;

        const controlCountB = await db.epic.count({
          where: { tenantId: pair.b.id },
        });
        expect(controlCountB).toBeGreaterThan(0);

        const controlCountA = await db.epic.count({
          where: { tenantId: pair.a.id },
        });
        expect(controlCountA).toBeGreaterThan(0);

        const rowsSeenByA = await runAsTenantA(pair.a.id, (tx) =>
          tx.epic.findMany({ select: { tenantId: true } })
        );
        // Both halves matter: length must match A's own unscoped count (so
        // an over-restrictive policy — deny-all, a broken current_setting
        // call, a pooler resetting SET LOCAL — can't pass by returning too
        // few rows), and every returned row must belong to A (so an
        // under-restrictive policy can't pass by leaking B's rows in).
        expect(rowsSeenByA.length).toBe(controlCountA);
        expect(rowsSeenByA.every((row) => row.tenantId === pair.a.id)).toBe(
          true
        );
      }
    );

    it.skipIf(!tenantPair)(
      "tenant A cannot see tenant B's Feature rows",
      async () => {
        const pair = tenantPair as TenantPair;
        const db = database as Database;
        const runAsTenantA = withTenantDb as WithTenantDb;

        const controlCountB = await db.feature.count({
          where: { tenantId: pair.b.id },
        });
        expect(controlCountB).toBeGreaterThan(0);

        const controlCountA = await db.feature.count({
          where: { tenantId: pair.a.id },
        });
        expect(controlCountA).toBeGreaterThan(0);

        const rowsSeenByA = await runAsTenantA(pair.a.id, (tx) =>
          tx.feature.findMany({ select: { tenantId: true } })
        );
        expect(rowsSeenByA.length).toBe(controlCountA);
        expect(rowsSeenByA.every((row) => row.tenantId === pair.a.id)).toBe(
          true
        );
      }
    );

    it.skipIf(!tenantPair)(
      "tenant A cannot see tenant B's Story rows",
      async () => {
        const pair = tenantPair as TenantPair;
        const db = database as Database;
        const runAsTenantA = withTenantDb as WithTenantDb;

        const controlCountB = await db.story.count({
          where: { tenantId: pair.b.id },
        });
        expect(controlCountB).toBeGreaterThan(0);

        const controlCountA = await db.story.count({
          where: { tenantId: pair.a.id },
        });
        expect(controlCountA).toBeGreaterThan(0);

        const rowsSeenByA = await runAsTenantA(pair.a.id, (tx) =>
          tx.story.findMany({ select: { tenantId: true } })
        );
        expect(rowsSeenByA.length).toBe(controlCountA);
        expect(rowsSeenByA.every((row) => row.tenantId === pair.a.id)).toBe(
          true
        );
      }
    );

    it.skipIf(!tenantPair)(
      "tenant A cannot see tenant B's Task rows",
      async () => {
        const pair = tenantPair as TenantPair;
        const db = database as Database;
        const runAsTenantA = withTenantDb as WithTenantDb;

        const controlCountB = await db.task.count({
          where: { tenantId: pair.b.id },
        });
        expect(controlCountB).toBeGreaterThan(0);

        const controlCountA = await db.task.count({
          where: { tenantId: pair.a.id },
        });
        expect(controlCountA).toBeGreaterThan(0);

        const rowsSeenByA = await runAsTenantA(pair.a.id, (tx) =>
          tx.task.findMany({ select: { tenantId: true } })
        );
        expect(rowsSeenByA.length).toBe(controlCountA);
        expect(rowsSeenByA.every((row) => row.tenantId === pair.a.id)).toBe(
          true
        );
      }
    );
  }
);

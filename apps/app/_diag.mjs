import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/cosmos_dev',
  // fail fast if a query hangs
  connectionTimeoutMillis: 5000,
});

// Override with SET statement_timeout per connection
const client = await pool.connect();
await client.query("SET statement_timeout = '3s'");
await client.query("SET lock_timeout = '2s'");

const ts = Date.now();
const tenantId = `diag-${ts}`;
const teamId   = `dteam-${ts}`;
const userId   = `duser-${ts}`;

try {
  await client.query(`INSERT INTO "Tenant" (id, name, slug, "updatedAt") VALUES ($1,$2,$3,now())`, [tenantId,'Diag',tenantId]);
  console.log('Tenant OK');

  await client.query(`INSERT INTO "Team" (id, "tenantId", name, "updatedAt") VALUES ($1,$2,$3,now())`, [teamId, tenantId, 'DTeam']);
  console.log('Team OK');

  await client.query(
    `INSERT INTO "MemberThroughputBaseline" (id, "tenantId", "teamId", "userId") VALUES (gen_random_uuid()::text, $1, $2, $3)`,
    [tenantId, teamId, userId]
  );
  console.log('MTB first insert OK');

  // Check other connections' locks
  const { rows: locks } = await client.query(
    `SELECT pid, relation::regclass, mode, granted FROM pg_locks WHERE pid != pg_backend_pid() AND relation IS NOT NULL ORDER BY pid LIMIT 20`
  );
  console.log('Other session locks:', JSON.stringify(locks));

  // Now try duplicate
  const t = Date.now();
  try {
    await client.query(
      `INSERT INTO "MemberThroughputBaseline" (id, "tenantId", "teamId", "userId") VALUES (gen_random_uuid()::text, $1, $2, $3)`,
      [tenantId, teamId, userId]
    );
    console.log('SECOND INSERT SUCCEEDED — constraint missing!');
  } catch (e) {
    console.log(`Second insert: ${Date.now()-t}ms | code=${e.code} | ${e.message.slice(0,150)}`);
  }
} catch (e) {
  console.error('Setup error:', e.message);
} finally {
  await client.query(`DELETE FROM "MemberThroughputBaseline" WHERE "tenantId" = $1`, [tenantId]);
  await client.query(`DELETE FROM "Team" WHERE id = $1`, [teamId]);
  await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tenantId]);
  client.release();
  await pool.end();
}

// seed-admin-minimal.mjs
// Script ESM standalone para gerar hash e inserir via PG direto
// Executa de: packages/auth/
import { hashPassword } from "./node_modules/better-auth/dist/crypto/password.mjs";
import pg from "pg";

const { Client } = pg;

const EMAIL = process.env.E2E_EMAIL ?? "admin@cosmos.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "Cosmos@2026!";
const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/cosmos_dev";

async function main() {
  console.log("🔐 Gerando hash da senha...");
  const hashedPassword = await hashPassword(PASSWORD);
  console.log("✅ Hash gerado");

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("🔗 Conectado ao banco");

  // Upsert User
  const userRes = await client.query(`
    INSERT INTO "User" (id, email, name, "emailVerified", "createdAt", "updatedAt")
    VALUES (
      'cuid_admin_cosmos_seed_001',
      $1,
      'Admin Cosmos',
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      "emailVerified" = true,
      "updatedAt" = NOW()
    RETURNING id, email
  `, [EMAIL]);

  const userId = userRes.rows[0].id;
  console.log(`✅ User: ${userRes.rows[0].email} (${userId})`);

  // Upsert Account (password credential)
  await client.query(`
    INSERT INTO "Account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
    VALUES (
      'cuid_account_cosmos_seed_001',
      $1,
      'credential',
      $2,
      $3,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      password = EXCLUDED.password,
      "updatedAt" = NOW()
  `, [EMAIL, userId, hashedPassword]);
  console.log("✅ Account credential criada/atualizada");

  // Upsert Tenant
  const tenantRes = await client.query(`
    INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt")
    VALUES (
      'cuid_tenant_cosmos_dev_001',
      'COSMOS Dev',
      'cosmos-dev',
      NOW(),
      NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      "updatedAt" = NOW()
    RETURNING id, name, slug
  `);
  const tenantId = tenantRes.rows[0].id;
  console.log(`✅ Tenant: ${tenantRes.rows[0].name} (${tenantId})`);

  // Upsert TenantMember
  await client.query(`
    INSERT INTO "TenantMember" (id, "tenantId", "userId", role, "createdAt")
    VALUES (
      'cuid_member_cosmos_admin_001',
      $1,
      $2,
      'ADMIN',
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `, [tenantId, userId]);
  console.log(`✅ Membership: ADMIN em COSMOS Dev`);

  await client.end();

  console.log("\n─────────────────────────────────");
  console.log("🎉 Seed concluído!\n");
  console.log(`  Email:  ${EMAIL}`);
  console.log(`  Senha:  ${PASSWORD}`);
  console.log(`  Tenant: COSMOS Dev`);
  console.log(`  Role:   ADMIN`);
  console.log("─────────────────────────────────\n");
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});

import type { PrismaClient } from "../../../../packages/database/generated";

export const STAFF_EMAIL = "e2e-staff@nebuloz.exemplo";

/**
 * `@repo/database` abre com `import "server-only"`, que lança fora do
 * bundler do Next — quebraria a coleta do Playwright. `scripts/seed-e2e.ts`
 * (apps/app) evita isso montando o próprio PrismaClient a partir do client
 * gerado; aqui o `require` fica dentro da função para que nem esse import
 * rode durante `playwright test --list`, só quando o teste de fato executa.
 */
function connect(): PrismaClient {
  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const {
    PrismaClient: Client,
  } = require("../../../../packages/database/generated");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new Client({ adapter: new PrismaPg(pool) });
}

/** Garante que existe um usuário de staff — membro do tenant interno. Sem isso
 *  o guard nega e o teste falha por motivo errado. */
export async function ensureStaffUser(): Promise<string> {
  const db = connect();

  const user = await db.user.upsert({
    where: { email: STAFF_EMAIL },
    create: { email: STAFF_EMAIL, name: "E2E Staff", emailVerified: true },
    update: {},
    select: { id: true },
  });

  await db.tenantMember.upsert({
    where: {
      tenantId_userId: { tenantId: "system", userId: user.id },
    },
    create: { tenantId: "system", userId: user.id, role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  return user.id;
}

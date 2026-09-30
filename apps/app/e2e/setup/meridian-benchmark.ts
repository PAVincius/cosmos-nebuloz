import dotenv from "dotenv";
import { E2E_TENANT_SLUG } from "./seeds";

dotenv.config({ path: ".env.local" });

/**
 * Liga ou desliga a habilitação de benchmark do tenant do e2e, direto no banco
 * local (o app só lê essa tabela; quem escreve é o back-office). Só para os
 * testes que provam a trava (specs/012): o seed deixa o tenant habilitado.
 */
export async function setBenchmarkEnabled(enabled: boolean): Promise<void> {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const { PrismaClient } = await import(
    "../../../../packages/database/generated/index.js"
  );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: E2E_TENANT_SLUG },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error(
        `setBenchmarkEnabled: tenant "${E2E_TENANT_SLUG}" não encontrado — rode o seed primeiro.`
      );
    }
    await db.meridianBenchmarkEnablement.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        enabled,
        agreementRef: "SEED-DEMO — sem aditivo real",
      },
      update: { enabled },
    });
  } finally {
    await db.$disconnect();
  }
}

import type { PrismaClient } from "@repo/database";

// Habilitação de benchmark por tenant (specs/012-benchmark-travado-tenant).
// Sem linha = desligado: tenant novo nasce travado. Quem liga é só a Nebuloz,
// pelo back-office (`setMeridianBenchmarkEnablement`, em @repo/provisioning);
// o papel do app só lê a tabela (migration 20260929030000).
export type EnablementDb = Pick<PrismaClient, "meridianBenchmarkEnablement">;

export async function isBenchmarkEnabled(
  db: EnablementDb,
  tenantId: string
): Promise<boolean> {
  const row = await db.meridianBenchmarkEnablement.findUnique({
    where: { tenantId },
    select: { enabled: true },
  });
  return row?.enabled === true;
}

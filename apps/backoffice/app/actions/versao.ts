"use server";

import { database } from "@repo/database";
import { MIGRATIONS_DO_CODIGO } from "@repo/database/migrations-do-codigo";
import { requirePlatformStaff } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";
import {
  type ComparacaoDeSchema,
  compararSchema,
  type MigrationAplicada,
  type VersaoDoCodigo,
  versaoDoCodigo,
} from "@/lib/versao";

export type EstadoDoDeploy = {
  codigo: VersaoDoCodigo;
  schema: ComparacaoDeSchema;
  /** As últimas aplicadas, da mais recente para trás. */
  recentes: MigrationAplicada[];
  lidoEm: string;
};

/** Quantas migrations recentes a tela lista. O histórico completo está no
 *  banco; aqui interessa a ponta, que é onde drift aparece. */
const RECENTES = 8;

type LinhaDoLedger = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export async function lerEstadoDoDeploy(): Promise<Result<EstadoDoDeploy>> {
  return await safeAction(async () => {
    // Leitura de estado do sistema, não de dado de cliente: basta ser staff.
    // `assertCanWrite` não entra porque não há escrita nesta tela.
    await requirePlatformStaff();

    // `_prisma_migrations` é tabela do próprio Prisma e não tem model no
    // schema, então é consulta crua — a única do painel junto do health.
    const linhas = await database.$queryRaw<LinhaDoLedger[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at ASC
    `;

    const aplicadas: MigrationAplicada[] = linhas.map((l) => ({
      nome: l.migration_name,
      concluida: l.finished_at !== null && l.rolled_back_at === null,
      aplicadaEm: l.finished_at ? l.finished_at.toISOString() : null,
    }));

    return {
      codigo: versaoDoCodigo(),
      schema: compararSchema({
        doCodigo: MIGRATIONS_DO_CODIGO,
        aplicadas,
      }),
      recentes: [...aplicadas].reverse().slice(0, RECENTES),
      lidoEm: new Date().toISOString(),
    };
  });
}

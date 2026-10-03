"use server";

import { database, withTenantDb } from "@repo/database";
import { z } from "zod";
import {
  bandsFrom,
  type CohortRead,
  cohortKeyOf,
  readCohort,
} from "@/lib/meridian/benchmark";
import { isBenchmarkEnabled } from "@/lib/meridian/benchmark-enablement";
import { requireBenchmarkEnabled } from "@/lib/meridian/benchmark-guard";
import {
  requireMeridianContext,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";
import { cuid, nnStr, type Result, safeAction } from "../../actions/_base";
import { recalculate } from "./_benchmark-core";
import { FIELD_LABELS, logMeridianAudit } from "./_shared";

// Benchmark pool — US6.
//
// As duas tabelas de coorte são globais e anônimas: não têm tenantId e nenhuma
// coluna identifica organização. É essa ausência que permite agregar entre
// tenants sem violar o isolamento que o resto do módulo respeita — e é por isso
// que a leitura passa por `readCohort`, o único ponto onde o limiar é aplicado.
//
// O miolo que o scoring chama por dentro (`contributeInTx`, `recalculate`) vive em
// `_benchmark-core.ts`: aqui só entra o que é, de fato, uma ação.

export type CohortRow = CohortRead;

const OptOutSchema = z.object({ assessmentId: cuid });

/** Retirar o opt-in remove as contribuições e recalcula. Sem isto, o
 *  consentimento retirado não teria efeito no pool — o que é o mesmo que não
 *  ter consentimento. */
export async function withdrawContribution(
  raw: z.input<typeof OptOutSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    // Retirar o opt-in apaga a contribuição de um assessment: decisão de quem
    // conduz o assessment (achado 11 do Vigia). VIEWER e REVIEWER não retiram o
    // consentimento de ninguém.
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = OptOutSchema.parse(raw);

    const cohortKey = await withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: {
          id: true,
          code: true,
          orgName: true,
          sector: true,
          sizeBand: true,
          benchmarkOptIn: true,
        },
      });
      if (!a) {
        return null;
      }
      await db.meridianAssessment.update({
        where: { id: a.id },
        data: { benchmarkOptIn: false },
      });
      // Retirar o consentimento é decisão registrada, com o estado de antes.
      await logMeridianAudit(db, ctx, {
        action: "meridian.benchmark.withdraw",
        entityType: "meridian.benchmark",
        entityId: a.id,
        target: `${a.code} · ${a.orgName}`,
        diff: [
          [
            FIELD_LABELS.benchmarkOptIn,
            a.benchmarkOptIn ? "Ativo" : "Inativo",
            "Retirado",
          ],
        ],
      });
      return cohortKeyOf(a.sector, a.sizeBand);
    });

    if (!cohortKey) {
      return;
    }
    await database.meridianBenchmarkContribution.deleteMany({
      where: { assessmentId: input.assessmentId },
    });
    await recalculate(cohortKey);
  });
}

/** Lista as coortes. Cada linha passa por `readCohort`: a que está abaixo do
 *  limiar volta **sem** os percentis, não com eles escondidos na UI. Sem a
 *  habilitação de benchmark do tenant, recusa (specs/012): quem não contribui
 *  também não lê. */
export async function listCohorts(): Promise<Result<CohortRow[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    await withTenantDb(ctx.tenantId, (db) =>
      requireBenchmarkEnabled(db, ctx.tenantId)
    );
    const rows = await database.meridianBenchmarkCohort.findMany({
      orderBy: { cohortKey: "asc" },
      select: { cohortKey: true, n: true, percentiles: true },
    });
    return rows.map((c) =>
      readCohort({
        cohortKey: c.cohortKey,
        n: c.n,
        bands: bandsFrom(c.percentiles),
      })
    );
  });
}

const ReadSchema = z.object({ cohortKey: nnStr });

export async function readCohortAction(
  raw: z.input<typeof ReadSchema>
): Promise<Result<CohortRead>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    await withTenantDb(ctx.tenantId, (db) =>
      requireBenchmarkEnabled(db, ctx.tenantId)
    );
    const input = ReadSchema.parse(raw);
    const c = await database.meridianBenchmarkCohort.findUnique({
      where: { cohortKey: input.cohortKey },
      select: { cohortKey: true, n: true, percentiles: true },
    });
    if (!c) {
      return { cohortKey: input.cohortKey, n: 0, withheld: true as const };
    }
    return readCohort({
      cohortKey: c.cohortKey,
      n: c.n,
      bands: bandsFrom(c.percentiles),
    });
  });
}

/** A habilitação de benchmark do tenant da sessão, para a tela de criar
 *  assessment decidir se mostra a caixa de opt-in. Só leitura: ligar e desligar
 *  é da Nebuloz, no back-office. */
export async function getBenchmarkEnablement(): Promise<
  Result<{ enabled: boolean }>
> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    const enabled = await withTenantDb(ctx.tenantId, (db) =>
      isBenchmarkEnabled(db, ctx.tenantId)
    );
    return { enabled };
  });
}

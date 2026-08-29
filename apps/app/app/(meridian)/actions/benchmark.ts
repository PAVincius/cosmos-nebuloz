"use server";

import { database, withTenantDb } from "@repo/database";
import { z } from "zod";
import { AXIS_IDS } from "@/lib/meridian/axes";
import {
  bandsFrom,
  type CohortRead,
  cohortKeyOf,
  percentiles,
  readCohort,
} from "@/lib/meridian/benchmark";
import { finalOf } from "@/lib/meridian/composite";
import { requireMeridianContext } from "@/lib/meridian/guards";
import { cuid, nnStr, type Result, safeAction } from "../../actions/_base";
import type { Db } from "./_shared";

// Benchmark pool — US6.
//
// As duas tabelas de coorte são globais e anônimas: não têm tenantId e nenhuma
// coluna identifica organização. É essa ausência que permite agregar entre
// tenants sem violar o isolamento que o resto do módulo respeita — e é por isso
// que a leitura passa por `readCohort`, o único ponto onde o limiar é aplicado.

export type CohortRow = CohortRead;

/** Recalcula o agregado da coorte a partir de todas as contribuições. Roda na
 *  transação da contribuição — um agregado desatualizado é pior do que ausente,
 *  porque parece atual. */
async function recalculate(cohortKey: string): Promise<void> {
  const rows = await database.meridianBenchmarkContribution.findMany({
    where: { cohortKey },
    select: { assessmentId: true, axis: true, score: true },
  });
  const orgs = new Set(rows.map((r) => r.assessmentId));
  const bands = Object.fromEntries(
    AXIS_IDS.map((axis) => [
      axis,
      percentiles(rows.filter((r) => r.axis === axis).map((r) => r.score)),
    ])
  );
  await database.meridianBenchmarkCohort.update({
    where: { cohortKey },
    data: {
      n: orgs.size,
      percentiles: bands,
      recalculatedAt: new Date(),
    },
  });
}

/**
 * Grava as contribuições de um assessment e recalcula a coorte.
 *
 * Chamado por `runScoring` apenas quando `benchmarkOptIn = true` — a porta é o
 * consentimento, e ele é default deny no schema.
 */
export async function contributeInTx(
  db: Db,
  assessmentId: string
): Promise<void> {
  const a = await db.meridianAssessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      sector: true,
      sizeBand: true,
      benchmarkOptIn: true,
      scores: { select: { axis: true, computed: true, final: true } },
    },
  });
  if (!(a?.benchmarkOptIn && a.scores.length)) {
    return;
  }
  const cohortKey = cohortKeyOf(a.sector, a.sizeBand);

  await database.meridianBenchmarkCohort.upsert({
    where: { cohortKey },
    create: { cohortKey, n: 0, percentiles: {} },
    update: {},
  });
  for (const s of a.scores) {
    const score = finalOf(s);
    await database.meridianBenchmarkContribution.upsert({
      where: { assessmentId_axis: { assessmentId: a.id, axis: s.axis } },
      create: { cohortKey, assessmentId: a.id, axis: s.axis, score },
      update: { cohortKey, score },
    });
  }
  await recalculate(cohortKey);
}

const OptOutSchema = z.object({ assessmentId: cuid });

/** Retirar o opt-in remove as contribuições e recalcula. Sem isto, o
 *  consentimento retirado não teria efeito no pool — o que é o mesmo que não
 *  ter consentimento. */
export async function withdrawContribution(
  raw: z.input<typeof OptOutSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    const input = OptOutSchema.parse(raw);

    const cohortKey = await withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: { id: true, sector: true, sizeBand: true },
      });
      if (!a) {
        return null;
      }
      await db.meridianAssessment.update({
        where: { id: a.id },
        data: { benchmarkOptIn: false },
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
 *  limiar volta **sem** os percentis, não com eles escondidos na UI. */
export async function listCohorts(): Promise<Result<CohortRow[]>> {
  return safeAction(async () => {
    await requireMeridianContext();
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
    await requireMeridianContext();
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

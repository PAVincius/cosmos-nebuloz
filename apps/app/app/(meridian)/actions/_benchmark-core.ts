import "server-only";

import { database } from "@repo/database";
import { AXIS_IDS } from "@/lib/meridian/axes";
import { cohortKeyOf, percentiles } from "@/lib/meridian/benchmark";
import { isBenchmarkEnabled } from "@/lib/meridian/benchmark-enablement";
import { finalOf } from "@/lib/meridian/composite";
import type { MeridianContext } from "@/lib/meridian/guards";
import { type Db, logMeridianAudit } from "./_shared";

// Miolo do benchmark: o que as actions de `benchmark.ts` e o scoring chamam por
// dentro. Fica FORA do arquivo `"use server"` de propósito: todo export assíncrono
// de um arquivo assim vira endpoint, e estas funções recebem um cliente de
// transação e o contexto do ator. Não são ações (achado 7 do Vigia).

/** Recalcula o agregado da coorte a partir de todas as contribuições. Roda na
 *  transação da contribuição — um agregado desatualizado é pior do que ausente,
 *  porque parece atual. */
export async function recalculate(cohortKey: string): Promise<void> {
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
 * consentimento, e ele é default deny no schema. Além do opt-in, o tenant
 * precisa estar habilitado pela Nebuloz (`isBenchmarkEnabled`).
 */
export async function contributeInTx(
  db: Db,
  ctx: MeridianContext,
  assessmentId: string
): Promise<void> {
  const a = await db.meridianAssessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      code: true,
      orgName: true,
      sector: true,
      sizeBand: true,
      tenantId: true,
      benchmarkOptIn: true,
      scores: { select: { axis: true, computed: true, final: true } },
    },
  });
  if (!(a?.benchmarkOptIn && a.scores.length)) {
    return;
  }
  // Travado por tenant (specs/012): a habilitação vale no momento do scoring e
  // mais que um opt-in antigo. Desligada, nada entra na coorte.
  if (!(await isBenchmarkEnabled(db, a.tenantId))) {
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

  // Entrar no pool é escrita de consentimento (opt-in): deixa trilha. A coorte e
  // a contagem de eixos não identificam organização, e os scores não vão junto.
  await logMeridianAudit(db, ctx, {
    action: "meridian.benchmark.contribute",
    entityType: "meridian.benchmark",
    entityId: a.id,
    target: `${a.code} · ${a.orgName}`,
    diff: [
      ["Coorte", "—", cohortKey],
      ["Eixos contribuídos", "—", String(a.scores.length)],
    ],
  });
}

"use server";

import { type Prisma, withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adoptionPct, fmtAdoption } from "@/lib/signal/adoption";
import { computeConfidence } from "@/lib/signal/confidence";
import { SignalRuleError, SignalStateConflictError } from "@/lib/signal/errors";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import { computeOutcome, fmtDelta } from "@/lib/signal/outcome";
import {
  buildReportPayload,
  estimatePageCount,
  freezeBlockers,
  type ReportInitiativeLine,
  type ReportPayload,
} from "@/lib/signal/report-payload";
import { computePortfolioRoi, computeRoi } from "@/lib/signal/roi";
import { isAtRisk, type SignalVerdict, verdictOf } from "@/lib/signal/verdict";
import { nnStr, optStr } from "../../actions/_base";
import {
  type Db,
  FIELD_LABELS,
  logSignalAudit,
  nextCode,
  type SignalResult,
  signalAction,
} from "./_shared";

// Relatórios — US6.
//
// Duas regras sustentam este arquivo, e as duas são sobre a mesma coisa: o que
// o comitê leu não pode mudar depois.
//
//   1. Congelar exige que as fontes citadas estejam de pé. Um relatório
//      fechado com fonte caída congela um número que já estava velho e o
//      apresenta como fechamento do período — 409 com a lista do que
//      reconectar, não 422 genérico: o problema não é o pedido, é o estado.
//
//   2. Relatório FINAL não aceita escrita. Nem para "corrigir um detalhe":
//      corrigir depois de distribuído é reescrever a história da reunião. Se o
//      número mudou, o certo é um relatório novo, e os dois lado a lado.

const DraftSchema = z.object({
  name: nnStr,
  kind: z.enum(["EXECUTIVE", "PORTFOLIO"]).default("EXECUTIVE"),
  periodLabel: nnStr,
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  note: optStr,
});

export type ReportRow = {
  code: string;
  name: string;
  kind: "EXECUTIVE" | "PORTFOLIO";
  state: "DRAFT" | "FINAL";
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  pageCount: number | null;
  generatedBy: string | null;
  generatedAt: Date | null;
  note: string | null;
  /** Preenchido só em rascunho travado. É o texto que a tela mostra inteiro. */
  blockedReason: string | null;
};

const DETAIL_INCLUDE = {
  owner: { select: { name: true, email: true } },
  adoption: { orderBy: { periodStart: "desc" as const }, take: 1 },
  outcomes: { orderBy: { periodStart: "asc" as const } },
  roiFormulas: {
    where: { state: "ACTIVE" as const },
    include: { entries: { orderBy: { order: "asc" as const } } },
  },
  confidenceScores: { include: { rule: true } },
  observations: { orderBy: { observedAt: "desc" as const } },
} satisfies Prisma.SignalInitiativeInclude;

type ReportRowSource = Prisma.SignalInitiativeGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/** Uma linha do relatório. O ROI só sai acompanhado de versão e confiança. */
function lineOf(
  initiative: ReportRowSource,
  bars: { adoptionBar: number; valueBar: number }
): ReportInitiativeLine {
  const formula = initiative.roiFormulas[0] ?? null;
  const entries = (formula?.entries ?? []).map((e) => ({
    kind: e.kind,
    label: e.label,
    total: Number(e.total),
    sourceLabel: e.sourceLabel,
  }));
  const roi = computeRoi(entries);
  const snapshot = initiative.adoption[0] ?? null;
  const pct = snapshot
    ? adoptionPct({
        activeUsers: snapshot.activeUsers,
        licensedUsers: snapshot.licensedUsers,
      })
    : 0;

  const factors = initiative.confidenceScores.map((s) => ({
    key: s.rule.key,
    label: s.rule.label,
    weight: s.rule.weight,
    got: s.got,
    note: s.note,
  }));
  const confidence = factors.length > 0 ? computeConfidence(factors) : null;

  const outcome = computeOutcome(
    initiative.outcomes.map((o) => ({
      periodStart: o.periodStart,
      periodEnd: o.periodEnd,
      metricLabel: o.metricLabel,
      baselineValue: o.baselineValue,
      currentValue: o.currentValue,
      numericBaseline:
        o.numericBaseline === null ? null : Number(o.numericBaseline),
      numericCurrent:
        o.numericCurrent === null ? null : Number(o.numericCurrent),
      isSecondary: o.isSecondary,
      direction: o.direction,
    }))
  );

  return {
    code: initiative.code,
    name: initiative.name,
    businessUnit: initiative.businessUnit,
    category: initiative.category,
    status: initiative.status,
    owner: initiative.owner?.name ?? initiative.owner?.email ?? null,
    adoptionPct: pct,
    adoptionLabel: fmtAdoption(pct),
    outcomeLabel: outcome
      ? `${outcome.metricLabel}: ${outcome.baselineValue} → ${outcome.currentValue} (${fmtDelta(outcome.deltaPct)})`
      : null,
    invested: roi.invested,
    returned: roi.returned,
    // Sem fórmula ativa não há ROI apresentável — e o `null` viaja para a
    // ressalva dizer isso em vez de a tela imprimir "0,0×".
    multiple: formula ? roi.multiple : null,
    formulaVersion: formula?.version ?? null,
    confidenceScore: confidence?.score ?? null,
    confidenceBand: confidence?.band ?? "NONE",
    verdict: verdictOf({ adoptionPct: pct, multiple: roi.multiple }, bars),
    evidence: initiative.observations.map((o) => ({
      code: o.code,
      metricLabel: o.metricLabel,
      value: o.value,
      unit: o.unit,
      windowLabel: `${o.windowStart.toLocaleDateString("pt-BR")} – ${o.windowEnd.toLocaleDateString("pt-BR")}`,
      sourceLabel: o.connectionLabel ?? "entrada manual",
      transform: o.transform,
      flag: o.flag,
    })),
  };
}

/** Monta o payload a partir do banco. Chamado no congelamento, nunca na leitura. */
async function composePayload(
  db: Db,
  tenantId: string,
  report: {
    kind: "EXECUTIVE" | "PORTFOLIO";
    periodLabel: string;
    periodStart: Date;
    periodEnd: Date;
  }
): Promise<ReportPayload> {
  const [tenant, settings, initiatives, connections] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    db.signalSettings.findUnique({ where: { tenantId } }),
    db.signalInitiative.findMany({
      where: { tenantId, status: { in: ["ACTIVE", "CLOSED"] } },
      include: DETAIL_INCLUDE,
      orderBy: { code: "asc" },
    }),
    db.signalConnection.findMany({
      where: { tenantId },
      select: { code: true, name: true, health: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const bars = {
    adoptionBar: settings?.adoptionBar ?? 60,
    valueBar: Number(settings?.valueBar ?? 1.5),
  };
  const lines = initiatives.map((i) => lineOf(i, bars));
  const totalsRoi = computePortfolioRoi(lines);
  const byVerdict = { PROVEN: 0, VANITY: 0, PROMISE: 0, STOP: 0 } as Record<
    SignalVerdict,
    number
  >;
  let atRisk = 0;
  for (const l of lines) {
    byVerdict[l.verdict] += 1;
    if (isAtRisk(l.verdict)) {
      atRisk += l.invested;
    }
  }

  return buildReportPayload({
    generatedAt: new Date(),
    organization: tenant?.name ?? "—",
    periodLabel: report.periodLabel,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    kind: report.kind,
    currency: settings?.currency ?? "BRL",
    bars,
    totals: { ...totalsRoi, atRisk, byVerdict },
    initiatives: lines,
    sources: connections,
  });
}

export async function listReports(): Promise<SignalResult<ReportRow[]>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.signalReportSnapshot.findMany({
        where: { tenantId: ctx.tenantId },
        include: { generatedBy: { select: { name: true, email: true } } },
        orderBy: [{ periodEnd: "desc" }, { code: "desc" }],
      });

      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        kind: r.kind,
        state: r.state,
        periodLabel: r.periodLabel,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        pageCount: r.pageCount,
        generatedBy: r.generatedBy?.name ?? r.generatedBy?.email ?? null,
        generatedAt: r.generatedAt,
        note: r.note,
        blockedReason: r.state === "DRAFT" ? r.blockedReason : null,
      }));
    });
  });
}

export async function draftReport(
  raw: z.input<typeof DraftSchema>
): Promise<SignalResult<{ code: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.report.write");
    const input = DraftSchema.parse(raw);

    if (input.periodEnd < input.periodStart) {
      throw new SignalRuleError(
        "report.period.order",
        "O período termina antes de começar — confira as datas."
      );
    }

    const saved = await withTenantDb(ctx.tenantId, async (db) => {
      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "report",
      });
      const created = await db.signalReportSnapshot.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          name: input.name,
          kind: input.kind,
          periodLabel: input.periodLabel,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          state: "DRAFT",
          note: input.note,
        },
      });
      await logSignalAudit(db, ctx, {
        action: "Relatório rascunhado",
        entityType: "signal.report",
        entityId: created.id,
        target: `${code} · ${input.name}`,
        note: input.periodLabel,
      });
      return { code };
    });

    revalidatePath("/signal/reports");
    return saved;
  });
}

/**
 * Congela o relatório: monta o payload e fecha.
 *
 * O payload é gravado NESTE instante e nunca mais recalculado. É a diferença
 * entre "o relatório mostra o que o sistema pensa hoje" e "o relatório mostra o
 * que foi apresentado" — e só a segunda serve para conferir uma decisão velha.
 */
export async function freezeReport(raw: {
  code: string;
}): Promise<SignalResult<{ code: string; pageCount: number }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.report.freeze");
    const input = z.object({ code: nnStr }).parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const report = await db.signalReportSnapshot.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
      });
      if (!report) {
        throw new SignalRuleError(
          "report.not-found",
          `Relatório ${input.code} não encontrado nesta organização.`
        );
      }
      if (report.state === "FINAL") {
        throw new SignalRuleError(
          "report.frozen",
          `${report.code} já está congelado. Um número que mudou pede relatório novo, não correção no antigo — os dois lado a lado é o que deixa a mudança visível.`
        );
      }

      const payload = await composePayload(db, ctx.tenantId, report);
      const blockers = freezeBlockers(payload);

      if (blockers.length > 0) {
        const reason = `${blockers.length} ${blockers.length === 1 ? "fonte citada está" : "fontes citadas estão"} fora do ar. Congelar agora fecharia o período com número velho apresentado como fechamento.`;
        // A razão fica gravada: quem abrir o rascunho amanhã vê por que ele
        // não fechou, sem precisar tentar de novo para descobrir.
        await db.signalReportSnapshot.update({
          where: { id: report.id },
          data: { blockedReason: reason },
        });
        throw new SignalStateConflictError(
          "report.sources.down",
          reason,
          blockers
        );
      }

      const pageCount = estimatePageCount(payload.initiatives);
      await db.signalReportSnapshot.update({
        where: { id: report.id },
        data: {
          state: "FINAL",
          payload,
          pageCount,
          blockedReason: null,
          generatedById: ctx.userId,
          generatedAt: new Date(),
        },
      });

      await logSignalAudit(db, ctx, {
        action: "Relatório congelado",
        entityType: "signal.report",
        entityId: report.id,
        target: `${report.code} · ${report.name}`,
        note: `${payload.initiatives.length} iniciativas, ${payload.caveats.length} ressalva(s).`,
        diff: [[FIELD_LABELS.state, "DRAFT", "FINAL"]],
      });

      return { code: report.code, pageCount };
    });

    revalidatePath("/signal/reports");
    return result;
  });
}

/**
 * Devolve o payload congelado, sempre.
 *
 * Nunca recompõe a partir das tabelas: exportar duas vezes o mesmo relatório
 * tem de dar o mesmo documento, mesmo que a fórmula tenha sido reversionada no
 * intervalo. Rascunho não exporta — exportar rascunho é distribuir um número
 * que ainda pode mudar sem que o leitor saiba.
 */
export async function exportReport(raw: {
  code: string;
}): Promise<SignalResult<ReportPayload>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const input = z.object({ code: nnStr }).parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const report = await db.signalReportSnapshot.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
      });
      if (!report) {
        throw new SignalRuleError(
          "report.not-found",
          `Relatório ${input.code} não encontrado nesta organização.`
        );
      }
      if (report.state !== "FINAL" || !report.payload) {
        throw new SignalRuleError(
          "report.not-frozen",
          `${report.code} ainda é rascunho. Congele antes de distribuir — um número que ainda pode mudar não deve sair da tela.`
        );
      }
      return report.payload as unknown as ReportPayload;
    });
  });
}

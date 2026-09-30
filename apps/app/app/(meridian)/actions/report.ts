"use server";

import type { MeridianAxis } from "@repo/database";
import { database, withTenantDb } from "@repo/database";
import { hasMeridianPermission } from "@repo/rbac";
import { MERIDIAN_EVIDENCE_BUCKET, storageClient } from "@repo/storage";
import { z } from "zod";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import {
  bandsFrom,
  type CohortRead,
  cohortKeyOf,
  readCohort,
} from "@/lib/meridian/benchmark";
import { isBenchmarkEnabled } from "@/lib/meridian/benchmark-enablement";
import { compositeOf, finalOf } from "@/lib/meridian/composite";
import { evidenceLabel } from "@/lib/meridian/evidence-label";
import { isEvidenceRetentionEliminated } from "@/lib/meridian/evidence-retention";
import {
  MeridianRuleError,
  requireMeridianContext,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";
import { cuid, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit } from "./_shared";

// Relatório, benchmark e diff de reavaliação — US5.

const EVIDENCE_URL_TTL_SECONDS = 300;

export type ReportAxis = {
  axis: MeridianAxis;
  label: string;
  score: number;
  computed: number;
  confidence: number;
  overridden: boolean;
  rationale: string | null;
};

export type Report = {
  assessmentCode: string;
  orgName: string;
  sector: string;
  templateVersion: string;
  composite: number | null;
  axes: ReportAxis[];
  /** `null` quando o tenant não tem a habilitação de benchmark (specs/012):
   *  o bloco some do relatório, sem coorte nem bandas. */
  cohort: CohortRead | null;
  topGaps: {
    code: string;
    statement: string;
    severity: string;
    costOfDelay: number;
  }[];
  trail: { when: string; what: string }[];
  isReassessment: boolean;
};

const ReportSchema = z.object({ assessmentId: cuid });

export async function getReport(
  raw: z.input<typeof ReportSchema>
): Promise<Result<Report>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("report.read");
    const input = ReportSchema.parse(raw);

    const base = await withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        include: {
          template: { select: { version: true } },
          scores: true,
          overrides: { orderBy: { createdAt: "desc" } },
          gaps: { orderBy: { costOfDelay: "desc" }, take: 3 },
        },
      });
      if (!a) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      const trail = await db.auditLog.findMany({
        where: {
          tenantId: ctx.tenantId,
          entityType: { startsWith: "meridian." },
          OR: [
            { entityId: a.id },
            { entityId: { in: a.overrides.map((o) => o.id) } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { createdAt: true, action: true, metadata: true },
      });
      const benchmarkEnabled = await isBenchmarkEnabled(db, ctx.tenantId);
      return { a, trail, benchmarkEnabled };
    });

    const { a, trail, benchmarkEnabled } = base;
    const latestOverride = new Map<MeridianAxis, string>();
    for (const o of a.overrides) {
      if (!latestOverride.has(o.axis)) {
        latestOverride.set(o.axis, o.rationale);
      }
    }

    const byAxis = new Map(a.scores.map((s) => [s.axis, s]));
    const axes: ReportAxis[] = AXIS_IDS.filter((x) => byAxis.has(x)).map(
      (x) => {
        const s = byAxis.get(x) as NonNullable<ReturnType<typeof byAxis.get>>;
        return {
          axis: x,
          label: AXES[x].label,
          score: finalOf(s),
          computed: s.computed,
          confidence: Number(s.confidence),
          // Override aparece marcado, não escondido: o relatório apresenta a
          // decisão do consultor como decisão, com a justificativa junto.
          overridden: s.status === "OVERRIDDEN",
          rationale: latestOverride.get(x) ?? null,
        };
      }
    );

    // Sem a habilitação de benchmark o tenant também não lê (specs/012): o
    // bloco some, e a coorte nem é consultada.
    let cohort: CohortRead | null = null;
    if (benchmarkEnabled) {
      const cohortKey = cohortKeyOf(a.sector, a.sizeBand);
      const cohortRow = await database.meridianBenchmarkCohort.findUnique({
        where: { cohortKey },
        select: { cohortKey: true, n: true, percentiles: true },
      });
      cohort = cohortRow
        ? readCohort({
            cohortKey: cohortRow.cohortKey,
            n: cohortRow.n,
            bands: bandsFrom(cohortRow.percentiles),
          })
        : { cohortKey, n: 0, withheld: true as const };
    }

    return {
      assessmentCode: a.code,
      orgName: a.orgName,
      sector: a.sector,
      templateVersion: a.template.version,
      composite: a.scores.length ? compositeOf(a.scores) : null,
      axes,
      cohort,
      topGaps: a.gaps.map((g) => ({
        code: g.code,
        statement: g.statement,
        severity: g.severity,
        costOfDelay: g.costOfDelay,
      })),
      trail: trail.map((t) => ({
        when: t.createdAt.toISOString(),
        what:
          (t.metadata as { target?: string } | null)?.target ??
          t.action.replace("meridian.", ""),
      })),
      isReassessment: a.reassessmentOfId !== null,
    };
  });
}

export type ReassessmentDiff = {
  previousCode: string;
  previousClosedAt: string | null;
  previousTemplateVersion: string;
  templateChanged: boolean;
  axes: {
    axis: MeridianAxis;
    label: string;
    was: number;
    now: number;
    delta: number;
  }[];
  resolved: { code: string; statement: string }[];
  persisting: string[];
  planDelta: { done: number; carried: number; created: number };
};

const DiffSchema = z.object({ assessmentId: cuid });

export async function getReassessmentDiff(
  raw: z.input<typeof DiffSchema>
): Promise<Result<ReassessmentDiff>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("report.read");
    const input = DiffSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        include: {
          scores: true,
          gaps: { select: { code: true, statement: true, state: true } },
          reassessmentOf: {
            include: {
              template: { select: { version: true } },
              scores: true,
              gaps: { select: { code: true, statement: true, state: true } },
              planItems: { select: { gapId: true } },
            },
          },
          template: { select: { version: true } },
        },
      });
      if (!a) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      const prev = a.reassessmentOf;
      if (!prev) {
        throw new MeridianRuleError(
          "report.no-previous",
          "Este assessment não é reavaliação — o diff nasce no re-assessment."
        );
      }

      const prevByAxis = new Map(prev.scores.map((s) => [s.axis, finalOf(s)]));
      const nowByAxis = new Map(a.scores.map((s) => [s.axis, finalOf(s)]));
      const axes = AXIS_IDS.filter(
        (x) => prevByAxis.has(x) && nowByAxis.has(x)
      ).map((x) => {
        const was = prevByAxis.get(x) as number;
        const now = nowByAxis.get(x) as number;
        return { axis: x, label: AXES[x].label, was, now, delta: now - was };
      });

      const nowStatements = new Set(a.gaps.map((g) => g.statement));
      const resolved = prev.gaps
        .filter(
          (g) => g.state === "RESOLVED" || !nowStatements.has(g.statement)
        )
        .map((g) => ({ code: g.code, statement: g.statement }));
      const persisting = prev.gaps
        .filter((g) => nowStatements.has(g.statement))
        .map((g) => g.code);

      return {
        previousCode: prev.code,
        previousClosedAt: prev.closedAt?.toISOString() ?? null,
        previousTemplateVersion: prev.template.version,
        templateChanged: prev.template.version !== a.template.version,
        axes,
        resolved,
        persisting,
        planDelta: {
          done: resolved.length,
          carried: persisting.length,
          created: a.gaps.filter(
            (g) => !prev.gaps.some((p) => p.statement === g.statement)
          ).length,
        },
      };
    });
  });
}

const EvidenceSchema = z.object({ evidenceId: cuid });

export type EvidenceItem = {
  id: string;
  label: string;
  /** Objeto já eliminado pela retenção: a tela não oferece abrir. */
  eliminated: boolean;
};

const EvidenceListSchema = z.object({ assessmentId: cuid });

/**
 * Evidências do assessment inteiro, para Coleta e para o gap (mesmo escopo do
 * "N anexos" que já existia). Quem não tem `evidence.read` recebe só o total:
 * sem id nem nome de arquivo, a tela não tem o que mostrar. Listar não grava
 * trilha; a leitura do arquivo (`requestEvidenceUrl`) grava.
 */
export async function listAssessmentEvidence(
  raw: z.input<typeof EvidenceListSchema>
): Promise<Result<{ total: number; items: EvidenceItem[] }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    const input = EvidenceListSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!a) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      const rows = await db.meridianEvidence.findMany({
        where: { tenantId: ctx.tenantId, assessmentId: a.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, storagePath: true },
      });
      const canRead = hasMeridianPermission(ctx.meridianRole, "evidence.read");
      return {
        total: rows.length,
        items: canRead
          ? rows.map(
              (e): EvidenceItem => ({
                id: e.id,
                label: evidenceLabel(e),
                eliminated: isEvidenceRetentionEliminated(e.storagePath),
              })
            )
          : [],
      };
    });
  });
}

/**
 * URL assinada de curta duração para baixar uma evidência.
 *
 * A trilha é gravada **antes** de emitir a URL. Auditoria de acesso concedido,
 * não de byte entregue: se o download não completar, o acesso ainda aconteceu.
 */
export async function requestEvidenceUrl(
  raw: z.input<typeof EvidenceSchema>
): Promise<Result<{ url: string; expiresIn: number }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("evidence.read");
    const input = EvidenceSchema.parse(raw);

    const evidence = await withTenantDb(ctx.tenantId, async (db) => {
      const e = await db.meridianEvidence.findFirst({
        where: { id: input.evidenceId, tenantId: ctx.tenantId },
        include: { assessment: { select: { code: true } } },
      });
      if (!e) {
        throw new MeridianRuleError(
          "evidence.not-found",
          "Evidência não encontrada nesta organização."
        );
      }
      // Objeto eliminado pela retenção de 90 dias (evidence-retention.ts) —
      // checa ANTES do audit: sem isso, a linha gravada dizia "URL assinada
      // emitida para download" pra uma evidência que não existe mais.
      if (isEvidenceRetentionEliminated(e.storagePath)) {
        throw new MeridianRuleError(
          "evidence.retention-eliminated",
          "Evidência eliminada pela política de retenção (90 dias após o fechamento do assessment)."
        );
      }
      // Alvo pelo id, não pelo fileName: fileName pode conter dado pessoal
      // (nome do titular no arquivo), e o audit é log de vida longa — cada
      // download duplicaria esse dado ali, sobrevivendo à retenção e ao DSAR.
      await logMeridianAudit(db, ctx, {
        action: "meridian.evidence.read",
        entityType: "meridian.evidence",
        entityId: e.id,
        target: `${e.assessment.code} · ${e.id}`,
        note: "URL assinada emitida para download.",
      });
      return e;
    });

    const { data, error } = await storageClient.storage
      .from(MERIDIAN_EVIDENCE_BUCKET)
      .createSignedUrl(evidence.storagePath, EVIDENCE_URL_TTL_SECONDS);
    if (error || !data) {
      throw new Error(
        `Falha ao emitir URL de evidência: ${error?.message ?? "sem resposta"}`
      );
    }
    return { url: data.signedUrl, expiresIn: EVIDENCE_URL_TTL_SECONDS };
  });
}

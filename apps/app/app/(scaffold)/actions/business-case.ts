"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import {
  businessCaseHash,
  type SignablePayload,
} from "@/lib/scaffold/business-case-hash";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import {
  BusinessCaseIdSchema,
  ContestBusinessCaseSchema,
  NewVersionSchema,
  SaveDraftSchema,
  SignBusinessCaseSchema,
} from "@/lib/scaffold/schemas";
import { type Db, logScaffoldAudit } from "./_shared";

// O caso de negócio — S-06, SG-04.
//
// O Scaffold é a FONTE DA VERDADE: emite o artefato assinado, imutável e
// versionado; o Signal apura contra ele por meses e nunca o edita.
//
// Duas invariantes carregam o arquivo:
//
//   1. ASSINADO É IMUTÁVEL. Nenhuma escrita toca uma versão fora de DRAFT.
//      Alterar cria versão nova, e a assinada permanece intacta e legível.
//   2. `signedVersionId` SÓ MUDA EM `signBusinessCase`. É o campo que SG-04 lê
//      para destravar a Fase 1; se outra action pudesse escrevê-lo, a trava
//      teria mais de uma chave.

/** Carrega o caso com a versão em edição e o track, numa consulta. */
async function loadCase(db: Db, tenantId: string, businessCaseId: string) {
  const bc = await db.scaffoldBusinessCase.findFirst({
    where: { id: businessCaseId, tenantId },
    include: {
      track: { select: { code: true, processName: true } },
      versions: {
        orderBy: { authoredAt: "desc" },
        select: { id: true, label: true, state: true, contentHash: true },
      },
    },
  });
  if (!bc) {
    throw new ScaffoldRuleError("NOT_SIGNED");
  }
  return bc;
}

async function loadVersion(db: Db, tenantId: string, versionId: string) {
  const v = await db.scaffoldBusinessCaseVersion.findFirst({
    where: { id: versionId, tenantId },
    include: {
      metrics: {
        orderBy: { key: "asc" },
        select: {
          key: true,
          label: true,
          unit: true,
          baseValue: true,
          targetValue: true,
          direction: true,
          confidence: true,
          sourceLabel: true,
          sampleLabel: true,
        },
      },
    },
  });
  if (!v) {
    throw new ScaffoldRuleError("NOT_SIGNED");
  }
  return v;
}

/** Próximo rótulo a partir do anterior: v3 → v4. Rótulo é do artefato, não do
 *  banco — o patrocinador assina "a v4", e um cuid não serve para conversar. */
function nextLabel(previous: string): string {
  const n = Number.parseInt(previous.replace(/\D/g, ""), 10);
  return `v${Number.isFinite(n) ? n + 1 : 1}`;
}

// ── Rascunho ──────────────────────────────────────────────────────────────────

/**
 * Edita a versão em rascunho.
 *
 * As métricas são substituídas EM BLOCO, não uma a uma: editar
 * incrementalmente abriria uma janela em que a versão tem metade das métricas
 * velhas e metade das novas, e alguém poderia assinar exatamente aí.
 */
export async function saveDraft(
  raw: z.input<typeof SaveDraftSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("businesscase.write");
    const input = SaveDraftSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const bc = await loadCase(db, ctx.tenantId, input.businessCaseId);
      if (!bc.currentVersionId) {
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }
      const version = await loadVersion(db, ctx.tenantId, bc.currentVersionId);
      if (version.state !== "DRAFT") {
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }

      await db.scaffoldBusinessCaseMetric.deleteMany({
        where: { versionId: version.id },
      });
      if (input.metrics.length > 0) {
        await db.scaffoldBusinessCaseMetric.createMany({
          data: input.metrics.map((m) => ({
            tenantId: ctx.tenantId,
            versionId: version.id,
            key: m.key,
            label: m.label,
            unit: m.unit,
            baseValue: m.baseValue,
            targetValue: m.targetValue,
            direction: m.direction,
            confidence: m.confidence,
            sourceLabel: m.sourceLabel,
            sampleLabel: m.sampleLabel,
          })),
        });
      }

      await db.scaffoldBusinessCase.update({
        where: { id: bc.id },
        data: {
          windowMonths: input.windowMonths,
          cadence: input.cadence,
          windowStart: input.windowStart ?? null,
          benefitKind: input.benefitKind,
          benefitHard: input.benefitHard,
          benefitAnnualCents:
            input.benefitAnnualCents == null
              ? null
              : BigInt(input.benefitAnnualCents),
          benefitBasis: input.benefitBasis,
        },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.businesscase.save-draft",
        entityType: "scaffold.businesscase",
        entityId: bc.id,
        target: `${bc.code} · ${version.label}`,
        note: `${input.metrics.length} métrica(s).`,
      });
    });

    revalidatePath("/scaffold");
  });
}

/** Congela a versão em AWAITING e a envia ao patrocinador. */
export async function submitForSignature(
  raw: z.input<typeof BusinessCaseIdSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("businesscase.write");
    const input = BusinessCaseIdSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const bc = await loadCase(db, ctx.tenantId, input.businessCaseId);
      if (!bc.currentVersionId) {
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }
      const version = await loadVersion(db, ctx.tenantId, bc.currentVersionId);
      if (version.state !== "DRAFT") {
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }
      // Promessa vazia não se assina, e o patrocinador que recebesse um
      // artefato sem métrica não teria como recusar sem parecer difícil.
      if (version.metrics.length === 0) {
        throw new ScaffoldRuleError("BASELINE_NOT_SIGNED");
      }

      await db.scaffoldBusinessCaseVersion.update({
        where: { id: version.id },
        data: { state: "AWAITING" },
      });
      await db.scaffoldBusinessCase.update({
        where: { id: bc.id },
        data: { state: "AWAITING" },
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.businesscase.submit",
        entityType: "scaffold.businesscase",
        entityId: bc.id,
        target: `${bc.code} · ${version.label}`,
        diff: [["Estado", version.state, "AWAITING"]],
      });
    });

    revalidatePath("/scaffold");
  });
}

// ── Assinatura ────────────────────────────────────────────────────────────────

/**
 * Assina a versão. ÚNICA action que escreve `signedVersionId`.
 *
 * O `contentHash` é calculado aqui e nunca recalculado: ele é a prova de que os
 * números contra os quais o Signal apura são os que o patrocinador aprovou.
 *
 * `signedByLabel` é o nome digitado na superfície de assinatura. O patrocinador
 * do cliente pode não ter conta na plataforma — o Scaffold registra o ATO, e a
 * identidade é problema do Charter.
 */
export async function signBusinessCase(
  raw: z.input<typeof SignBusinessCaseSchema>
): Promise<ScaffoldResult<{ contentHash: string }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("businesscase.sign");
    const input = SignBusinessCaseSchema.parse(raw);

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const version = await loadVersion(db, ctx.tenantId, input.versionId);
      if (version.state !== "AWAITING") {
        // Rascunho não foi enviado; contestada tem objeção aberta. Nos dois
        // casos, assinar pularia a conversa que a assinatura deveria encerrar.
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }
      const bc = await loadCase(db, ctx.tenantId, input.businessCaseId);

      const payload: SignablePayload = {
        businessCaseCode: bc.code,
        versionLabel: version.label,
        window: {
          start: bc.windowStart?.toISOString().slice(0, 10) ?? "",
          months: bc.windowMonths ?? 0,
          cadence: bc.cadence ?? "monthly",
        },
        benefit: {
          kind: bc.benefitKind,
          hard: bc.benefitHard,
          annualCents:
            bc.benefitAnnualCents == null
              ? null
              : Number(bc.benefitAnnualCents),
          basis: bc.benefitBasis,
        },
        metrics: version.metrics.map((m) => ({
          key: m.key,
          unit: m.unit,
          baseValue: m.baseValue.toString(),
          targetValue: m.targetValue.toString(),
          direction: m.direction,
          confidence: m.confidence,
        })),
      };
      const contentHash = businessCaseHash(payload);
      const now = new Date();

      // Versão anterior vira SUPERSEDED. Não some: continua legível, e é o que
      // permite mostrar por que a meta mudou entre a v1 e a v2.
      if (bc.signedVersionId && bc.signedVersionId !== version.id) {
        await db.scaffoldBusinessCaseVersion.updateMany({
          where: { id: bc.signedVersionId },
          data: { state: "SUPERSEDED" },
        });
      }

      await db.scaffoldBusinessCaseVersion.update({
        where: { id: version.id },
        data: {
          state: "SIGNED",
          signedById: ctx.userId,
          signedByLabel: input.signedByLabel,
          signedAt: now,
          contentHash,
        },
      });

      await db.scaffoldBusinessCase.update({
        where: { id: bc.id },
        data: {
          state: "SIGNED",
          signedVersionId: version.id,
          // A janela começa na assinatura: antes dela não há promessa contra a
          // qual medir.
          windowStart: bc.windowStart ?? now,
        },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.businesscase.sign",
        entityType: "scaffold.businesscase",
        entityId: bc.id,
        target: `${bc.code} · ${version.label}`,
        note: `Assinado por ${input.signedByLabel}. ref ${contentHash}.`,
        diff: [["Estado", version.state, "SIGNED"]],
      });

      return { contentHash };
    });

    revalidatePath("/scaffold");
    return out;
  });
}

/**
 * Registra a objeção do patrocinador — ramo de AWAITING, não fim de linha.
 *
 * A objeção fica registrada mesmo depois de resolvida: ela é a razão pela qual
 * a versão seguinte tem os números que tem, e apagá-la apagaria o porquê.
 */
export async function contestBusinessCase(
  raw: z.input<typeof ContestBusinessCaseSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("businesscase.sign");
    const input = ContestBusinessCaseSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const version = await loadVersion(db, ctx.tenantId, input.versionId);
      if (version.state !== "AWAITING") {
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }
      const bc = await loadCase(db, ctx.tenantId, input.businessCaseId);

      await db.scaffoldBusinessCaseContest.create({
        data: {
          tenantId: ctx.tenantId,
          businessCaseId: bc.id,
          versionId: version.id,
          byId: ctx.userId,
          byLabel: input.byLabel,
          roleLabel: input.roleLabel,
          objection: input.objection,
          asks: input.asks,
        },
      });
      await db.scaffoldBusinessCaseVersion.update({
        where: { id: version.id },
        data: { state: "CONTESTED" },
      });
      await db.scaffoldBusinessCase.update({
        where: { id: bc.id },
        data: { state: "CONTESTED" },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.businesscase.contest",
        entityType: "scaffold.businesscase",
        entityId: bc.id,
        target: `${bc.code} · ${version.label}`,
        note: input.objection,
        diff: [["Estado", version.state, "CONTESTED"]],
      });
    });

    revalidatePath("/scaffold");
  });
}

/**
 * Abre uma versão nova a partir da vigente, clonando as métricas.
 *
 * NÃO toca em `signedVersionId`. É o que faz o painel dizer "v2 vigente · v3 em
 * edição": o Signal continua apurando contra a assinada até que a nova seja
 * assinada também. Se a nova já valesse, a apuração passaria a correr contra um
 * rascunho que ninguém aprovou.
 *
 * Serve aos dois caminhos de reabertura — depois de objeção e depois de
 * assinatura. É a mesma transição, e duplicá-la daria duas chances de esquecer
 * de preservar a anterior.
 */
export async function newVersionFromSigned(
  raw: z.input<typeof NewVersionSchema>
): Promise<ScaffoldResult<{ versionId: string; label: string }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("businesscase.write");
    const input = NewVersionSchema.parse(raw);

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const bc = await loadCase(db, ctx.tenantId, input.businessCaseId);
      const sourceId = bc.signedVersionId ?? bc.currentVersionId;
      if (!sourceId) {
        throw new ScaffoldRuleError("NOT_SIGNED");
      }
      const source = await loadVersion(db, ctx.tenantId, sourceId);
      if (source.state === "DRAFT") {
        // Já existe rascunho aberto: abrir outro criaria duas versões em edição
        // e ninguém saberia qual vai para a assinatura.
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }

      const created = await db.scaffoldBusinessCaseVersion.create({
        data: {
          tenantId: ctx.tenantId,
          businessCaseId: bc.id,
          label: nextLabel(source.label),
          state: "DRAFT",
          note: input.note,
          authoredById: ctx.userId,
        },
        select: { id: true, label: true },
      });

      if (source.metrics.length > 0) {
        await db.scaffoldBusinessCaseMetric.createMany({
          data: source.metrics.map((m) => ({
            tenantId: ctx.tenantId,
            versionId: created.id,
            key: m.key,
            label: m.label,
            unit: m.unit,
            baseValue: m.baseValue,
            targetValue: m.targetValue,
            direction: m.direction,
            confidence: m.confidence,
            sourceLabel: m.sourceLabel,
            sampleLabel: m.sampleLabel,
          })),
        });
      }

      await db.scaffoldBusinessCase.update({
        where: { id: bc.id },
        data: {
          // `signedVersionId` fica de fora, de propósito. Ver o comentário.
          currentVersionId: created.id,
          state: "DRAFT",
        },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.businesscase.new-version",
        entityType: "scaffold.businesscase",
        entityId: bc.id,
        target: `${bc.code} · ${created.label}`,
        note: input.note,
        diff: [["Versão em edição", source.label, created.label]],
      });

      return created;
    });

    revalidatePath("/scaffold");
    return { versionId: out.id, label: out.label };
  });
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export type BusinessCaseRow = {
  id: string;
  code: string;
  state: string;
  trackCode: string;
  processName: string;
  versionLabel: string;
  sponsorLabel: string | null;
  windowMonths: number | null;
  signedAt: Date | null;
};

export type BusinessCaseListing = {
  rows: BusinessCaseRow[];
  signedCount: number;
  pendingCount: number;
  draftCount: number;
  /** Trilhas sem caso de negócio nenhum. O Signal não tem o que medir nelas —
   *  e é o número que o protótipo pinta de vermelho. */
  tracksWithoutPromise: number;
};

export async function listBusinessCases(): Promise<
  ScaffoldResult<BusinessCaseListing>
> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("portfolio.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const [cases, tracksTotal] = await Promise.all([
        db.scaffoldBusinessCase.findMany({
          where: { tenantId: ctx.tenantId },
          orderBy: { updatedAt: "desc" },
          include: {
            track: { select: { code: true, processName: true } },
            versions: {
              orderBy: { authoredAt: "desc" },
              take: 1,
              select: { label: true, signedAt: true, signedByLabel: true },
            },
          },
        }),
        db.scaffoldTrack.count({
          where: {
            tenantId: ctx.tenantId,
            status: { in: ["ACTIVE", "STALLED"] },
          },
        }),
      ]);

      const rows = cases.map((c): BusinessCaseRow => {
        const v = c.versions[0];
        return {
          id: c.id,
          code: c.code,
          state: c.state,
          trackCode: c.track.code,
          processName: c.track.processName,
          versionLabel: v?.label ?? "—",
          sponsorLabel: v?.signedByLabel ?? null,
          windowMonths: c.windowMonths,
          signedAt: v?.signedAt ?? null,
        };
      });

      const count = (s: string) => rows.filter((r) => r.state === s).length;
      return {
        rows,
        signedCount: count("SIGNED"),
        pendingCount: count("AWAITING") + count("CONTESTED"),
        draftCount: count("DRAFT"),
        tracksWithoutPromise: Math.max(0, tracksTotal - rows.length),
      };
    });
  });
}

export type BusinessCaseDetail = {
  id: string;
  code: string;
  state: string;
  trackId: string;
  trackCode: string;
  processName: string;
  currentVersionId: string | null;
  signedVersionId: string | null;
  windowStart: Date | null;
  windowMonths: number | null;
  cadence: string | null;
  benefitKind: string;
  benefitHard: boolean;
  benefitAnnualCents: number | null;
  benefitBasis: string;
  financeReviewedAt: Date | null;
  signalInitiativeRef: string | null;
  versions: {
    id: string;
    label: string;
    state: string;
    note: string;
    authoredAt: Date;
    signedAt: Date | null;
    signedByLabel: string | null;
    contentHash: string | null;
  }[];
  metrics: {
    key: string;
    label: string;
    unit: string;
    baseValue: string;
    targetValue: string;
    direction: string;
    confidence: string;
    sourceLabel: string;
    sampleLabel: string;
  }[];
  openContest: {
    byLabel: string;
    roleLabel: string;
    objection: string;
    asks: string;
    createdAt: Date;
  } | null;
};

export async function getBusinessCase(
  raw: z.input<typeof BusinessCaseIdSchema>
): Promise<ScaffoldResult<BusinessCaseDetail>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("portfolio.read");
    const input = BusinessCaseIdSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const bc = await db.scaffoldBusinessCase.findFirst({
        where: { id: input.businessCaseId, tenantId: ctx.tenantId },
        include: {
          track: { select: { id: true, code: true, processName: true } },
          versions: {
            orderBy: { authoredAt: "desc" },
            select: {
              id: true,
              label: true,
              state: true,
              note: true,
              authoredAt: true,
              signedAt: true,
              signedByLabel: true,
              contentHash: true,
            },
          },
          contests: {
            where: { resolvedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      if (!bc) {
        throw new ScaffoldRuleError("NOT_SIGNED");
      }

      // Métricas da versão EM EDIÇÃO. Não da assinada: o editor precisa mostrar
      // o que está sendo alterado, e o painel do Signal mostra qual versão está
      // vigente — as duas informações convivem porque são colunas separadas.
      const versionId = bc.currentVersionId ?? bc.versions[0]?.id;
      const metrics = versionId
        ? await db.scaffoldBusinessCaseMetric.findMany({
            where: { versionId },
            orderBy: { key: "asc" },
          })
        : [];

      const contest = bc.contests[0];
      return {
        id: bc.id,
        code: bc.code,
        state: bc.state,
        trackId: bc.track.id,
        trackCode: bc.track.code,
        processName: bc.track.processName,
        currentVersionId: bc.currentVersionId,
        signedVersionId: bc.signedVersionId,
        windowStart: bc.windowStart,
        windowMonths: bc.windowMonths,
        cadence: bc.cadence,
        benefitKind: bc.benefitKind,
        benefitHard: bc.benefitHard,
        benefitAnnualCents:
          bc.benefitAnnualCents == null ? null : Number(bc.benefitAnnualCents),
        benefitBasis: bc.benefitBasis,
        financeReviewedAt: bc.financeReviewedAt,
        signalInitiativeRef: bc.signalInitiativeRef,
        versions: bc.versions,
        metrics: metrics.map((m) => ({
          key: m.key,
          label: m.label,
          unit: m.unit,
          baseValue: m.baseValue.toString(),
          targetValue: m.targetValue.toString(),
          direction: m.direction,
          confidence: m.confidence,
          sourceLabel: m.sourceLabel,
          sampleLabel: m.sampleLabel,
        })),
        openContest: contest
          ? {
              byLabel: contest.byLabel,
              roleLabel: contest.roleLabel,
              objection: contest.objection,
              asks: contest.asks,
              createdAt: contest.createdAt,
            }
          : null,
      };
    });
  });
}

"use server";

import {
  type MemberRole,
  requireRole,
  requireTenantSession,
} from "@repo/auth/server";
import { database, Prisma } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { err, ok, type Result } from "../_base";
import { logAudit } from "../audit/log-audit";

// Consentimento de gravação — docs/compliance/consentimento-de-gravacao.md
// §7, passos 3-4. Mesmo padrão do Meridian (MeridianAssessment.benchmarkOptIn,
// ver (meridian)/actions/benchmark.ts): a porta é o consentimento, e liberar
// uma transcrição PENDING precisa produzir efeito de verdade — enfileirar o
// mapeador — senão o consentimento concedido não vale nada.

// Não exportado: arquivos "use server" só podem exportar função async (Next.js
// restringe o resto). listConsentQueue usa a mesma constante para computar
// podeAgir/quemPode — mesma fonte que os requireRole() abaixo usam para o
// gate de verdade, só que dentro deste módulo.
const ADMIN_ROLES = ["ADMIN", "STE", "RTE"] as MemberRole[];
const ADMIN_ROLES_LABEL = "ADMIN, STE ou RTE";

const TranscriptIdSchema = z.object({ transcriptId: z.string().min(1) });

export type ConsentTranscriptRow = {
  id: string;
  consentState: string;
};

/**
 * Libera uma transcrição PENDING. Só a partir de PENDING — GRANTED, DENIED e
 * REVOKED já são estados terminais/derivados de uma decisão anterior.
 * Enfileira o mapeador de IA na sequência: liberar sem enfileirar seria
 * consentimento sem efeito, o mesmo erro que o Meridian já resolveu para
 * revogação (ver withdrawContribution) — aqui é o espelho, na concessão.
 */
export async function grantConsent(
  raw: unknown
): Promise<Result<ConsentTranscriptRow>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(ADMIN_ROLES, ctx);
    const { transcriptId } = TranscriptIdSchema.parse(raw);

    const transcript = await database.meetingTranscript.findFirst({
      where: { id: transcriptId, tenantId: ctx.tenantId },
      select: { id: true, consentState: true },
    });
    if (!transcript) {
      return err("Transcrição não encontrada");
    }
    if (transcript.consentState !== "PENDING") {
      return err(
        `Transcrição não está pendente (estado atual: ${transcript.consentState})`
      );
    }

    await database.meetingTranscript.update({
      where: { id: transcript.id },
      data: {
        consentState: "GRANTED",
        consentGrantedBy: ctx.userId,
        consentGrantedAt: new Date(),
      },
    });

    // O efeito: sem isto, liberar não muda nada além do rótulo.
    await inngest.send({
      name: "integration/fireflies.transcript.ready",
      data: { tenantId: ctx.tenantId, transcriptId: transcript.id },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "consent_granted",
      entityType: "MEETING_TRANSCRIPT",
      entityId: transcript.id,
      diff: { consentState: { from: "PENDING", to: "GRANTED" } },
    });

    return ok({ id: transcript.id, consentState: "GRANTED" });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Erro ao liberar consentimento"
    );
  }
}

/** Nega uma transcrição PENDING. O mapeador nunca roda para ela. */
export async function denyConsent(
  raw: unknown
): Promise<Result<ConsentTranscriptRow>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(ADMIN_ROLES, ctx);
    const { transcriptId } = TranscriptIdSchema.parse(raw);

    const transcript = await database.meetingTranscript.findFirst({
      where: { id: transcriptId, tenantId: ctx.tenantId },
      select: { id: true, consentState: true },
    });
    if (!transcript) {
      return err("Transcrição não encontrada");
    }
    if (transcript.consentState !== "PENDING") {
      return err(
        `Transcrição não está pendente (estado atual: ${transcript.consentState})`
      );
    }

    await database.meetingTranscript.update({
      where: { id: transcript.id },
      data: { consentState: "DENIED" },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "consent_denied",
      entityType: "MEETING_TRANSCRIPT",
      entityId: transcript.id,
      diff: { consentState: { from: "PENDING", to: "DENIED" } },
    });

    return ok({ id: transcript.id, consentState: "DENIED" });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao negar consentimento");
  }
}

/**
 * Revoga uma transcrição GRANTED, com efeito material
 * (docs/compliance/consentimento-de-gravacao.md §4, nível 3):
 *
 * - Apaga os MeetingInsight ainda PENDING/DISMISSED — são rascunho de IA que
 *   nunca virou dado do produto; apagar é a revogação em si.
 * - MeetingInsight já APPLIED (appliedEntityId preenchido) é tratado
 *   diferente, de propósito: a entidade de domínio que ele gerou (Risk,
 *   Impediment, DecisionLog) já é dado real do cliente, criada por decisão
 *   humana em applyInsight, e não tem FK de volta para este MeetingInsight —
 *   apagar a linha aqui não a tocaria, mas apagar a linha *apagaria a prova*
 *   de que aquela entidade veio de uma reunião cujo consentimento foi
 *   revogado, o que é o tipo de coisa que uma auditoria futura precisa achar.
 *   Por isso a linha fica, com status e appliedEntityId intactos, mas com o
 *   `text` (o conteúdo derivado da fala) redigido — o mesmo tratamento que
 *   `rawSummary` recebe na transcrição: apaga o conteúdo, preserva o
 *   registro. A entidade de domínio em si (Risk/Impediment/DecisionLog)
 *   nunca é tocada — revogar consentimento de gravação não desfaz uma
 *   decisão de produto já tomada por um humano.
 * - `rawSummary` da transcrição é zerado; a linha de MeetingTranscript
 *   permanece, como registro de que a reunião existiu e foi revogada.
 */
export async function revokeConsent(
  raw: unknown
): Promise<Result<ConsentTranscriptRow>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(ADMIN_ROLES, ctx);
    const { transcriptId } = TranscriptIdSchema.parse(raw);

    const transcript = await database.meetingTranscript.findFirst({
      where: { id: transcriptId, tenantId: ctx.tenantId },
      select: { id: true, consentState: true },
    });
    if (!transcript) {
      return err("Transcrição não encontrada");
    }
    if (transcript.consentState !== "GRANTED") {
      return err(
        `Só é possível revogar consentimento concedido (estado atual: ${transcript.consentState})`
      );
    }

    await database.$transaction(async (tx) => {
      await tx.meetingInsight.deleteMany({
        where: {
          transcriptId: transcript.id,
          tenantId: ctx.tenantId,
          status: { in: ["PENDING", "DISMISSED"] },
        },
      });

      await tx.meetingInsight.updateMany({
        where: {
          transcriptId: transcript.id,
          tenantId: ctx.tenantId,
          status: "APPLIED",
        },
        data: { text: "[conteúdo removido — consentimento revogado]" },
      });

      await tx.meetingTranscript.update({
        where: { id: transcript.id },
        data: { rawSummary: Prisma.DbNull, consentState: "REVOKED" },
      });
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "consent_revoked",
      entityType: "MEETING_TRANSCRIPT",
      entityId: transcript.id,
      diff: { consentState: { from: "GRANTED", to: "REVOKED" } },
    });

    return ok({ id: transcript.id, consentState: "REVOKED" });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Erro ao revogar consentimento"
    );
  }
}

// ─── Leitura da fila (docs/compliance/consentimento-de-gravacao.md §7,
// passo 5) ──────────────────────────────────────────────────────────────

// PENDING primeiro: é o que trava o pipeline de IA e é a fila que alguém
// precisa esvaziar. Os demais estados são histórico, na ordem em que uma
// auditoria olharia (concedido, depois as duas formas de "não segue").
const CONSENT_STATE_ORDER: Record<string, number> = {
  PENDING: 0,
  GRANTED: 1,
  DENIED: 2,
  REVOKED: 3,
};

export type ConsentQueueRow = {
  id: string;
  title: string | null;
  createdAt: Date;
  consentState: string; // PENDING | GRANTED | DENIED | REVOKED
  consentMode: string; // PER_MEETING | STANDING — da integração, não da transcrição
  /** Só relevante quando consentMode === "STANDING": a declaração que sustenta a liberação automática. */
  standingConsentRef: string | null;
  /** Quem clicou liberar, sob PER_MEETING. Null sob liberação automática (STANDING) ou fora de GRANTED. */
  grantedByName: string | null;
  /** A declaração vigente carimbada na liberação automática, sob STANDING. Mutuamente exclusivo com grantedByName — ver comentário do schema em consentGrantedRef. */
  grantedByRef: string | null;
  grantedAt: Date | null;
  /** MeetingInsight (qualquer status) derivados desta transcrição. */
  insightCount: number;
};

export type ConsentQueueView = {
  rows: ConsentQueueRow[];
  /** O papel de quem está olhando pode liberar/negar/revogar? Mesmo cálculo
   *  que requireRole(ADMIN_ROLES) faria — aqui só para desenhar a tela, o
   *  gate de verdade continua em cada mutação. */
  podeAgir: boolean;
  /** Legível, para quem não pode agir: "ADMIN, STE ou RTE". */
  quemPode: string;
};

/**
 * Fila de transcrições para a tela de consentimento — tenant-scoped, sem
 * exigir papel administrativo: qualquer membro pode ver o que está
 * pendente e o histórico; só a mutação (grant/deny/revoke) exige
 * ADMIN_ROLES. `podeAgir` deixa a tela desenhar os botões certos sem que
 * quem não tem o papel veja um botão que vai falhar.
 */
export async function listConsentQueue(): Promise<Result<ConsentQueueView>> {
  try {
    const ctx = await requireTenantSession(await headers());

    const transcripts = await database.meetingTranscript.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        consentState: true,
        consentGrantedBy: true,
        consentGrantedRef: true,
        consentGrantedAt: true,
        integration: {
          select: { consentMode: true, standingConsentRef: true },
        },
        _count: { select: { insights: true } },
      },
    });

    // AuditLog/MeetingTranscript só guardam userId; o nome vem de uma
    // consulta em lote, e só roda quando alguma linha tem consentGrantedBy
    // (liberação manual houve) — uma fila só de PENDING ou só STANDING não
    // dispara consulta nenhuma.
    const grantedByIds = [
      ...new Set(
        transcripts
          .map((t) => t.consentGrantedBy)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const nameById = grantedByIds.length
      ? new Map(
          (
            await database.user.findMany({
              where: { id: { in: grantedByIds } },
              select: { id: true, name: true },
            })
          ).map((u) => [u.id, u.name] as const)
        )
      : new Map<string, string | null>();

    const rows = transcripts
      .map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt,
        consentState: t.consentState,
        consentMode: t.integration.consentMode,
        standingConsentRef: t.integration.standingConsentRef,
        grantedByName:
          (t.consentGrantedBy && nameById.get(t.consentGrantedBy)) || null,
        grantedByRef: t.consentGrantedRef,
        grantedAt: t.consentGrantedAt,
        insightCount: t._count.insights,
      }))
      // Array.prototype.sort é estável — a ordenação por createdAt desc já
      // vinda do banco é preservada dentro de cada grupo de estado.
      .sort(
        (a, b) =>
          (CONSENT_STATE_ORDER[a.consentState] ?? 99) -
          (CONSENT_STATE_ORDER[b.consentState] ?? 99)
      );

    return ok({
      rows,
      podeAgir: ADMIN_ROLES.includes(ctx.role),
      quemPode: ADMIN_ROLES_LABEL,
    });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Erro ao listar fila de consentimento"
    );
  }
}

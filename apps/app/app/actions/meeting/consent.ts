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

const ADMIN_ROLES = ["ADMIN", "STE", "RTE"] as MemberRole[];

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

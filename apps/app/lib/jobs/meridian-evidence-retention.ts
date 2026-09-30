import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { deleteObjects, MERIDIAN_EVIDENCE_BUCKET } from "@repo/storage";
import {
  EVIDENCE_RETENTION_ELIMINATED_MARKER,
  evidenceRetentionCutoff,
} from "@/lib/meridian/evidence-retention";

// Retenção de evidência do respondente — decisão do CEO, 2026-09-28
// (docs/qualidade/dogfood/meridian/atrito.md:60, parecer de compliance
// condição 3): o objeto no bucket `meridian-evidence` some 90 dias depois do
// fechamento do assessment (`closedAt`). O registro em `MeridianEvidence`
// continua — a trilha de auditoria não é apagada, mesma lógica de
// `lgpd-dsr.ts` (que anonimiza em vez de apagar) — só `storagePath` vira o
// marcador, pra `requestEvidenceUrl` (`report.ts`) recusar em vez de emitir
// URL assinada pra objeto que já não existe.
//
// Roda pelo Vercel Cron (`/api/cron/meridian-evidence-retention`, ADR-0021
// fase 1) — antes era uma função Inngest.
//
// Idempotente entre execuções: cada uma consulta de novo por `storagePath`
// ainda não marcado, então evidência já processada não volta a aparecer.
// Idempotente dentro de um retry parcial: delete do objeto, `updateMany` pro
// marcador e audit com `id` estável repetem sem efeito colateral. Cada
// assessment é isolado: falha num não impede os demais, e o que falhou
// continua sem marcador, então entra de novo na próxima execução.
//
// Nunca mistura tenant: `assessmentId` pertence a um único tenant, e cada
// lote de `deleteObjects`/`updateMany`/`auditLog` fica inteiro dentro dele.

type PendingEvidence = {
  id: string;
  tenantId: string;
  assessmentId: string;
  storagePath: string;
  fileName: string;
};

// Teto por execução: `orderBy: id` garante progresso determinístico — o que
// sobrar desta janela fica pro dia seguinte, não se perde (o filtro por
// `storagePath` continua achando o que falta).
const MAX_EVIDENCE_PER_RUN = 500;

export type EvidenceRetentionResult = {
  eliminated: number;
  assessments: number;
  failed: number;
};

// Devolve quantas linhas ESTA execução marcou. O `updateMany` só casa o que
// ainda não tem o marcador: se outra execução simultânea chegou antes, a
// contagem é 0 (delete e audit são idempotentes) e a métrica não superconta.
async function eliminateAssessmentEvidence(
  assessmentId: string,
  rows: PendingEvidence[]
): Promise<number> {
  await deleteObjects(
    MERIDIAN_EVIDENCE_BUCKET,
    rows.map((r) => r.storagePath)
  );

  // fileName também vira o marcador — pode conter dado pessoal (mesmo
  // motivo do DSAR anonimizar fileName); sem isso, o dado sobreviveria à
  // própria retenção que este job promete.
  const { count } = await database.meridianEvidence.updateMany({
    where: {
      id: { in: rows.map((r) => r.id) },
      storagePath: { not: EVIDENCE_RETENTION_ELIMINATED_MARKER },
    },
    data: {
      storagePath: EVIDENCE_RETENTION_ELIMINATED_MARKER,
      fileName: EVIDENCE_RETENTION_ELIMINATED_MARKER,
    },
  });

  // Sem fileName no metadata: um log de auditoria é de vida longa —
  // duplicar ali o mesmo dado pessoal que acabamos de anonimizar no
  // registro principal reabriria a mesma exposição.
  //
  // `id` determinístico (por evidência, nunca muda) + `skipDuplicates`: se
  // delete+update já commitaram mas a execução caiu antes do audit (ou o
  // lote é repetido), o `createMany` com o mesmo `id` ignora a linha
  // existente em vez de duplicá-la.
  await database.auditLog.createMany({
    data: rows.map((r) => ({
      id: `meridian-evidence-retention:${r.id}`,
      tenantId: r.tenantId,
      actorType: "system",
      action: "meridian.evidence.retention-eliminated",
      entityType: "meridian.evidence",
      entityId: r.id,
      metadata: { assessmentId },
    })),
    skipDuplicates: true,
  });

  return count;
}

export async function eliminateExpiredMeridianEvidence(
  now: Date = new Date()
): Promise<EvidenceRetentionResult> {
  const pending: PendingEvidence[] = await database.meridianEvidence.findMany({
    where: {
      storagePath: { not: EVIDENCE_RETENTION_ELIMINATED_MARKER },
      assessment: { closedAt: { lt: evidenceRetentionCutoff(now) } },
    },
    select: {
      id: true,
      tenantId: true,
      assessmentId: true,
      storagePath: true,
      fileName: true,
    },
    take: MAX_EVIDENCE_PER_RUN,
    orderBy: { id: "asc" },
  });

  const byAssessment = new Map<string, PendingEvidence[]>();
  for (const row of pending) {
    const group = byAssessment.get(row.assessmentId);
    if (group) {
      group.push(row);
    } else {
      byAssessment.set(row.assessmentId, [row]);
    }
  }

  let eliminated = 0;
  let failed = 0;
  for (const [assessmentId, rows] of byAssessment) {
    try {
      eliminated += await eliminateAssessmentEvidence(assessmentId, rows);
    } catch (error) {
      failed += 1;
      log.error("[meridian-evidence-retention] assessment falhou", {
        assessmentId,
        error,
      });
    }
  }

  log.info("[meridian-evidence-retention] varredura concluída", {
    eliminated,
    assessments: byAssessment.size,
    failed,
  });

  return { eliminated, assessments: byAssessment.size, failed };
}

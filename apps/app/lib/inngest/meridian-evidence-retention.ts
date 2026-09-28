import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { deleteObjects, MERIDIAN_EVIDENCE_BUCKET } from "@repo/storage";
import {
  EVIDENCE_RETENTION_ELIMINATED_MARKER,
  evidenceRetentionCutoff,
} from "@/lib/meridian/evidence-retention";
import { inngest } from "./client";

// Retenção de evidência do respondente — decisão do CEO, 2026-09-28
// (docs/qualidade/dogfood/meridian/atrito.md:60, parecer de compliance
// condição 3): o objeto no bucket `meridian-evidence` some 90 dias depois do
// fechamento do assessment (`closedAt`). O registro em `MeridianEvidence`
// continua — a trilha de auditoria não é apagada, mesma lógica de
// `lgpd-dsr.ts` (que anonimiza em vez de apagar) — só `storagePath` vira o
// marcador, pra `requestEvidenceUrl` (`report.ts`) recusar em vez de emitir
// URL assinada pra objeto que já não existe.
//
// Idempotente entre dias: cada execução consulta de novo por `storagePath`
// ainda não marcado, então evidência já processada não volta a aparecer.
// Idempotente dentro de um retry: cada assessment é seu próprio `step.run`
// — o Inngest reaproveita o resultado memoizado dos que já terminaram.
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

export const eliminateExpiredMeridianEvidence = inngest.createFunction(
  {
    id: "meridian-evidence-retention",
    name: "Meridian — elimina evidência com retenção vencida",
    triggers: [{ cron: "0 3 * * *" }],
    concurrency: { limit: 1 },
    retries: 2,
  },
  async ({ step }) => {
    // Teto por execução: sem `take`, um backlog grande na primeira execução
    // estouraria o tamanho de saída de um step do Inngest. `orderBy: id`
    // garante progresso determinístico — o que sobrar desta janela de 500
    // fica pro dia seguinte, não se perde (o filtro por `storagePath` acima
    // continua achando o que falta).
    const pending: PendingEvidence[] = await step.run(
      "find-expired-evidence",
      () =>
        database.meridianEvidence.findMany({
          where: {
            storagePath: { not: EVIDENCE_RETENTION_ELIMINATED_MARKER },
            assessment: {
              closedAt: { lt: evidenceRetentionCutoff(new Date()) },
            },
          },
          select: {
            id: true,
            tenantId: true,
            assessmentId: true,
            storagePath: true,
            fileName: true,
          },
          take: 500,
          orderBy: { id: "asc" },
        })
    );

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
    for (const [assessmentId, rows] of byAssessment) {
      await step.run(`eliminate-evidence-${assessmentId}`, async () => {
        await deleteObjects(
          MERIDIAN_EVIDENCE_BUCKET,
          rows.map((r) => r.storagePath)
        );

        // fileName também vira o marcador — pode conter dado pessoal (mesmo
        // motivo do DSAR em lgpd-dsr.ts anonimizar fileName); sem isso, o
        // dado sobreviveria à própria retenção que este job promete.
        await database.meridianEvidence.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: {
            storagePath: EVIDENCE_RETENTION_ELIMINATED_MARKER,
            fileName: EVIDENCE_RETENTION_ELIMINATED_MARKER,
          },
        });

        // Sem fileName no metadata: um log de auditoria é de vida longa —
        // duplicar ali o mesmo dado pessoal que acabamos de anonimizar no
        // registro principal reabriria a mesma exposição.
        await database.auditLog.createMany({
          data: rows.map((r) => ({
            tenantId: r.tenantId,
            actorType: "system",
            action: "meridian.evidence.retention-eliminated",
            entityType: "meridian.evidence",
            entityId: r.id,
            metadata: { assessmentId },
          })),
        });
      });
      eliminated += rows.length;
    }

    log.info("[meridian-evidence-retention] varredura concluída", {
      eliminated,
      assessments: byAssessment.size,
    });

    return { eliminated, assessments: byAssessment.size };
  }
);

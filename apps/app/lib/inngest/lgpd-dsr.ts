import { createHash } from "node:crypto";
import { database, Prisma } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

// ─── Erasure request (LGPD Art. 18 — right to erasure) ───────────────────────

type ErasureEventData = {
  subjectId: string;
  tenantId: string;
  requestId: string;
};

export const processErasureRequest = inngest.createFunction(
  {
    id: "lgpd-erasure",
    triggers: [{ event: "lgpd/erasure.requested" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { subjectId, tenantId, requestId } = event.data as ErasureEventData;
    const hash = createHash("sha256").update(subjectId).digest("hex");
    const replacement = `{subject_anonymized_${hash}}`;

    await step.run("mark-in-progress", () =>
      database.dataSubjectRequest.update({
        where: { id: requestId },
        data: { status: "IN_PROGRESS" },
      })
    );

    // ORDEM IMPORTA: o e-mail tem de ser lido antes de `anonymize-user-profile`
    // sobrescrevê-lo. `MeetingParticipant` é identificado por e-mail, não por
    // `User.id`, e depois da anonimização o único e-mail disponível seria
    // `${hash}@erased.cosmos` — que não corresponde a participante nenhum, e a
    // eliminação de reunião viraria silenciosamente um no-op.
    const subjectEmail = await step.run("fetch-subject-email", async () => {
      const user = await database.user.findUnique({
        where: { id: subjectId },
        select: { email: true },
      });
      return user?.email ?? null;
    });

    await step.run("anonymize-user-profile", () =>
      database.user.update({
        where: { id: subjectId },
        data: {
          name: replacement,
          email: `${hash}@erased.cosmos`,
        },
      })
    );

    await step.run("anonymize-standup-entries", () =>
      database.standupEntry.updateMany({
        where: { userId: subjectId, tenantId },
        data: {
          yesterday: replacement,
          today: replacement,
          blockers: replacement,
        },
      })
    );

    await step.run("anonymize-copilot-messages", () =>
      database.copilotMessage.updateMany({
        where: { session: { userId: subjectId, tenantId } },
        data: { content: "[Erased: LGPD Art.18 request]" },
      })
    );

    // Passo 8 do §7: a eliminação alcança MeetingParticipant e
    // MeetingTranscript. Participante de reunião é identificado por e-mail,
    // não por User.id — a maioria não é usuário da plataforma. O e-mail do
    // User sendo apagado — lido lá em cima, antes da anonimização do perfil,
    // pelo motivo explicado naquele ponto — é o elo natural entre os dois.
    //
    // O participante externo que não é usuário da Nebuloz não tem User.id
    // nenhum para disparar este fluxo — não tem caminho de DSR pela
    // aplicação. É a mesma lacuna já documentada para o respondente do
    // Meridian (docs/compliance/consentimento-de-gravacao.md §6); não é
    // este código que a fecha, só o participante que também é usuário da
    // plataforma é alcançado aqui.
    if (subjectEmail) {
      const participantTranscriptIds = await step.run(
        "find-participant-transcripts",
        async () => {
          const rows = await database.meetingParticipant.findMany({
            where: { tenantId, email: subjectEmail },
            select: { transcriptId: true },
          });
          return Array.from(new Set(rows.map((r) => r.transcriptId)));
        }
      );

      await step.run("anonymize-meeting-participant", () =>
        database.meetingParticipant.updateMany({
          where: { tenantId, email: subjectEmail },
          data: { email: `${hash}@erased.cosmos`, name: replacement },
        })
      );

      // Mesmo espírito de revokeConsent (actions/meeting/consent.ts): o
      // conteúdo derivado da fala precisa sair. Insight ainda
      // PENDING/DISMISSED é rascunho que nunca virou dado do produto —
      // apagar é a eliminação em si. Insight já APPLIED vira entidade de
      // domínio real (Risk/Impediment/DecisionLog) por decisão humana, sem
      // FK de volta para cá — a linha fica, com status e appliedEntityId
      // intactos, mas com o texto redigido, preservando a prova de que
      // aquela entidade veio de uma reunião cujo participante foi
      // eliminado. `rawSummary` da transcrição é zerado, igual à
      // revogação — o conteúdo bruto não pode sobreviver à eliminação do
      // titular.
      if (participantTranscriptIds.length > 0) {
        await step.run("erase-meeting-transcript-content", () =>
          database.$transaction(async (tx) => {
            await tx.meetingInsight.deleteMany({
              where: {
                tenantId,
                transcriptId: { in: participantTranscriptIds },
                status: { in: ["PENDING", "DISMISSED"] },
              },
            });

            await tx.meetingInsight.updateMany({
              where: {
                tenantId,
                transcriptId: { in: participantTranscriptIds },
                status: "APPLIED",
              },
              data: {
                text: "[conteúdo removido — solicitação de eliminação LGPD]",
              },
            });

            await tx.meetingTranscript.updateMany({
              where: { tenantId, id: { in: participantTranscriptIds } },
              data: { rawSummary: Prisma.DbNull },
            });
          })
        );
      }
    }

    await step.run("complete-request", async () => {
      await database.dataSubjectRequest.update({
        where: { id: requestId },
        data: { status: "COMPLETED", processedAt: new Date() },
      });

      database.auditLog
        .create({
          data: {
            tenantId,
            action: "compliance.lgpd_erasure.completed",
            actorId: null,
            actorType: "system",
            metadata: { requestId, subjectId: hash },
          },
        })
        .catch((err) => {
          log.error("[lgpd-erasure] audit log failed", err);
        });
    });
  }
);

// ─── Portability export (LGPD Art. 18.IV — right to data portability) ────────

export type PortabilityPayload = {
  schemaVersion: string;
  exportedAt: string;
  subject: {
    id: string;
    name: string | null;
    email: string;
    createdAt: Date;
  } | null;
  standupEntries: Array<{
    id: string;
    date: Date;
    yesterday: string | null;
    today: string | null;
    blockers: string | null;
  }>;
  copilotSessions: Array<{
    id: string;
    mode: string;
    createdAt: Date;
    messageCount: number;
  }>;
  // Passo 8 do §7: participação em reunião é dado do titular. Vazio quando
  // o usuário não tem e-mail conhecido (subject null) — mesma correspondência
  // por e-mail usada em processErasureRequest, acima.
  meetingParticipations: Array<{
    transcriptId: string;
    meetingId: string;
    title: string | null;
    isOrganizer: boolean;
    isExternal: boolean;
    createdAt: Date;
  }>;
};

export async function buildPortabilityExport(
  subjectId: string,
  tenantId: string,
  exportedAt: string
): Promise<PortabilityPayload> {
  const [profile, standupEntries, copilotSessions] = await Promise.all([
    database.user.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    database.standupEntry.findMany({
      where: { userId: subjectId, tenantId },
      select: {
        id: true,
        date: true,
        yesterday: true,
        today: true,
        blockers: true,
      },
      orderBy: { date: "asc" },
    }),
    database.copilotSession.findMany({
      where: { userId: subjectId, tenantId },
      select: { id: true, mode: true, createdAt: true, messageCount: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const participantRows = profile?.email
    ? await database.meetingParticipant.findMany({
        where: { tenantId, email: profile.email },
        select: {
          isOrganizer: true,
          isExternal: true,
          transcript: {
            select: {
              id: true,
              meetingId: true,
              title: true,
              createdAt: true,
            },
          },
        },
      })
    : [];

  return {
    schemaVersion: "1.0",
    exportedAt,
    subject: profile,
    standupEntries,
    copilotSessions,
    meetingParticipations: participantRows.map((p) => ({
      transcriptId: p.transcript.id,
      meetingId: p.transcript.meetingId,
      title: p.transcript.title,
      isOrganizer: p.isOrganizer,
      isExternal: p.isExternal,
      createdAt: p.transcript.createdAt,
    })),
  };
}

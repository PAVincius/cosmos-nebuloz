import { createHash } from "node:crypto";
import { database, Prisma } from "@repo/database";
import { log } from "@repo/observability/log";
import { deleteObjects, MERIDIAN_EVIDENCE_BUCKET } from "@repo/storage";
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

    // §5 de docs/compliance/lgpd-ropa-e-lacunas.md: AccessLog é anonimizado,
    // nunca apagado. O RoPA classifica esse tratamento como legítimo
    // interesse de segurança, e o Art. 18 prevê a exceção — reter o evento
    // (tantas tentativas RECUSADO naquele horário, daquele IP) é o sinal de
    // segurança do tenant, não dado que existe para o titular. Por isso a
    // linha fica: `evento`, `motivo` e `criadoEm` preservados, só o
    // identificador em claro (email, ip, userAgent) some. Sem este comentário,
    // alguém troca por `deleteMany` na próxima limpeza e apaga o sinal junto
    // com o titular.
    //
    // Casamento por `userId` (quando existe) OU por `email`: as linhas
    // RECUSADO tipicamente não têm `userId` — é login que falhou antes de
    // sessão existir — e são justamente as que identificam alguém que talvez
    // nem seja usuário da plataforma. `subjectEmail` é o mesmo e-mail lido lá
    // em cima, antes de `anonymize-user-profile` sobrescrevê-lo; não é uma
    // segunda leitura.
    await step.run("anonymize-access-log", () =>
      database.accessLog.updateMany({
        where: subjectEmail
          ? { tenantId, OR: [{ userId: subjectId }, { email: subjectEmail }] }
          : { tenantId, userId: subjectId },
        data: {
          email: `${hash}@erased.cosmos`,
          ip: null,
          userAgent: null,
        },
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

    // §5: a eliminação alcança MeridianRespondent. Diferente de
    // MeetingParticipant, aqui não apagamos a linha nem `MeridianResponse` —
    // `MeridianResponse` tem `onDelete: Cascade` a partir de
    // MeridianRespondent, e as respostas alimentam MeridianAxisScore: apagar
    // o respondente destruiria as respostas e corromperia o diagnóstico do
    // cliente, que é dado do cliente, não do titular. Por isso: anonimizar
    // `name`/`email`, preservar `MeridianResponse` intacto, e invalidar o
    // acesso — quem exerceu eliminação não pode deixar um link funcionando
    // para trás. Casamento só por `subjectEmail`: MeridianRespondent não tem
    // `userId`, não há caminho por `User.id` aqui.
    //
    // Invalidação por `tokenExpiresAt`, não por `tokenHash`: `tokenHash` é
    // `@unique`, e um mesmo `subjectEmail` pode ter mais de um respondente
    // (assessments diferentes) — um `updateMany` gravando o mesmo hash em
    // duas linhas violaria a constraint, e gerar um hash por linha custaria
    // uma query por respondente. Expirar `tokenExpiresAt` para o passado tem
    // o mesmo efeito prático por `isTokenUsable`
    // (lib/meridian/respondent-token.ts checa `tokenExpiresAt.getTime() >
    // now.getTime()`), sem risco de colisão em lote.
    if (subjectEmail) {
      const respondentIds = await step.run(
        "find-meridian-respondents",
        async () => {
          const rows = await database.meridianRespondent.findMany({
            where: { tenantId, email: subjectEmail },
            select: { id: true },
          });
          return rows.map((r) => r.id);
        }
      );

      if (respondentIds.length > 0) {
        await step.run("anonymize-meridian-respondent", () =>
          database.meridianRespondent.updateMany({
            where: { tenantId, id: { in: respondentIds } },
            data: {
              name: replacement,
              email: `${hash}@erased.cosmos`,
              tokenExpiresAt: new Date(0),
            },
          })
        );

        // MeridianEvidence: `fileName` é metadado barato de anonimizar aqui
        // — pode conter dado pessoal (ex. nome do titular no arquivo).
        await step.run("anonymize-meridian-evidence-filename", () =>
          database.meridianEvidence.updateMany({
            where: { tenantId, uploadedByRespondentId: { in: respondentIds } },
            // `replacement`, o mesmo substituto dos demais campos: um marcador
            // de eliminação diferente por tabela obrigaria quem audita a
            // conhecer cada variação para reconhecer o que foi apagado.
            data: { fileName: replacement },
          })
        );

        // Objeto em si, em `storagePath`, vive no bucket privado
        // `meridian-evidence` — fora do banco, fora do alcance do update
        // acima. Parecer de compliance
        // (docs/compliance/2026-09-24-parecer-meridian-respondente.md,
        // condição 2): sem apagar o arquivo, o direito de eliminação fica só
        // no metadado.
        const evidencePaths = await step.run(
          "find-meridian-evidence-paths",
          async () => {
            const rows = await database.meridianEvidence.findMany({
              where: {
                tenantId,
                uploadedByRespondentId: { in: respondentIds },
              },
              select: { storagePath: true },
            });
            return rows.map((r) => r.storagePath);
          }
        );

        if (evidencePaths.length > 0) {
          await step.run("delete-meridian-evidence-objects", () =>
            deleteObjects(MERIDIAN_EVIDENCE_BUCKET, evidencePaths)
          );
        }
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

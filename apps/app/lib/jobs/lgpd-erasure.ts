import { createHash } from "node:crypto";
import { database, Prisma } from "@repo/database";
import { log } from "@repo/observability/log";
import { deleteObjects, MERIDIAN_EVIDENCE_BUCKET } from "@repo/storage";

// ─── Erasure request (LGPD Art. 18 — right to erasure) ───────────────────────
//
// ADR-0021 fase 1: sem Inngest. O `DataSubjectRequest` PENDING é o próprio
// outbox; `/api/cron/lgpd-erasure` chama `processPendingErasureRequests`.
// O pedido pode ser repetido depois de uma falha parcial (o Inngest
// memoizava os ids entre tentativas; aqui cada tentativa refaz os `find`).
// Por isso a ordem importa: as linhas que carregam o e-mail do titular
// (perfil, participante de reunião, respondente) só são anonimizadas DEPOIS
// de o conteúdo ligado a elas ter sido eliminado. Cada passo repetido não
// tem efeito extra, e uma falha deixa a chave intacta para a nova tentativa
// achar o que falta.

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;
// Bem acima do `maxDuration` da rota (300 s): só um pedido cuja execução
// morreu (timeout, deploy) passa desse prazo.
const LEASE_MS = 10 * 60 * 1000;
const MAX_ERROR_LENGTH = 300;

export type ErasureQueueResult = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
};

type ErasureData = {
  subjectId: string;
  tenantId: string;
  requestId: string;
};

type DsrMetadata = {
  attempts?: number;
  lockedAt?: string | null;
  lastError?: string;
  lastErrorAt?: string;
};

type Candidate = {
  id: string;
  tenantId: string;
  subjectId: string;
  status: "PENDING" | "IN_PROGRESS";
  metadata: unknown;
};

class ErasureStageError extends Error {
  constructor(stageName: string, cause: unknown) {
    super(
      `${stageName}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = "ErasureStageError";
  }
}

// Rotula o passo que falhou — vai para `metadata.lastError`.
async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new ErasureStageError(name, error);
  }
}

export async function runErasure({
  subjectId,
  tenantId,
  requestId,
}: ErasureData): Promise<void> {
  const hash = createHash("sha256").update(subjectId).digest("hex");
  const replacement = `{subject_anonymized_${hash}}`;

  // ORDEM IMPORTA: o e-mail é lido primeiro e o perfil (`User`) só é
  // anonimizado no ÚLTIMO passo. `MeetingParticipant` é identificado por
  // e-mail, não por `User.id`, e depois da anonimização o único e-mail
  // disponível seria `${hash}@erased.cosmos` — que não corresponde a
  // participante nenhum, e a eliminação de reunião viraria
  // silenciosamente um no-op. Como o cron pode repetir o pedido após uma
  // falha parcial (antes o Inngest memoizava o e-mail entre tentativas),
  // deixar o perfil por último garante que toda nova tentativa ainda
  // encontra o e-mail original.
  const subjectEmail = await stage("fetch-subject-email", async () => {
    const user = await database.user.findUnique({
      where: { id: subjectId },
      select: { email: true },
    });
    return user?.email ?? null;
  });

  await stage("anonymize-standup-entries", () =>
    database.standupEntry.updateMany({
      where: { userId: subjectId, tenantId },
      data: {
        yesterday: replacement,
        today: replacement,
        blockers: replacement,
      },
    })
  );

  await stage("anonymize-copilot-messages", () =>
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
  await stage("anonymize-access-log", () =>
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
    const participantTranscriptIds = await stage(
      "find-participant-transcripts",
      async () => {
        const rows = await database.meetingParticipant.findMany({
          where: { tenantId, email: subjectEmail },
          select: { transcriptId: true },
        });
        return Array.from(new Set(rows.map((r) => r.transcriptId)));
      }
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
      await stage("erase-meeting-transcript-content", () =>
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

    // Linha-chave por ÚLTIMO: `MeetingParticipant` é o que liga o e-mail às
    // transcrições. Se este passo rodasse antes da eliminação do conteúdo e
    // esta falhasse, a nova tentativa não acharia mais o participante e a
    // transcrição sobreviveria com o pedido fechado como COMPLETED.
    await stage("anonymize-meeting-participant", () =>
      database.meetingParticipant.updateMany({
        where: { tenantId, email: subjectEmail },
        data: { email: `${hash}@erased.cosmos`, name: replacement },
      })
    );
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
    const respondentIds = await stage("find-meridian-respondents", async () => {
      const rows = await database.meridianRespondent.findMany({
        where: { tenantId, email: subjectEmail },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    });

    if (respondentIds.length > 0) {
      // Objeto em si, em `storagePath`, vive no bucket privado
      // `meridian-evidence` — fora do banco, fora do alcance do update
      // acima. Parecer de compliance
      // (docs/compliance/2026-09-24-parecer-meridian-respondente.md,
      // condição 2): sem apagar o arquivo, o direito de eliminação fica só
      // no metadado.
      const evidencePaths = await stage(
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
        await stage("delete-meridian-evidence-objects", () =>
          deleteObjects(MERIDIAN_EVIDENCE_BUCKET, evidencePaths)
        );
      }

      // MeridianEvidence: `fileName` é metadado barato de anonimizar aqui
      // — pode conter dado pessoal (ex. nome do titular no arquivo).
      await stage("anonymize-meridian-evidence-filename", () =>
        database.meridianEvidence.updateMany({
          where: { tenantId, uploadedByRespondentId: { in: respondentIds } },
          // `replacement`, o mesmo substituto dos demais campos: um marcador
          // de eliminação diferente por tabela obrigaria quem audita a
          // conhecer cada variação para reconhecer o que foi apagado.
          data: { fileName: replacement },
        })
      );

      // Linha-chave por ÚLTIMO (mesmo motivo do bloco de reunião): o
      // respondente é o que liga o e-mail aos anexos. Anonimizá-lo antes de
      // apagar o objeto e o fileName deixaria a nova tentativa sem achar
      // nada.
      await stage("anonymize-meridian-respondent", () =>
        database.meridianRespondent.updateMany({
          where: { tenantId, id: { in: respondentIds } },
          data: {
            name: replacement,
            email: `${hash}@erased.cosmos`,
            tokenExpiresAt: new Date(0),
          },
        })
      );
    }
  }

  await stage("anonymize-user-profile", () =>
    database.user.update({
      where: { id: subjectId },
      data: {
        name: replacement,
        email: `${hash}@erased.cosmos`,
      },
    })
  );

  await stage("complete-request", async () => {
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

// ─── Fila: reivindicação, tentativas e falha ─────────────────────────────────

function readMetadata(raw: unknown): DsrMetadata {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as DsrMetadata)
    : {};
}

// Só a mensagem, sem e-mail: `lastError` fica em `DataSubjectRequest`, que
// sobrevive à eliminação do titular.
function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[^\s@]+@[^\s@]+/g, "[email]")
    .slice(0, MAX_ERROR_LENGTH);
}

// PENDING é sempre elegível; IN_PROGRESS só quando o lease venceu (a
// execução que o reivindicou morreu antes de completar ou falhar).
function isClaimable(row: Candidate, now: Date): boolean {
  if (row.status === "PENDING") {
    return true;
  }
  const { lockedAt } = readMetadata(row.metadata);
  return !lockedAt || now.getTime() - new Date(lockedAt).getTime() > LEASE_MS;
}

// Lock por `updateMany` condicional: só uma execução vê `count === 1`. Para
// o retomar de IN_PROGRESS, a condição inclui o `lockedAt` lido, então duas
// execuções não retomam o mesmo pedido.
async function claim(row: Candidate, now: Date): Promise<number | null> {
  const meta = readMetadata(row.metadata);
  const attempts = (meta.attempts ?? 0) + 1;
  const where =
    row.status === "PENDING"
      ? { id: row.id, status: "PENDING" as const }
      : {
          id: row.id,
          status: "IN_PROGRESS" as const,
          // Legado do Inngest: IN_PROGRESS sem metadata (nunca teve lock).
          metadata: meta.lockedAt
            ? { path: ["lockedAt"], equals: meta.lockedAt }
            : { equals: Prisma.DbNull },
        };

  const { count } = await database.dataSubjectRequest.updateMany({
    where,
    data: {
      status: "IN_PROGRESS",
      metadata: { attempts, lockedAt: now.toISOString() },
    },
  });
  return count === 1 ? attempts : null;
}

async function recordFailure(
  row: Candidate,
  attempts: number,
  error: unknown,
  now: Date
): Promise<"retried" | "failed"> {
  const lastError = safeErrorMessage(error);
  const exhausted = attempts >= MAX_ATTEMPTS;

  await database.dataSubjectRequest.update({
    where: { id: row.id },
    data: exhausted
      ? {
          status: "FAILED",
          processedAt: now,
          metadata: {
            attempts,
            lastError,
            lastErrorAt: now.toISOString(),
          },
        }
      : {
          status: "PENDING",
          metadata: {
            attempts,
            lastError,
            lastErrorAt: now.toISOString(),
          },
        },
  });

  if (!exhausted) {
    return "retried";
  }

  log.error("[lgpd-erasure] pedido falhou de vez", {
    requestId: row.id,
    tenantId: row.tenantId,
    attempts,
    lastError,
  });
  // Pedido de titular que não foi atendido é fato de conformidade: trilha
  // de auditoria além do log, para o DPO enxergar o FAILED.
  await database.auditLog
    .create({
      data: {
        tenantId: row.tenantId,
        action: "compliance.lgpd_erasure.failed",
        actorId: null,
        actorType: "system",
        metadata: { requestId: row.id, attempts },
      },
    })
    .catch((err) => {
      log.error("[lgpd-erasure] audit log failed", err);
    });
  return "failed";
}

export async function processPendingErasureRequests(): Promise<ErasureQueueResult> {
  const now = new Date();
  const result: ErasureQueueResult = {
    claimed: 0,
    completed: 0,
    retried: 0,
    failed: 0,
  };

  const candidates = (await database.dataSubjectRequest.findMany({
    where: { type: "ERASURE", status: { in: ["PENDING", "IN_PROGRESS"] } },
    orderBy: { requestedAt: "asc" },
    take: BATCH_SIZE * 4,
    select: {
      id: true,
      tenantId: true,
      subjectId: true,
      status: true,
      metadata: true,
    },
  })) as Candidate[];

  for (const row of candidates) {
    if (result.claimed >= BATCH_SIZE) {
      break;
    }
    if (!isClaimable(row, now)) {
      continue;
    }
    const attempts = await claim(row, now);
    if (attempts === null) {
      continue;
    }
    result.claimed += 1;

    // Teto no claim: a tentativa que estourou o lease (timeout da função) não
    // passa por `recordFailure`, então uma execução que sempre morre voltaria
    // a ser retomada para sempre. Passou de MAX_ATTEMPTS, fecha como FAILED
    // sem executar.
    try {
      if (attempts > MAX_ATTEMPTS) {
        throw new Error("tentativas esgotadas (execução anterior expirou)");
      }
      await runErasure({
        subjectId: row.subjectId,
        tenantId: row.tenantId,
        requestId: row.id,
      });
      result.completed += 1;
    } catch (error) {
      try {
        result[await recordFailure(row, attempts, error, now)] += 1;
      } catch (recordError) {
        // Falha ao gravar a falha não derruba o lote: o pedido fica
        // IN_PROGRESS e é retomado quando o lease vencer.
        result.failed += 1;
        log.error("[lgpd-erasure] não gravou a falha do pedido", {
          requestId: row.id,
          error: recordError,
        });
      }
    }
  }

  return result;
}

"use server";

import type { MeridianQuestionType } from "@repo/database";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import {
  ensureBucket,
  MERIDIAN_EVIDENCE_BUCKET,
  storageClient,
} from "@repo/storage";
import { cookies } from "next/headers";
import { z } from "zod";
import { AXES } from "@/lib/meridian/axes";
import { MeridianRuleError } from "@/lib/meridian/guards";
import { isTokenShape } from "@/lib/meridian/respondent-link";
import {
  findRespondentByTokenOrThrow,
  TOKEN_ERROR,
} from "@/lib/meridian/respondent-lookup";
import { COLLECTION_CLOSED_MESSAGE } from "@/lib/meridian/respondent-messages";
import {
  RESPONDENT_COOKIE,
  readRespondentToken,
  respondentCookieOptions,
} from "@/lib/meridian/respondent-session";
import { normalizeAnswer } from "@/lib/meridian/scoring";
import { type Result, safeAction } from "../../actions/_base";
import { logRespondentAudit } from "./_shared";

// Visão do respondente — US2.
//
// Esta é a única superfície do módulo sem sessão de tenant: o respondente não
// tem conta na plataforma. Duas consequências que não podem ser relaxadas:
//
//   • o `tenantId` sai do respondente encontrado pelo hash do token, nunca do
//     request — aceitar tenantId do cliente aqui seria o vazamento perfeito;
//   • token inexistente, expirado e revogado devolvem o mesmo erro. Diferenciar
//     confirmaria a um estranho que aquele assessment existe.

export type RespondentContext = {
  respondentId: string;
  tenantId: string;
  assessmentId: string;
  assessmentCode: string;
  orgName: string;
  axis: string;
  axisLabel: string;
  name: string;
  deadline: string;
  status: string;
};

/**
 * Troca o token do fragmento da URL por sessão (achado 28a do Lacre).
 *
 * O link novo é `/meridian-responder#t=<token>`; o navegador não envia o
 * fragmento ao servidor. O cliente lê o token e o manda para cá como argumento
 * da server action, isto é, no CORPO do POST e não na URL, que fica sem token.
 * Aqui o token é validado (mesma consulta e mesmo teto de tentativas por IP) e
 * vira o cookie httpOnly que a página e as demais actions leem.
 *
 * Recusa de qualquer motivo devolve o mesmo erro: diferenciar confirmaria a um
 * estranho que aquele assessment existe.
 */
export async function startRespondentSession(
  token: string
): Promise<Result<void>> {
  return safeAction(async () => {
    if (!isTokenShape(token)) {
      throw TOKEN_ERROR;
    }
    const r = await findRespondentByTokenOrThrow(token);
    (await cookies()).set(
      RESPONDENT_COOKIE,
      token,
      respondentCookieOptions(r.tokenExpiresAt)
    );
  });
}

/**
 * Resolve o token para um respondente.
 *
 * Não usa `withTenantDb` porque o tenant é justamente o que estamos
 * descobrindo. A consulta é por `tokenHash`, que é `@unique` — não há como
 * enumerar, e a leitura devolve um único registro ou nada.
 */
export async function resolveRespondentToken(): Promise<
  Result<RespondentContext>
> {
  return safeAction(async () => {
    const r = await findRespondentByTokenOrThrow(await readRespondentToken());
    return {
      respondentId: r.id,
      tenantId: r.tenantId,
      assessmentId: r.assessment.id,
      assessmentCode: r.assessment.code,
      orgName: r.assessment.orgName,
      axis: r.axis,
      axisLabel: AXES[r.axis].label,
      name: r.name,
      deadline: r.tokenExpiresAt.toISOString(),
      status: r.status,
    };
  });
}

export type BatteryQuestion = {
  id: string;
  code: string;
  type: MeridianQuestionType;
  text: string;
  scaleLabels: string[];
  answer: number | null;
  evidence: { id: string; fileName: string }[];
};

export type Battery = {
  context: RespondentContext;
  questions: BatteryQuestion[];
};

async function loadRespondent() {
  return findRespondentByTokenOrThrow(await readRespondentToken());
}

/** Para as três escritas do respondente. Só COLLECTING aceita: a partir do
 *  fechamento da coleta (REVIEW) o link é só leitura, mesmo com token válido
 *  (D-29, FR-029c) — antes a resposta mudava depois do fechamento e o
 *  computado, não. */
async function loadRespondentForWrite() {
  const r = await findRespondentByTokenOrThrow(await readRespondentToken());
  if (r.assessment.status !== "COLLECTING") {
    throw new MeridianRuleError("collection.closed", COLLECTION_CLOSED_MESSAGE);
  }
  return r;
}

type RespondentTx = Parameters<Parameters<typeof database.$transaction>[0]>[0];

/** Confere COLLECTING na transação da escrita. `loadRespondentForWrite` leu o
 *  estado antes e isso não segura nada: o consultor pode fechar a coleta entre
 *  a leitura e o gravar, e a resposta entraria depois de o computado existir.
 *  `FOR SHARE` trava a linha do assessment até o fim da transação — fechar a
 *  coleta espera quem está gravando, e quem chega depois lê o estado novo. */
async function requireCollectingInTx(
  tx: RespondentTx,
  assessmentId: string
): Promise<void> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status"::text AS "status" FROM "MeridianAssessment"
    WHERE "id" = ${assessmentId} FOR SHARE`;
  if (rows[0]?.status !== "COLLECTING") {
    throw new MeridianRuleError("collection.closed", COLLECTION_CLOSED_MESSAGE);
  }
}

/** Só as perguntas do eixo daquele respondente, daquele assessment. Ele nunca
 *  vê a bateria dos outros eixos nem as respostas de ninguém. */
export async function getBattery(): Promise<Result<Battery>> {
  return safeAction(async () => {
    const r = await loadRespondent();

    const questions = await database.meridianQuestion.findMany({
      where: { templateId: r.assessment.templateId, axis: r.axis },
      orderBy: { ordinal: "asc" },
      select: {
        id: true,
        code: true,
        type: true,
        text: true,
        scaleLabels: true,
      },
    });
    const responses = await database.meridianResponse.findMany({
      where: { respondentId: r.id },
      select: {
        questionId: true,
        rawValue: true,
        evidence: { select: { id: true, fileName: true } },
      },
    });
    const byQuestion = new Map(responses.map((x) => [x.questionId, x]));

    return {
      context: {
        respondentId: r.id,
        tenantId: r.tenantId,
        assessmentId: r.assessment.id,
        assessmentCode: r.assessment.code,
        orgName: r.assessment.orgName,
        axis: r.axis,
        axisLabel: AXES[r.axis].label,
        name: r.name,
        deadline: r.tokenExpiresAt.toISOString(),
        status: r.status,
      },
      questions: questions.map(
        (q): BatteryQuestion => ({
          id: q.id,
          code: q.code,
          type: q.type,
          text: q.text,
          scaleLabels: q.scaleLabels,
          answer: byQuestion.get(q.id)?.rawValue ?? null,
          evidence: byQuestion.get(q.id)?.evidence ?? [],
        })
      ),
    };
  });
}

const DraftSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().cuid(),
      rawValue: z.number().int().min(0),
    })
  ),
});

/** Salva respostas parciais. O lembrete continua até a conclusão — rascunho não
 *  é conclusão, e tratar como se fosse esconderia a pendência do consultor. */
export async function saveDraft(
  raw: z.input<typeof DraftSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const input = DraftSchema.parse(raw);
    const r = await loadRespondentForWrite();

    await database.$transaction(async (tx) => {
      await requireCollectingInTx(tx, r.assessment.id);

      const questions = await tx.meridianQuestion.findMany({
        where: {
          templateId: r.assessment.templateId,
          axis: r.axis,
          id: { in: input.answers.map((a) => a.questionId) },
        },
        select: {
          id: true,
          code: true,
          ordinal: true,
          type: true,
          weight: true,
          inverted: true,
          scaleLabels: true,
        },
      });
      const byId = new Map(questions.map((q) => [q.id, q]));

      for (const a of input.answers) {
        const q = byId.get(a.questionId);
        // Pergunta de outro eixo é descartada em silêncio: um cliente adulterado
        // não pode escrever fora da fatia daquele respondente.
        if (!q) {
          continue;
        }
        const normalized = normalizeAnswer(q, a.rawValue);
        await tx.meridianResponse.upsert({
          where: {
            respondentId_questionId: {
              respondentId: r.id,
              questionId: q.id,
            },
          },
          create: {
            tenantId: r.tenantId,
            respondentId: r.id,
            questionId: q.id,
            rawValue: a.rawValue,
            normalized,
          },
          update: { rawValue: a.rawValue, normalized },
        });
      }

      if (r.status === "INVITED") {
        await tx.meridianRespondent.update({
          where: { id: r.id },
          data: { status: "PENDING" },
        });
      }
    });
  });
}

/** Conclui a bateria. Com pergunta em branco, devolve a contagem e **não**
 *  conclui — bateria parcial marcada como concluída derruba a confidence do
 *  eixo sem ninguém entender por quê. */
export async function submitBattery(): Promise<Result<{ missing: number }>> {
  return safeAction(async () => {
    const r = await loadRespondentForWrite();

    // Bateria já concluída: reenviar não grava de novo nem repete a trilha.
    // Quem clica de novo (ou refaz o fluxo) vê o mesmo resultado.
    if (r.status === "DONE") {
      return { missing: 0 };
    }

    return database.$transaction(async (tx) => {
      await requireCollectingInTx(tx, r.assessment.id);

      const [total, answered] = await Promise.all([
        tx.meridianQuestion.count({
          where: { templateId: r.assessment.templateId, axis: r.axis },
        }),
        tx.meridianResponse.count({ where: { respondentId: r.id } }),
      ]);
      const missing = Math.max(0, total - answered);
      if (missing > 0) {
        return { missing };
      }

      await tx.meridianRespondent.update({
        where: { id: r.id },
        data: { status: "DONE", completedAt: new Date() },
      });
      await logRespondentAudit(tx, {
        tenantId: r.tenantId,
        respondentId: r.id,
        respondentName: r.name,
        action: "meridian.respondent.submit",
        entityType: "meridian.response",
        entityId: r.id,
        target: `${r.assessment.code} · ${AXES[r.axis].label}`,
        diff: [["Status", r.status, "DONE"]],
      });
      return { missing: 0 };
    });
  });
}

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

let evidenceBucketReady: Promise<void> | null = null;

/** `ensureBucket` é idempotente mas faz `listBuckets` a cada chamada — sem
 *  cache, isso rodava a cada evidência anexada em vez de uma vez por
 *  provisionamento (P2 do Vigia, atrito.md:54). Memoiza por processo; numa
 *  falha, limpa o cache para a próxima chamada tentar de novo em vez de
 *  travar upload de evidência pelo resto do processo por causa de uma falha
 *  transitória. */
function ensureEvidenceBucketOnce(): Promise<void> {
  if (!evidenceBucketReady) {
    evidenceBucketReady = ensureBucket(MERIDIAN_EVIDENCE_BUCKET).catch(
      (erro) => {
        evidenceBucketReady = null;
        throw erro;
      }
    );
  }
  return evidenceBucketReady;
}

/** Anexa evidência a uma resposta. O arquivo vai para o bucket privado, com o
 *  caminho prefixado pelo tenant; o banco guarda só o metadado. */
export async function attachEvidence(
  questionId: string,
  file: File
): Promise<Result<{ id: string; fileName: string }>> {
  return safeAction(async () => {
    const r = await loadRespondentForWrite();

    if (file.size > MAX_EVIDENCE_BYTES) {
      throw new MeridianRuleError(
        "evidence.too-large",
        "Arquivo acima de 10 MB."
      );
    }

    const question = await database.meridianQuestion.findFirst({
      where: {
        id: questionId,
        templateId: r.assessment.templateId,
        axis: r.axis,
      },
      select: { id: true },
    });
    if (!question) {
      throw TOKEN_ERROR;
    }

    const response = await database.meridianResponse.findUnique({
      where: {
        respondentId_questionId: {
          respondentId: r.id,
          questionId: question.id,
        },
      },
      select: { id: true },
    });

    await ensureEvidenceBucketOnce();
    const id = crypto.randomUUID();
    const storagePath = `${r.tenantId}/${r.assessment.id}/${id}`;
    const { error } = await storageClient.storage
      .from(MERIDIAN_EVIDENCE_BUCKET)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      throw new Error(`Falha ao anexar evidência: ${error.message}`);
    }

    // O arquivo já está no bucket. Se a coleta fechou no meio do caminho, o
    // metadado não entra e o objeto, sem linha que o aponte, sai junto — senão
    // ficaria fora da retenção e da eliminação, que partem do banco.
    try {
      return await database.$transaction(async (tx) => {
        await requireCollectingInTx(tx, r.assessment.id);

        const evidence = await tx.meridianEvidence.create({
          data: {
            tenantId: r.tenantId,
            assessmentId: r.assessment.id,
            responseId: response?.id ?? null,
            storagePath,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            uploadedByRespondentId: r.id,
          },
          select: { id: true, fileName: true },
        });

        await logRespondentAudit(tx, {
          tenantId: r.tenantId,
          respondentId: r.id,
          respondentName: r.name,
          action: "meridian.evidence.attach",
          entityType: "meridian.evidence",
          entityId: evidence.id,
          // Alvo pelo id, não por file.name: nome original do arquivo pode
          // carregar dado pessoal, e o audit é log de vida longa (mesmo achado
          // da Morgana sobre requestEvidenceUrl, report.ts).
          target: `${r.assessment.code} · ${evidence.id}`,
        });

        return evidence;
      });
    } catch (erro) {
      const { error: removeError } = await storageClient.storage
        .from(MERIDIAN_EVIDENCE_BUCKET)
        .remove([storagePath]);
      if (removeError) {
        log.error(
          "[meridian] objeto de evidência órfão após falha na gravação",
          {
            storagePath,
            error: removeError.message,
          }
        );
      }
      throw erro;
    }
  });
}

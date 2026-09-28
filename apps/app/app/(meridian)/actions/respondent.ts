"use server";

import type { MeridianQuestionType } from "@repo/database";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import {
  ensureBucket,
  MERIDIAN_EVIDENCE_BUCKET,
  storageClient,
} from "@repo/storage";
import { headers } from "next/headers";
import { z } from "zod";
import { AXES } from "@/lib/meridian/axes";
import { MeridianRuleError } from "@/lib/meridian/guards";
import { hashToken, isTokenUsable } from "@/lib/meridian/respondent-token";
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

const TOKEN_ERROR = new MeridianRuleError(
  "respondent.invalid-token",
  "Link inválido ou expirado."
);

const RATE_LIMIT_ERROR = new MeridianRuleError(
  "respondent.rate-limited",
  "Muitas tentativas. Aguarde um minuto."
);

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

// Rate limit do lookup de token — condição 5 do parecer de compliance
// (docs/compliance/2026-09-24-parecer-meridian-respondente.md) e P2 do Vigia
// (docs/qualidade/dogfood/meridian/atrito.md:48): sem isso, nada impedia
// tentativa repetida de adivinhar um hash de token válido. Sem sessão, IP é o
// único identificador disponível — prefere `x-real-ip` (posto pelo proxy,
// não editável pelo cliente) e só cai para o primeiro `x-forwarded-for`
// quando aquele não vem.
//
// Só é chamado depois que o lookup por hash JÁ falhou (revisão da Morgana
// sobre a primeira versão): um respondente legítimo nunca erra o próprio
// link, então nunca soma contra o teto — só tentativa de adivinhação gera
// falha atrás de falha. Um escritório inteiro atrás do mesmo IP, respondendo
// de verdade, não é barrado.
//
// Fecha em produção quando o contador está fora do ar — mesmo raciocínio do
// copiloto (app/actions/safe-copilot/rate-limit-gate.ts): se abrisse,
// derrubar o contador viraria a forma de remover o freio.
async function enforceTokenLookupRateLimit(): Promise<void> {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";

  let dentroDoLimite: boolean;
  try {
    const { createRateLimiter, fixedWindow } = await import("@repo/rate-limit");
    const limiter = createRateLimiter({
      limiter: fixedWindow(30, "1 m"),
      prefix: "meridian-token-lookup",
    });
    dentroDoLimite = (await limiter.limit(ip)).success;
  } catch (erro) {
    if (process.env.NODE_ENV === "production") {
      log.error("[meridian] rate limit de lookup de token indisponível", {
        error: String(erro),
      });
      dentroDoLimite = false;
    } else {
      dentroDoLimite = true;
    }
  }

  if (!dentroDoLimite) {
    throw RATE_LIMIT_ERROR;
  }
}

/** Consulta única por `tokenHash`, usada por toda a superfície do respondente
 *  (`resolveRespondentToken` e `loadRespondent`) — as duas precisam do mesmo
 *  freio contra adivinhação, então compartilham a mesma implementação em vez
 *  de cada uma reimplementar a checagem. */
async function findRespondentByTokenOrThrow(token: string) {
  const r = await database.meridianRespondent.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      assessment: {
        select: { id: true, code: true, orgName: true, templateId: true },
      },
    },
  });
  if (r && isTokenUsable(r, new Date())) {
    return r;
  }
  await enforceTokenLookupRateLimit();
  throw TOKEN_ERROR;
}

/**
 * Resolve o token para um respondente.
 *
 * Não usa `withTenantDb` porque o tenant é justamente o que estamos
 * descobrindo. A consulta é por `tokenHash`, que é `@unique` — não há como
 * enumerar, e a leitura devolve um único registro ou nada.
 */
export async function resolveRespondentToken(
  token: string
): Promise<Result<RespondentContext>> {
  return safeAction(async () => {
    const r = await findRespondentByTokenOrThrow(token);
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

async function loadRespondent(token: string) {
  return findRespondentByTokenOrThrow(token);
}

/** Só as perguntas do eixo daquele respondente, daquele assessment. Ele nunca
 *  vê a bateria dos outros eixos nem as respostas de ninguém. */
export async function getBattery(token: string): Promise<Result<Battery>> {
  return safeAction(async () => {
    const r = await loadRespondent(token);

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
  token: z.string().min(1),
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
    const r = await loadRespondent(input.token);

    const questions = await database.meridianQuestion.findMany({
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
      await database.meridianResponse.upsert({
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
      await database.meridianRespondent.update({
        where: { id: r.id },
        data: { status: "PENDING" },
      });
    }
  });
}

/** Conclui a bateria. Com pergunta em branco, devolve a contagem e **não**
 *  conclui — bateria parcial marcada como concluída derruba a confidence do
 *  eixo sem ninguém entender por quê. */
export async function submitBattery(
  token: string
): Promise<Result<{ missing: number }>> {
  return safeAction(async () => {
    const r = await loadRespondent(token);

    const [total, answered] = await Promise.all([
      database.meridianQuestion.count({
        where: { templateId: r.assessment.templateId, axis: r.axis },
      }),
      database.meridianResponse.count({ where: { respondentId: r.id } }),
    ]);
    const missing = Math.max(0, total - answered);
    if (missing > 0) {
      return { missing };
    }

    await database.meridianRespondent.update({
      where: { id: r.id },
      data: { status: "DONE", completedAt: new Date() },
    });
    await logRespondentAudit(database, {
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
  token: string,
  questionId: string,
  file: File
): Promise<Result<{ id: string; fileName: string }>> {
  return safeAction(async () => {
    const r = await loadRespondent(token);

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

    const evidence = await database.meridianEvidence.create({
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

    await logRespondentAudit(database, {
      tenantId: r.tenantId,
      respondentId: r.id,
      respondentName: r.name,
      action: "meridian.evidence.attach",
      entityType: "meridian.evidence",
      entityId: evidence.id,
      target: `${r.assessment.code} · ${file.name}`,
    });

    return evidence;
  });
}

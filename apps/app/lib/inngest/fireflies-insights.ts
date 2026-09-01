import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import {
  buildClassifyPrompt,
  type ClassifiedInsight,
  InsightClassificationSchema,
  parseActionItemsFallback,
  toClassifiedInsights,
} from "../meeting/insight-classify";
import { inngest } from "./client";

type TranscriptReadyData = {
  tenantId: string;
  transcriptId: string;
};

type StoredSummary = {
  overview?: string | null;
  actionItems?: string | null;
  outline?: string | null;
};

// Classify via LLM; fall back to deterministic action-item parsing on any error.
async function classifyInsights(summary: {
  overview: string | null;
  actionItems: string | null;
  outline: string | null;
}): Promise<ClassifiedInsight[]> {
  try {
    const { generateObject } = await import("ai");
    const { getActiveProvider, getAIModel } = await import(
      "@repo/ai/lib/router"
    );
    const { object } = await generateObject({
      model: getAIModel(getActiveProvider()),
      schema: InsightClassificationSchema,
      prompt: buildClassifyPrompt(summary),
    });
    const insights = toClassifiedInsights(object);
    if (insights.length > 0) {
      return insights;
    }
    return parseActionItemsFallback(summary.actionItems);
  } catch (err) {
    log.error("[fireflies-insights] LLM classify failed, using fallback", {
      error: String(err),
    });
    return parseActionItemsFallback(summary.actionItems);
  }
}

// Resolve the tenant's active PI (status EXECUTING), most recently updated.
// Loose link (FR-904 AC-004) — null when none resolvable → insights stay unlinked.
async function resolveActivePiPlanId(tenantId: string): Promise<string | null> {
  const pi = await database.pIPlan.findFirst({
    where: { tenantId, status: "EXECUTING" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return pi?.id ?? null;
}

export const mapFirefliesInsightsFn = inngest.createFunction(
  {
    id: "fireflies-insights-map",
    triggers: [{ event: "integration/fireflies.transcript.ready" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { tenantId, transcriptId } = event.data as TranscriptReadyData;

    const transcript = await step.run("fetch-transcript", () =>
      database.meetingTranscript.findFirst({
        where: { id: transcriptId, tenantId },
        select: {
          id: true,
          rawSummary: true,
          status: true,
          consentState: true,
        },
      })
    );

    if (!transcript) {
      return { skipped: true, reason: "transcript not found" };
    }

    // Portão de consentimento, redundante de propósito. O caminho normal
    // (fireflies-transcript.ts / fathom-transcript.ts) só envia este evento
    // quando GRANTED — mas este consumidor não pode confiar só nisso: se ele
    // puder ser disparado por qualquer outro caminho (retry manual, replay
    // de evento, um futuro terceiro produtor do mesmo evento), conteúdo de
    // fala sem base legal chegaria ao provedor de LLM em `classifyInsights`
    // logo abaixo. Um portão que só existe em um caminho não é portão — ver
    // docs/compliance/consentimento-de-gravacao.md §7.2.
    if (transcript.consentState !== "GRANTED") {
      return {
        skipped: true,
        reason: "consent not granted",
        consentState: transcript.consentState,
      };
    }

    const summaryRaw = (transcript.rawSummary ?? {}) as StoredSummary;
    const summary = {
      overview: summaryRaw.overview ?? null,
      actionItems: summaryRaw.actionItems ?? null,
      outline: summaryRaw.outline ?? null,
    };

    const classified = await classifyInsights(summary);
    const piPlanId = await step.run("resolve-pi", () =>
      resolveActivePiPlanId(tenantId)
    );

    await step.run("persist-insights", async () => {
      if (classified.length > 0) {
        await database.meetingInsight.createMany({
          data: classified.map((i) => ({
            tenantId,
            transcriptId,
            type: i.type,
            text: i.text,
            proposedTarget: i.proposedTarget,
            status: "PENDING",
          })),
        });
      }
      await database.meetingTranscript.update({
        where: { id: transcriptId },
        data: { status: "MAPPED", piPlanId },
      });
    });

    return { ok: true, insightCount: classified.length, piPlanId };
  }
);

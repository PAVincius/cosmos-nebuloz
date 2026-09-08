import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

type FathomWebhookData = {
  tenantId: string;
  integrationId: string;
  meetingId: string; // call_id in Fathom terminology
};

export const fetchFathomTranscriptFn = inngest.createFunction(
  {
    id: "fathom-transcript-fetch",
    triggers: [{ event: "integration/fathom.webhook" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { tenantId, integrationId, meetingId } =
      event.data as FathomWebhookData;

    const integration = await step.run("fetch-integration", () =>
      database.meetingIntegration.findFirst({
        where: { id: integrationId, tenantId },
        select: {
          id: true,
          status: true,
          config: true,
          consentMode: true,
          standingConsentRef: true,
        },
      })
    );

    if (!integration || integration.status !== "ACTIVE") {
      return { skipped: true, reason: "integration not active" };
    }

    // Portão de consentimento — mesmo mecanismo do caminho Fireflies, ver
    // fireflies-transcript.ts e docs/compliance/consentimento-de-gravacao.md
    // §4/§7.
    //
    // Passo 7: STANDING só libera sozinho quando se sabe que não há
    // participante externo. O Fathom não expõe participantes — nem em
    // FathomCall nem no adapter (lib/meeting/providers/fathom.ts) — então
    // aqui a externalidade é sempre desconhecida, nunca "sem externo". Fail
    // closed: mesmo com STANDING configurado e standingConsentRef presente,
    // a transcrição cai em PENDING até que a API do Fathom exponha um
    // equivalente de `participants`/`workspace_users`.
    const isStandingGranted = false;

    const { decryptConfigSecrets } = await import("@repo/security/encrypt");
    const config = decryptConfigSecrets(
      (integration.config ?? {}) as Record<string, unknown>
    );
    const apiKey = typeof config.apiKey === "string" ? config.apiKey : "";

    if (!apiKey) {
      log.error("[fathom-transcript] missing apiKey", {
        integrationId,
        tenantId,
      });
      return { skipped: true, reason: "missing apiKey" };
    }

    const { FathomAdapter } = await import("@/lib/meeting/providers/fathom");
    const adapter = new FathomAdapter();

    const raw = await step.run("fetch-transcript", () =>
      adapter.fetchTranscript(apiKey, meetingId)
    );

    const normalized = adapter.normalizeSummary(raw);

    // Consent fields only set on `create` — see fireflies-transcript.ts for why.
    const persisted = await step.run("persist-transcript", () =>
      database.meetingTranscript.upsert({
        where: { tenantId_meetingId: { tenantId, meetingId } },
        create: {
          tenantId,
          integrationId: integration.id,
          meetingId,
          title: normalized.title,
          rawSummary: normalized.rawSummary,
          status: "RECEIVED",
          ...(isStandingGranted
            ? {
                consentState: "GRANTED",
                consentGrantedRef: integration.standingConsentRef,
                consentGrantedAt: new Date(),
              }
            : {}),
        },
        update: {
          title: normalized.title,
          rawSummary: normalized.rawSummary,
        },
        select: { id: true, consentState: true },
      })
    );

    if (persisted.consentState !== "GRANTED") {
      return {
        ok: true,
        meetingId,
        transcriptId: persisted.id,
        skipped: true,
        reason: "consent not granted",
        consentState: persisted.consentState,
      };
    }

    await step.run("enqueue-mapping", () =>
      inngest.send({
        name: "integration/fireflies.transcript.ready",
        data: { tenantId, transcriptId: persisted.id },
      })
    );

    return { ok: true, meetingId, transcriptId: persisted.id };
  }
);

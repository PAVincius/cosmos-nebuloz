import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";
import {
  fetchFirefliesTranscript,
  normalizeFirefliesParticipants,
  normalizeFirefliesSummary,
} from "./fireflies-normalize";

type FirefliesWebhookData = {
  tenantId: string;
  integrationId: string;
  meetingId: string;
  clientReferenceId?: string;
};

export const fetchFirefliesTranscriptFn = inngest.createFunction(
  {
    id: "fireflies-transcript-fetch",
    triggers: [{ event: "integration/fireflies.webhook" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { tenantId, integrationId, meetingId } =
      event.data as FirefliesWebhookData;

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

    // Portão de consentimento (docs/compliance/consentimento-de-gravacao.md
    // §4/§7). Sob STANDING — com a declaração presente, obrigatória pela
    // CHECK constraint no schema — a transcrição nasce GRANTED, carimbada com
    // a declaração vigente, mas só quando também se sabe que não há
    // participante externo (ver isStandingGranted, calculado mais abaixo
    // depois que os participantes são normalizados). Sob PER_MEETING
    // (default) nasce PENDING; o schema já aplica esse default deny, mas
    // explicitamos a condição aqui porque é ela que decide, mais abaixo, se
    // o mapeador é enfileirado.
    const isStandingConsent =
      integration.consentMode === "STANDING" &&
      Boolean(integration.standingConsentRef);

    const { decryptConfigSecrets } = await import("@repo/security/encrypt");
    const config = decryptConfigSecrets(
      (integration.config ?? {}) as Record<string, unknown>
    );
    const apiKey = typeof config.apiKey === "string" ? config.apiKey : "";

    if (!apiKey) {
      log.error("[fireflies-transcript] missing apiKey", {
        integrationId,
        tenantId,
      });
      return { skipped: true, reason: "missing apiKey" };
    }

    // Throws on HTTP/GraphQL failure → Inngest retries with backoff.
    const transcript = await step.run("fetch-transcript", () =>
      fetchFirefliesTranscript(apiKey, meetingId)
    );

    const normalized = normalizeFirefliesSummary(transcript);
    const normalizedParticipants = normalizeFirefliesParticipants(transcript);

    // Passo 7 do §7: STANDING só libera sozinho quando se sabe que não há
    // participante externo. `known: false` (provedor não devolveu os campos,
    // ou resposta parcial) é desconhecido, não é "sem externo" — cai em
    // PENDING como PER_MEETING, fail closed.
    const knownNoExternalParticipant =
      normalizedParticipants.known &&
      !normalizedParticipants.participants.some((p) => p.isExternal);
    const isStandingGranted = isStandingConsent && knownNoExternalParticipant;

    // Idempotent upsert keyed by (tenantId, meetingId). Consent fields are
    // only set on `create` — a webhook retry (upsert → update path) must
    // never overwrite a later human decision (e.g. a revocation) with the
    // original automatic stamp.
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
          participantsKnown: normalizedParticipants.known,
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

    // Persiste participantes (passo 6). `skipDuplicates` torna isto seguro
    // em retry de webhook — não recria linhas nem falha na unique
    // constraint (transcriptId, email).
    if (normalizedParticipants.participants.length > 0) {
      await step.run("persist-participants", () =>
        database.meetingParticipant.createMany({
          data: normalizedParticipants.participants.map((p) => ({
            tenantId,
            transcriptId: persisted.id,
            email: p.email,
            name: p.name,
            isOrganizer: p.isOrganizer,
            isExternal: p.isExternal,
          })),
          skipDuplicates: true,
        })
      );
    }

    // O portão: o mapeador de IA só é enfileirado com consentimento GRANTED.
    // Sob PER_MEETING a transcrição fica PENDING e o pipeline para aqui —
    // alguém libera depois via grantConsent (actions/meeting/consent.ts).
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

    // Hand off to the AI mapper (story-049).
    await step.run("enqueue-mapping", () =>
      inngest.send({
        name: "integration/fireflies.transcript.ready",
        data: { tenantId, transcriptId: persisted.id },
      })
    );

    return { ok: true, meetingId, transcriptId: persisted.id };
  }
);

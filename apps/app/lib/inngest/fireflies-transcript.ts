import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";
import {
  fetchFirefliesTranscript,
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
        select: { id: true, status: true, config: true },
      })
    );

    if (!integration || integration.status !== "ACTIVE") {
      return { skipped: true, reason: "integration not active" };
    }

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

    // Idempotent upsert keyed by (tenantId, meetingId).
    await step.run("persist-transcript", () =>
      database.meetingTranscript.upsert({
        where: { tenantId_meetingId: { tenantId, meetingId } },
        create: {
          tenantId,
          integrationId: integration.id,
          meetingId,
          title: normalized.title,
          rawSummary: normalized.rawSummary,
          status: "RECEIVED",
        },
        update: {
          title: normalized.title,
          rawSummary: normalized.rawSummary,
        },
      })
    );

    return { ok: true, meetingId };
  }
);

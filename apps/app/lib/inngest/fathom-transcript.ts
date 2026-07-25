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
        },
        update: {
          title: normalized.title,
          rawSummary: normalized.rawSummary,
        },
        select: { id: true },
      })
    );

    await step.run("enqueue-mapping", () =>
      inngest.send({
        name: "integration/fireflies.transcript.ready",
        data: { tenantId, transcriptId: persisted.id },
      })
    );

    return { ok: true, meetingId, transcriptId: persisted.id };
  }
);

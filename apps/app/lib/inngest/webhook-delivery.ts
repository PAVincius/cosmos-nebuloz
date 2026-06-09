import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

type WebhookEventData = {
  endpointId: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  deliveryLogId: string;
};

// Exponential backoff: 2s, 4s, 8s, 16s, 32s (5 retries max)
export const deliverWebhookEvent = inngest.createFunction(
  {
    id: "webhook-delivery",
    triggers: [{ event: "webhook/event.dispatch" }],
    retries: 5,
  },
  async ({ event, step, attempt }) => {
    const { endpointId, tenantId, eventType, payload, deliveryLogId } =
      event.data as WebhookEventData;

    const endpoint = await step.run("fetch-endpoint", () =>
      database.webhookEndpoint.findUnique({
        where: { id: endpointId },
        select: { id: true, url: true, secretEnc: true, active: true },
      })
    );

    if (!endpoint?.active) {
      await database.webhookDeliveryLog.update({
        where: { id: deliveryLogId },
        data: { status: "FAILED_PERMANENTLY", attemptCount: attempt + 1 },
      });
      return { skipped: true, reason: "endpoint inactive" };
    }

    const { decryptSecret } = await import("@repo/security/encrypt");
    const secret = decryptSecret(endpoint.secretEnc);

    const body = JSON.stringify({ eventType, tenantId, data: payload });
    const signature = await computeHmacSignature(secret, body);

    const result = await step.run("send-request", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 10_000);
      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Cosmos-Signature": signature,
            "X-Cosmos-Event": eventType,
            "X-Cosmos-Delivery": deliveryLogId,
          },
          body,
          signal: controller.signal,
        });
        const responseBody = await res.text().catch(() => "");
        return { statusCode: res.status, responseBody };
      } finally {
        clearTimeout(timeout);
      }
    });

    const delivered = result.statusCode >= 200 && result.statusCode < 300;
    const finalAttempt = attempt >= 4;

    await database.webhookDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        responseCode: result.statusCode,
        responseBody: result.responseBody.slice(0, 2000),
        attemptCount: attempt + 1,
        status: delivered
          ? "DELIVERED"
          : finalAttempt
            ? "FAILED_PERMANENTLY"
            : "FAILED",
      },
    });

    if (!delivered) {
      const backoffMs = 2000 * 2 ** attempt;
      log.error("[webhook-delivery] attempt failed", {
        endpointId,
        statusCode: result.statusCode,
        attempt,
        backoffMs,
      });
      // Re-throw to trigger Inngest retry with exponential backoff
      throw new Error(
        `Webhook delivery failed: HTTP ${result.statusCode} (attempt ${attempt + 1})`
      );
    }

    return { delivered: true, statusCode: result.statusCode };
  }
);

async function computeHmacSignature(
  secret: string,
  body: string
): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(body).digest("hex");
}

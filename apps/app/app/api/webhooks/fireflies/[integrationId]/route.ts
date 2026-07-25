import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";
import { verifyFirefliesSignature } from "@/app/actions/integrations/webhooks/verify-signature";

const DEDUP_TTL_SECONDS = 172_800; // 48h

// Fireflies payload (Transcription completed). meetingId == transcriptId.
type FirefliesPayload = {
  meetingId?: string;
  eventType?: string;
  clientReferenceId?: string;
};

async function checkWebhookRateLimit(ip: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return true; // no limiter configured → allow (dev)
  }
  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(100, "1 m"),
    prefix: "webhook:fireflies",
  });
  const { success } = await limiter.limit(ip);
  return success;
}

// Fire-and-forget audit on invalid signature.
function logInvalidSignature(tenantId: string, ip: string): void {
  database.auditLog
    .create({
      data: {
        tenantId,
        action: "webhook.signature_invalid",
        actorId: null,
        actorType: "system",
        metadata: { actorIp: ip, source: "fireflies" },
      },
    })
    .catch((err) => {
      log.error("[webhook/fireflies] audit log write failed", {
        error: String(err),
      });
    });
}

// Redis SETNX dedup keyed by meetingId — returns true if already processed.
async function isAlreadyProcessed(meetingId: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { redis } = await import("@repo/rate-limit");
  const result = await redis.set(`webhook:fireflies:${meetingId}`, "1", {
    nx: true,
    ex: DEDUP_TTL_SECONDS,
  });
  return result === null; // null = key existed = already processed
}

async function enqueueToInngest(
  tenantId: string,
  integrationId: string,
  payload: FirefliesPayload
): Promise<void> {
  const { inngest } = await import("@/lib/inngest/client");
  await inngest.send({
    name: "integration/fireflies.webhook",
    data: {
      tenantId,
      integrationId,
      meetingId: payload.meetingId,
      clientReferenceId: payload.clientReferenceId,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!(await checkWebhookRateLimit(ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { integrationId } = await params;

  // Per-integration webhook URL: resolve tenant + secret from the integration.
  const integration = await database.meetingIntegration.findFirst({
    where: { id: integrationId, provider: "fireflies" },
    select: { id: true, tenantId: true, status: true, webhookSecret: true },
  });

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      {
        status: 404,
      }
    );
  }

  if (!integration.webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-hub-signature") ?? "";

  if (
    !verifyFirefliesSignature(rawBody, signature, integration.webhookSecret)
  ) {
    logInvalidSignature(integration.tenantId, ip);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString()) as FirefliesPayload;

  // PAUSED → DLQ, return 200 so Fireflies doesn't retry.
  if (integration.status === "PAUSED") {
    await database.webhookDlq.create({
      data: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        source: "FIREFLIES",
        webhookId: payload.meetingId ?? null,
        payload: {
          meetingId: payload.meetingId ?? null,
          eventType: payload.eventType ?? null,
          clientReferenceId: payload.clientReferenceId ?? null,
        },
      },
    });
    return NextResponse.json({ ok: true, queued: true });
  }

  if (integration.status !== "ACTIVE") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!payload.meetingId) {
    return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
  }

  if (await isAlreadyProcessed(payload.meetingId)) {
    return NextResponse.json({ ok: true }); // already processed
  }

  try {
    await enqueueToInngest(integration.tenantId, integration.id, payload);
  } catch (err) {
    log.error("[webhook/fireflies] inngest enqueue error", {
      error: String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/meeting/provider";

const DEDUP_TTL_SECONDS = 172_800; // 48h

type FathomPayload = {
  event?: string;
  call_id?: string;
};

async function checkWebhookRateLimit(ip: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return true;
  }
  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(100, "1 m"),
    prefix: "webhook:fathom",
  });
  const { success } = await limiter.limit(ip);
  return success;
}

async function isAlreadyProcessed(callId: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { redis } = await import("@repo/rate-limit");
  const result = await redis.set(`webhook:fathom:${callId}`, "1", {
    nx: true,
    ex: DEDUP_TTL_SECONDS,
  });
  return result === null;
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

  const integration = await database.meetingIntegration.findFirst({
    where: { id: integrationId, provider: "fathom" },
    select: { id: true, tenantId: true, status: true, webhookSecret: true },
  });

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  if (!integration.webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-fathom-webhook-signature") ?? "";
  const adapter = getProvider("fathom")!;

  if (!adapter.verifySignature(rawBody, signature, integration.webhookSecret)) {
    database.auditLog
      .create({
        data: {
          tenantId: integration.tenantId,
          action: "webhook.signature_invalid",
          actorId: null,
          actorType: "system",
          metadata: { actorIp: ip, source: "fathom" },
        },
      })
      .catch((err) => {
        log.error("[webhook/fathom] audit log write failed", {
          error: String(err),
        });
      });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString()) as FathomPayload;

  if (integration.status === "PAUSED") {
    await database.webhookDlq.create({
      data: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        source: "FATHOM",
        webhookId: payload.call_id ?? null,
        payload: {
          callId: payload.call_id ?? null,
          event: payload.event ?? null,
        },
      },
    });
    return NextResponse.json({ ok: true, queued: true });
  }

  if (integration.status !== "ACTIVE") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!payload.call_id) {
    return NextResponse.json({ error: "Missing call_id" }, { status: 400 });
  }

  if (await isAlreadyProcessed(payload.call_id)) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send({
      name: "integration/fathom.webhook",
      data: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        meetingId: payload.call_id,
      },
    });
  } catch (err) {
    log.error("[webhook/fathom] inngest enqueue error", {
      error: String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

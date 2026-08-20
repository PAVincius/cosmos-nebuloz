import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";
import { verifyLinearSignature } from "@/app/actions/integrations/webhooks/verify-signature";
import { checkReplayTimestamp } from "@/lib/security/replay-protection";

const DEDUP_TTL_SECONDS = 172_800; // 48h

type LinearPayload = {
  webhookId?: string;
  type?: string;
  action?: string;
  data?: unknown;
};

async function checkWebhookRateLimit(ip: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { createRateLimiter, fixedWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: fixedWindow(100, "1 m"),
    prefix: "webhook:linear",
  });
  const { success } = await limiter.limit(ip);
  return success;
}

// AC-003: write AuditLog on invalid signature (fire-and-forget)
function logInvalidSignature(tenantId: string, ip: string): void {
  database.auditLog
    .create({
      data: {
        tenantId,
        action: "webhook.signature_invalid",
        actorId: null,
        actorType: "system",
        metadata: { actorIp: ip, source: "linear" },
      },
    })
    .catch((err) => {
      log.error("[webhook/linear] audit log write failed", err);
    });
}

// Redis SETNX dedup — returns false if already processed
async function isAlreadyProcessed(webhookId: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { redis } = await import("@repo/rate-limit");
  const result = await redis.set(`webhook:linear:${webhookId}`, "1", {
    nx: true,
    ex: DEDUP_TTL_SECONDS,
  });
  return result === null; // null = key existed = already processed
}

async function enqueueToInngest(
  tenantId: string,
  integrationId: string,
  payload: LinearPayload
): Promise<void> {
  const { inngest } = await import("@/lib/inngest/client");
  await inngest.send({
    name: "integration/linear.webhook",
    data: { tenantId, integrationId, ...payload },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!(await checkWebhookRateLimit(ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature =
    req.headers.get("linear-signature") ??
    req.headers.get("x-hub-signature-256") ??
    "";

  if (!verifyLinearSignature(rawBody, signature, secret)) {
    logInvalidSignature(req.headers.get("x-cosmos-tenant-id") ?? "unknown", ip);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString()) as LinearPayload & {
    webhookTimestamp?: number;
  };

  // AC-004: replay protection — reject if timestamp outside ±300s
  if (payload.webhookTimestamp !== undefined) {
    const replayCheck = checkReplayTimestamp(
      payload.webhookTimestamp,
      Math.floor(Date.now() / 1000)
    );
    if (!replayCheck.valid) {
      return NextResponse.json(
        { code: replayCheck.code, message: replayCheck.message },
        { status: 401 }
      );
    }
  }

  const tenantId =
    req.headers.get("x-cosmos-tenant-id") ??
    process.env.DEFAULT_TENANT_ID ??
    "";

  if (!tenantId) {
    return NextResponse.json(
      { error: "Cannot resolve tenant" },
      { status: 400 }
    );
  }

  const integration = await database.integration.findFirst({
    where: { tenantId, source: "linear" },
    select: { id: true, status: true },
  });

  if (!integration) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  // AC-004: PAUSED → DLQ, return 200 so Linear doesn't retry
  if (integration.status === "PAUSED") {
    await database.webhookDlq.create({
      data: {
        tenantId,
        integrationId: integration.id,
        source: "LINEAR",
        webhookId: payload.webhookId ?? null,
        payload: payload as import("@repo/database").Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ ok: true, queued: true });
  }

  if (integration.status !== "ACTIVE") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (payload.webhookId && (await isAlreadyProcessed(payload.webhookId))) {
    return NextResponse.json({ ok: true }); // already processed
  }

  try {
    await enqueueToInngest(tenantId, integration.id, payload);
  } catch (err) {
    log.error("[webhook/linear] inngest enqueue error", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

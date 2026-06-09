import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";
import { verifyGitHubSignature } from "@/app/actions/integrations/webhooks/verify-signature";

const DEDUP_TTL_SECONDS = 172_800; // 48h

async function checkWebhookRateLimit(ip: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(100, "1 m"),
    prefix: "webhook:github",
  });
  const { success } = await limiter.limit(ip);
  return success;
}

// AC-007: write AuditLog on invalid signature (fire-and-forget)
function logInvalidSignature(tenantId: string, ip: string): void {
  database.auditLog
    .create({
      data: {
        tenantId,
        action: "webhook.signature_invalid",
        actorId: null,
        actorType: "system",
        metadata: { actorIp: ip, source: "github" },
      },
    })
    .catch((err) => {
      log.error("[webhook/github] audit log write failed", err);
    });
}

// AC-008: GitHub Delivery UUID idempotency (48h TTL)
async function isAlreadyProcessed(deliveryId: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { redis } = await import("@repo/rate-limit");
  const result = await redis.set(`webhook:github:${deliveryId}`, "1", {
    nx: true,
    ex: DEDUP_TTL_SECONDS,
  });
  return result === null;
}

async function enqueueToInngest(
  tenantId: string,
  integrationId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { inngest } = await import("@/lib/inngest/client");
  await inngest.send({
    name: "integration/github.webhook",
    data: { tenantId, integrationId, event, ...payload },
  });
}

async function routeToPausedDlq(
  tenantId: string,
  integrationId: string,
  deliveryId: string,
  rawBody: Buffer
): Promise<NextResponse> {
  const payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;
  await database.webhookDlq.create({
    data: {
      tenantId,
      integrationId,
      source: "GITHUB",
      webhookId: deliveryId || null,
      payload,
    },
  });
  return NextResponse.json({ ok: true, queued: true });
}

type DispatchArgs = {
  tenantId: string;
  integrationId: string;
  event: string;
  rawBody: Buffer;
  deliveryId: string;
};

async function dispatchEvent(args: DispatchArgs): Promise<NextResponse> {
  if (args.deliveryId && (await isAlreadyProcessed(args.deliveryId))) {
    return NextResponse.json({ ok: true }); // already processed
  }

  if (!["pull_request", "deployment_status"].includes(args.event)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payload = JSON.parse(args.rawBody.toString()) as Record<
    string,
    unknown
  >;
  try {
    await enqueueToInngest(
      args.tenantId,
      args.integrationId,
      args.event,
      payload
    );
  } catch (err) {
    log.error("[webhook/github] inngest enqueue error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!(await checkWebhookRateLimit(ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  if (!verifyGitHubSignature(rawBody, signature, secret)) {
    logInvalidSignature(req.headers.get("x-cosmos-tenant-id") ?? "unknown", ip);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const deliveryId = req.headers.get("x-github-delivery") ?? "";
  const event = req.headers.get("x-github-event") ?? "";
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
    where: { tenantId, source: "github" },
    select: { id: true, status: true },
  });

  if (!integration) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  if (integration.status === "PAUSED") {
    return routeToPausedDlq(tenantId, integration.id, deliveryId, rawBody);
  }

  if (integration.status !== "ACTIVE") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  return dispatchEvent({
    tenantId,
    integrationId: integration.id,
    event,
    rawBody,
    deliveryId,
  });
}

import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";
import {
  type GitHubWebhookPayload,
  handleGitHubWebhook,
} from "@/app/actions/integrations/sync/github-pull";
import { verifyGitHubSignature } from "@/app/actions/integrations/webhooks/verify-signature";

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
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") ?? "";
  if (event !== "issues") {
    // Only process issue events; ack everything else
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payload = JSON.parse(rawBody.toString()) as GitHubWebhookPayload;

  // Resolve tenantId from a header set by the webhook proxy/ingress,
  // or fall back to DEFAULT_TENANT_ID for single-tenant deployments.
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

  // Prevent tenant spoofing: verify tenantId has an active GitHub integration.
  const integration = await database.integration.findFirst({
    where: { tenantId, source: "github", status: "ACTIVE" },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  try {
    await handleGitHubWebhook(tenantId, payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[webhook/github] handler error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

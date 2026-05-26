import { type NextRequest, NextResponse } from "next/server";
import { verifyGitHubSignature } from "@/app/actions/integrations/webhooks/verify-signature";
import {
  handleGitHubWebhook,
  type GitHubWebhookPayload,
} from "@/app/actions/integrations/sync/github-pull";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
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
      { status: 400 },
    );
  }

  try {
    await handleGitHubWebhook(tenantId, payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/github] handler error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

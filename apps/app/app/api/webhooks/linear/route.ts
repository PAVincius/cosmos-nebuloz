import crypto from "node:crypto";
import { database, type LinearSync } from "@repo/database";
import { type NextRequest, NextResponse } from "next/server";
import { linearStateToStatus } from "@/app/actions/integrations/connectors/linear";

type LinearWebhookPayload = {
  type: string;
  action: string;
  data: {
    id: string;
    state?: { type: string };
    tenantId?: string;
    team?: { id: string };
  };
  organizationId?: string;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("linear-signature") ?? "";
  const secret = process.env.LINEAR_WEBHOOK_SECRET ?? "";

  if (!secret) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 500 }
    );
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as LinearWebhookPayload;

  if (
    payload.type === "Issue" &&
    payload.action === "update" &&
    payload.data.state
  ) {
    const syncs = await database.linearSync.findMany({
      where: {
        linearId: payload.data.id,
        linearType: "issue",
      },
    });

    const newStatusId = linearStateToStatus(payload.data.state.type);

    await Promise.all(
      syncs.map(async (sync: LinearSync) => {
        if (sync.cosmosType === "Feature") {
          await database.feature.update({
            where: { id: sync.cosmosId },
            data: { statusId: newStatusId },
          });
        }
        await database.linearSync.update({
          where: { id: sync.id },
          data: { lastSyncedAt: new Date() },
        });
      })
    );
  }

  return NextResponse.json({ ok: true });
}

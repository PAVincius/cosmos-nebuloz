"use server";

import { createHash, randomBytes } from "node:crypto";
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { encryptSecret } from "@repo/security/encrypt";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type WebhookView = {
  id: string;
  url: string;
  eventTypes: string[];
  active: boolean;
  lastDeliveryStatus: string | null;
  lastDeliveryAt: string | null;
};

export async function listWebhooks(): Promise<Result<WebhookView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.webhookEndpoint.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      // SECURITY: never select `secretHash`/`secretEnc` — signing secrets.
      select: {
        id: true,
        url: true,
        eventTypes: true,
        active: true,
        deliveryLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, createdAt: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      eventTypes: r.eventTypes,
      active: r.active,
      lastDeliveryStatus: r.deliveryLogs[0]?.status ?? null,
      lastDeliveryAt: r.deliveryLogs[0]?.createdAt.toISOString() ?? null,
    }));
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const CreateWebhookSchema = z.object({
  url: z.string().url().max(2048),
  eventTypes: z.array(z.string().min(1).max(100)).min(1).max(20),
});

export type CreatedWebhook = {
  id: string;
  // SECURITY: plaintext HMAC secret — present ONLY in this create response.
  // Never persisted in plaintext and never returned again by any other action.
  secret: string;
};

export async function createWebhook(
  input: z.input<typeof CreateWebhookSchema>
): Promise<Result<CreatedWebhook>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);
    // Zod strips any unrecognized key (e.g. a client-supplied `secret`) —
    // the schema has no `secret` field, so one can never reach this action.
    const { url, eventTypes } = CreateWebhookSchema.parse(input);

    // SECURITY: the signing secret is generated server-side only. It is
    // never accepted as client input, never stored in plaintext, and is
    // returned to the caller exactly once (this response) so the UI can
    // show/copy it — it cannot be retrieved again afterwards.
    const secret = randomBytes(32).toString("hex");
    const secretHash = createHash("sha256").update(secret).digest("hex");
    const secretEnc = encryptSecret(secret);

    const created = await database.webhookEndpoint.create({
      data: {
        tenantId: ctx.tenantId,
        url,
        eventTypes,
        secretHash,
        secretEnc,
        createdBy: ctx.userId,
      },
      select: { id: true },
    });

    // SECURITY: diff must never include the secret, secretHash, or secretEnc.
    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "webhook",
      entityId: created.id,
      diff: { url, eventTypes: eventTypes.join(",") },
    });
    revalidateTag(`webhooks:${ctx.tenantId}`, "max");

    return { id: created.id, secret };
  });
}

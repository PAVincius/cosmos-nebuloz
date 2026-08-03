"use server";

import { createHash, randomBytes } from "node:crypto";
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { encryptSecret } from "@repo/security/encrypt";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import {
  DEGRADED_AFTER_CONSECUTIVE_FAILURES,
  DELIVERY_HEALTH_WINDOW,
  FAILING_DELIVERY_STATUSES,
  TEST_EVENT_TYPE,
} from "./webhooks.constants";

export type WebhookView = {
  id: string;
  url: string;
  eventTypes: string[];
  active: boolean;
  lastDeliveryStatus: string | null;
  lastDeliveryCode: number | null;
  lastDeliveryAt: string | null;
  /** falhas seguidas contadas da entrega mais recente para trás */
  consecutiveFailures: number;
  degraded: boolean;
};

// Uma falha isolada é ruído de rede; três seguidas são um endpoint quebrado.
// O FR-020 AC-006 usa exatamente esse limiar para marcar a integração como
// DEGRADED, e contar da entrega mais recente para trás é o que distingue "está
// falhando agora" de "já falhou algum dia".
function countConsecutiveFailures(logs: { status: string }[]): number {
  let n = 0;
  for (const log of logs) {
    if (!FAILING_DELIVERY_STATUSES.has(log.status)) {
      break;
    }
    n++;
  }
  return n;
}

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
          take: DELIVERY_HEALTH_WINDOW,
          select: { status: true, responseCode: true, createdAt: true },
        },
      },
    });
    return rows.map((r) => {
      const consecutiveFailures = countConsecutiveFailures(r.deliveryLogs);
      return {
        id: r.id,
        url: r.url,
        eventTypes: r.eventTypes,
        active: r.active,
        lastDeliveryStatus: r.deliveryLogs[0]?.status ?? null,
        lastDeliveryCode: r.deliveryLogs[0]?.responseCode ?? null,
        lastDeliveryAt: r.deliveryLogs[0]?.createdAt.toISOString() ?? null,
        consecutiveFailures,
        degraded: consecutiveFailures >= DEGRADED_AFTER_CONSECUTIVE_FAILURES,
      };
    });
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

const SetWebhookActiveSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

/**
 * Pausa/retoma um endpoint. `WebhookEndpoint.active` já era respeitado pelo
 * worker de entrega (`lib/inngest/webhook-delivery.ts` marca a entrega como
 * FAILED_PERMANENTLY quando o endpoint está inativo), mas nada no produto
 * escrevia o campo: um endpoint quebrado só podia ser desligado no banco.
 */
export async function setWebhookActive(
  input: z.infer<typeof SetWebhookActiveSchema>
): Promise<Result<{ id: string; active: boolean }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);
    const { id, active } = SetWebhookActiveSchema.parse(input);

    // Guarda IDOR — id vindo do cliente é reconferido dentro do tenant.
    const existing = await database.webhookEndpoint.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, active: true },
    });
    if (!existing) {
      throw new Error("Webhook não encontrado.");
    }

    await database.webhookEndpoint.update({
      where: { id },
      data: { active },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "webhook",
      entityId: id,
      diff: { active: `${existing.active}→${active}` },
    });
    revalidateTag(`webhooks:${ctx.tenantId}`, "max");

    return { id, active };
  });
}

const SendTestWebhookSchema = z.object({ id: z.string().min(1) });

/**
 * Dispara um evento sintético `ping` no endpoint (story-037 AC-004). Grava o
 * WebhookDeliveryLog com `synthetic: true` — sem essa marca um teste manual
 * entraria na saúde do endpoint como tráfego de produção — e enfileira o mesmo
 * job de entrega usado pelos eventos reais, para o teste exercitar assinatura
 * HMAC, timeout e política de retry de verdade, e não um caminho paralelo.
 */
export async function sendTestWebhook(
  input: z.infer<typeof SendTestWebhookSchema>
): Promise<Result<{ deliveryLogId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);
    const { id } = SendTestWebhookSchema.parse(input);

    const endpoint = await database.webhookEndpoint.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, active: true },
    });
    if (!endpoint) {
      throw new Error("Webhook não encontrado.");
    }
    // O worker recusa endpoint inativo e marca a entrega como
    // FAILED_PERMANENTLY. Enfileirar assim sujaria o histórico com uma falha
    // que não diz nada sobre o endpoint.
    if (!endpoint.active) {
      throw new Error(
        "Webhook pausado — retome o endpoint antes de disparar um teste."
      );
    }

    const payload = {
      test: true,
      sentAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
    };

    const deliveryLog = await database.webhookDeliveryLog.create({
      data: {
        endpointId: endpoint.id,
        tenantId: ctx.tenantId,
        eventType: TEST_EVENT_TYPE,
        requestBody: payload,
        synthetic: true,
        status: "PENDING",
      },
      select: { id: true },
    });

    await inngest.send({
      name: "webhook/event.dispatch",
      data: {
        endpointId: endpoint.id,
        tenantId: ctx.tenantId,
        eventType: TEST_EVENT_TYPE,
        payload,
        deliveryLogId: deliveryLog.id,
      },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "webhook",
      entityId: endpoint.id,
      diff: { testDelivery: deliveryLog.id, eventType: TEST_EVENT_TYPE },
    });
    revalidateTag(`webhooks:${ctx.tenantId}`, "max");

    return { deliveryLogId: deliveryLog.id };
  });
}

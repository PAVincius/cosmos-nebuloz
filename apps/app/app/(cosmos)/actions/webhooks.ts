"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type WebhookView = {
  id: string;
  url: string;
  eventTypes: string[];
  active: boolean;
};

export async function listWebhooks(): Promise<Result<WebhookView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.webhookEndpoint.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      // SECURITY: never select `secretHash`/`secretEnc` — signing secrets.
      select: { id: true, url: true, eventTypes: true, active: true },
    });
    return rows;
  });
}

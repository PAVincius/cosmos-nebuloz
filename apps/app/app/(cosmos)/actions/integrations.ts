"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type IntegrationView = {
  id: string;
  source: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
};

export async function listIntegrations(): Promise<Result<IntegrationView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.integration.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      // SECURITY: never select `config` or `mapping` — they hold API
      // keys/tokens and internal field mappings, not for client display.
      select: {
        id: true,
        source: true,
        name: true,
        status: true,
        lastSyncAt: true,
      },
    });
    return rows.map((i) => ({
      id: i.id,
      source: i.source,
      name: i.name,
      status: i.status,
      lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
    }));
  });
}

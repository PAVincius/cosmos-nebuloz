"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { encryptConfigSecrets } from "@repo/security/encrypt";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "@/app/actions/_base";
import { inngest } from "@/lib/inngest/client";

const BILLING_SOURCES = [
  "billing_aws",
  "billing_gcp",
  "billing_azure",
] as const;

const CreateBillingIntegrationSchema = z.object({
  source: z.enum(BILLING_SOURCES),
  name: z.string().min(1).max(255).trim(),
  config: z.record(z.string(), z.unknown()),
});

export async function createBillingIntegration(
  input: z.infer<typeof CreateBillingIntegrationSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateBillingIntegrationSchema.parse(input);

    const integration = await database.integration.create({
      data: {
        tenantId: ctx.tenantId,
        source: data.source,
        name: data.name,
        // O adapter da AWS hoje guarda só roleArn/externalId, que não são
        // campos secretos — para ele isto é no-op. Está aqui porque o schema
        // aceita config livre e `billing_gcp`/`billing_azure` já são fontes
        // declaradas: quando elas trouxerem chave de service account ou client
        // secret, o caminho já cifra em vez de gravar em claro.
        config: encryptConfigSecrets(data.config) as Record<string, string>,
        status: "ACTIVE",
      },
    });

    revalidatePath("/settings/integrations");
    return { id: integration.id };
  });
}

async function listBillingIntegrations(): Promise<
  Result<
    Array<{
      id: string;
      name: string;
      source: string;
      status: string;
      lastSyncAt: Date | null;
    }>
  >
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.integration.findMany({
      where: { tenantId: ctx.tenantId, source: { in: [...BILLING_SOURCES] } },
      select: {
        id: true,
        name: true,
        source: true,
        status: true,
        lastSyncAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });
}

async function triggerManualSync(
  integrationId: string
): Promise<Result<{ eventId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const integration = await database.integration.findFirst({
      where: { id: integrationId, tenantId: ctx.tenantId },
    });
    if (!integration) {
      throw new Error("Integration not found");
    }

    const result = await inngest.send({
      name: "billing/sync.requested" as string,
      data: { tenantId: ctx.tenantId, integrationId },
    });

    return { eventId: result.ids[0] ?? "" };
  });
}

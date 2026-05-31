"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
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
        // biome-ignore lint/suspicious/noExplicitAny: Prisma Json column requires cast from z.record unknown values
        config: data.config as any,
        status: "ACTIVE",
      },
    });

    revalidatePath("/settings/integrations");
    return { id: integration.id };
  });
}

export async function listBillingIntegrations(): Promise<
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

export async function triggerManualSync(
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

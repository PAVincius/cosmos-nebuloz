import { database } from "@repo/database";
import { upsertLinearMapping } from "./sync-mapping";

export type LinearWebhookPayload = {
  action: "create" | "update" | "remove";
  type: "Issue" | "Project" | "Cycle";
  data: {
    id: string;
    title?: string;
    description?: string;
    state?: { name: string };
    updatedAt?: string;
    team?: { id: string };
    project?: { id: string };
  };
  organizationId?: string;
};

export async function handleLinearWebhook(
  tenantId: string,
  payload: LinearWebhookPayload
): Promise<void> {
  if (payload.action === "remove") {
    return;
  }
  if (payload.type !== "Issue") {
    return; // Only sync Issues for now
  }

  const { data } = payload;
  if (!data.title) {
    return;
  }

  // Look up via mapping table first (most reliable)
  const mapping = await database.linearSync.findFirst({
    where: { tenantId, linearId: data.id, linearType: "issue" },
  });

  if (mapping) {
    // Update the mapped Cosmos Story
    await database.story.updateMany({
      where: { id: mapping.cosmosId, tenantId },
      data: {
        title: data.title,
        description: data.description ?? null,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
    return;
  }

  // Fall back: check externalId on Story
  const existing = await database.story.findFirst({
    where: { tenantId, externalId: data.id, externalSource: "linear" },
    select: { id: true },
  });

  if (existing) {
    await database.story.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description ?? null,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
    // Backfill mapping so future updates go through mapping table
    await upsertLinearMapping({
      tenantId,
      linearId: data.id,
      linearType: "issue",
      cosmosId: existing.id,
      cosmosType: "Story",
    });
    return;
  }

  // New issue — create a Story and mapping
  const created = await database.story.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description ?? null,
      externalId: data.id,
      externalSource: "linear",
      status: "BACKLOG",
    },
    select: { id: true },
  });

  await upsertLinearMapping({
    tenantId,
    linearId: data.id,
    linearType: "issue",
    cosmosId: created.id,
    cosmosType: "Story",
  });
}

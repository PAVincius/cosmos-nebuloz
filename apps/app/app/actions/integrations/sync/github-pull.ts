import { database } from "@repo/database";

export type GitHubWebhookPayload = {
  action: "opened" | "edited" | "closed" | "deleted" | "reopened";
  issue?: {
    number: number;
    title: string;
    body?: string;
    updated_at: string;
    state: "open" | "closed";
  };
  repository?: {
    full_name: string;
  };
};

export async function handleGitHubWebhook(
  tenantId: string,
  payload: GitHubWebhookPayload
): Promise<void> {
  if (!(payload.issue && payload.repository)) {
    return;
  }
  if (payload.action === "deleted") {
    return;
  }

  const { issue, repository } = payload;

  const mapping = await database.gitHubSync.findFirst({
    where: {
      tenantId,
      githubRepo: repository.full_name,
      githubNumber: issue.number,
      githubType: "issue",
    },
  });

  // Unknown issue — don't auto-create Cosmos entries from GitHub
  if (!mapping) {
    return;
  }

  // Update the mapped Cosmos entity
  if (mapping.cosmosType === "Epic") {
    await database.epic.updateMany({
      where: { id: mapping.cosmosId, tenantId },
      data: {
        title: issue.title,
        descriptionMd: issue.body ?? null,
      },
    });
    return;
  }

  if (mapping.cosmosType === "Feature") {
    await database.feature.updateMany({
      where: { id: mapping.cosmosId, tenantId },
      data: {
        title: issue.title,
      },
    });
    return;
  }

  if (mapping.cosmosType === "Story") {
    await database.story.updateMany({
      where: { id: mapping.cosmosId, tenantId },
      data: {
        title: issue.title,
        description: issue.body ?? null,
      },
    });
  }
}

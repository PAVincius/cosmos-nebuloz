import { database } from "@repo/database";
import { log } from "@repo/observability/log";

export async function pushEpicToGitHub(args: {
  tenantId: string;
  epicId: string;
  githubToken: string;
}): Promise<void> {
  const mapping = await database.gitHubSync.findFirst({
    where: {
      tenantId: args.tenantId,
      cosmosId: args.epicId,
      cosmosType: "Epic",
    },
  });
  if (!mapping) {
    return; // No mapping — nothing to push
  }

  const epic = await database.epic.findFirst({
    where: { id: args.epicId, tenantId: args.tenantId },
    select: { title: true, descriptionMd: true },
  });
  if (!epic) {
    return;
  }

  const [owner, repo] = mapping.githubRepo.split("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${mapping.githubNumber}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: epic.title,
      body: epic.descriptionMd ?? "",
    }),
  });

  if (!response.ok) {
    log.error("[github-push] API error", {
      status: response.status,
      epicId: args.epicId,
    });
  }

  await database.gitHubSync.update({
    where: { id: mapping.id },
    data: { lastSyncedAt: new Date() },
  });
}

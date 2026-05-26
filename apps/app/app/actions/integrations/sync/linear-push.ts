import { database } from "@repo/database";

const LINEAR_GQL = "https://api.linear.app/graphql";

export async function pushEpicToLinear(args: {
  tenantId: string;
  epicId: string;
  linearApiKey: string;
}): Promise<void> {
  const mapping = await database.linearSync.findFirst({
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

  const mutation = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success }
    }
  `;

  const response = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: args.linearApiKey,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        id: mapping.linearId,
        input: {
          title: epic.title,
          description: epic.descriptionMd ?? "",
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("[linear-push] API error", {
      status: response.status,
      epicId: args.epicId,
    });
  }

  await database.linearSync.update({
    where: { id: mapping.id },
    data: { lastSyncedAt: new Date() },
  });
}

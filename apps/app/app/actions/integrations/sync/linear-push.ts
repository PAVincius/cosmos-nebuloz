// Story-024 AC-007: Outbound Cosmos→Linear push
// Only cosmos:* namespaced labels/milestones are created/updated; others preserved.

import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { mapCosmosStatusToLinear } from "@/lib/integrations/merge-policy";

const LINEAR_GQL = "https://api.linear.app/graphql";

// AC-007: only cosmos:* namespace labels are touched
const COSMOS_LABEL_PREFIX = "cosmos:";

async function linearMutation(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ ok: boolean }> {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    log.error("[linear-push] API error", { status: res.status });
    return { ok: false };
  }
  return { ok: true };
}

async function pushStoryStatusToLinear(args: {
  tenantId: string;
  storyId: string;
  newStatus: string;
  linearApiKey: string;
}): Promise<void> {
  const mapping = await database.linearSync.findFirst({
    where: {
      tenantId: args.tenantId,
      cosmosId: args.storyId,
      cosmosType: "Story",
    },
  });
  if (!mapping) {
    return;
  }

  const linearStateName = mapCosmosStatusToLinear(args.newStatus);

  // Fetch the Linear team's states to resolve name → stateId
  const statesQuery = `
    query StoryState($issueId: String!) {
      issue(id: $issueId) { team { states { nodes { id name } } } }
    }
  `;
  const statesRes = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: args.linearApiKey,
    },
    body: JSON.stringify({
      query: statesQuery,
      variables: { issueId: mapping.linearId },
    }),
  });

  if (!statesRes.ok) {
    return;
  }

  const statesJson = (await statesRes.json()) as {
    data?: {
      issue?: {
        team?: { states?: { nodes?: Array<{ id: string; name: string }> } };
      };
    };
  };
  const states = statesJson.data?.issue?.team?.states?.nodes ?? [];
  const targetState = states.find((s) => s.name === linearStateName);
  if (!targetState) {
    return;
  }

  const updateMutation = `
    mutation UpdateIssueStatus($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }
  `;
  await linearMutation(args.linearApiKey, updateMutation, {
    id: mapping.linearId,
    stateId: targetState.id,
  });

  await database.linearSync.update({
    where: { id: mapping.id },
    data: { lastSyncedAt: new Date() },
  });
}

async function pushCosmosLabelToLinear(args: {
  tenantId: string;
  storyId: string;
  labelKey: string; // must be cosmos:* namespaced
  labelValue: string;
  linearApiKey: string;
}): Promise<void> {
  // AC-007: only create/update cosmos:* labels — reject others
  if (!args.labelKey.startsWith(COSMOS_LABEL_PREFIX)) {
    log.error("[linear-push] attempted to push non-cosmos: label", {
      labelKey: args.labelKey,
    });
    return;
  }

  const mapping = await database.linearSync.findFirst({
    where: {
      tenantId: args.tenantId,
      cosmosId: args.storyId,
      cosmosType: "Story",
    },
  });
  if (!mapping) {
    return;
  }

  const labelName = `${args.labelKey}=${args.labelValue}`;
  const mutation = `
    mutation CreateLabel($teamId: String!, $name: String!) {
      issueLabelCreate(input: { teamId: $teamId, name: $name, color: "#6366f1" }) { issueLabel { id } }
    }
  `;
  await linearMutation(args.linearApiKey, mutation, {
    teamId: mapping.metadata
      ? ((mapping.metadata as Record<string, string>).linearTeamId ?? "")
      : "",
    name: labelName,
  });
}

// Legacy: push epic title/description (preserved from prior implementation)
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
    return;
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
  await linearMutation(args.linearApiKey, mutation, {
    id: mapping.linearId,
    input: { title: epic.title, description: epic.descriptionMd ?? "" },
  });

  await database.linearSync.update({
    where: { id: mapping.id },
    data: { lastSyncedAt: new Date() },
  });
}

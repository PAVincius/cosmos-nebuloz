import type { MigrationItem } from "./types";

export type AzureConfig = {
  organization: string;
  project: string;
  pat: string;
};

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

function baseUrl(org: string): string {
  return `https://dev.azure.com/${org}`;
}

export async function testAzureConnection(config: AzureConfig): Promise<void> {
  const res = await fetch(
    `${baseUrl(config.organization)}/_apis/projects?api-version=7.0`,
    { headers: { Authorization: authHeader(config.pat) } }
  );
  if (!res.ok) {
    throw new Error(
      `Azure DevOps connection failed: ${res.status} ${res.statusText}`
    );
  }
}

export async function discoverAzureProjects(
  config: AzureConfig
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(
    `${baseUrl(config.organization)}/_apis/projects?api-version=7.0`,
    { headers: { Authorization: authHeader(config.pat) } }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Azure projects: ${res.statusText}`);
  }
  const data = (await res.json()) as { value: { id: string; name: string }[] };
  return data.value;
}

export async function fetchAzureWorkItems(
  config: AzureConfig
): Promise<MigrationItem[]> {
  const wiqlRes = await fetch(
    `${baseUrl(config.organization)}/${config.project}/_apis/wit/wiql?api-version=7.0`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(config.pat),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project ORDER BY [System.CreatedDate] DESC",
      }),
    }
  );
  if (!wiqlRes.ok) {
    throw new Error("Failed to query Azure work items");
  }

  const wiql = (await wiqlRes.json()) as { workItems: { id: number }[] };
  const ids = wiql.workItems.slice(0, 200).map((w) => w.id);
  if (!ids.length) {
    return [];
  }

  const detailRes = await fetch(
    `${baseUrl(config.organization)}/_apis/wit/workitems?ids=${ids.join(",")}&fields=System.Title,System.Description,System.WorkItemType,System.State,Microsoft.VSTS.Common.StoryPoints&api-version=7.0`,
    { headers: { Authorization: authHeader(config.pat) } }
  );
  if (!detailRes.ok) {
    throw new Error("Failed to fetch Azure work item details");
  }

  const detail = (await detailRes.json()) as {
    value: { id: number; fields: Record<string, unknown> }[];
  };

  const typeMap: Record<string, "epic" | "feature" | "story"> = {
    Epic: "epic",
    Feature: "feature",
    "User Story": "story",
    Task: "story",
    Bug: "story",
  };

  return detail.value.map((wi) => ({
    type:
      typeMap[(wi.fields["System.WorkItemType"] as string) ?? ""] ?? "story",
    title: (wi.fields["System.Title"] as string) ?? "",
    description: (wi.fields["System.Description"] as string) ?? undefined,
    status: (wi.fields["System.State"] as string) ?? undefined,
    storyPoints:
      (wi.fields["Microsoft.VSTS.Common.StoryPoints"] as number) ?? undefined,
    externalId: String(wi.id),
  }));
}

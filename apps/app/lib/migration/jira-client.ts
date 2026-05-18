import type { MigrationItem } from "./types";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKeys?: string[];
}

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

export async function testJiraConnection(config: JiraConfig): Promise<void> {
  const res = await fetch(`${config.baseUrl}/rest/api/2/myself`, {
    headers: {
      Authorization: authHeader(config.email, config.apiToken),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Jira connection failed: ${res.status} ${res.statusText}`);
  }
}

export async function discoverJiraProjects(
  config: JiraConfig
): Promise<{ key: string; name: string }[]> {
  const res = await fetch(`${config.baseUrl}/rest/api/2/project`, {
    headers: { Authorization: authHeader(config.email, config.apiToken) },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Jira projects: ${res.statusText}`);
  }
  const data = (await res.json()) as { key: string; name: string }[];
  const keys = config.projectKeys;
  return keys?.length ? data.filter((p) => keys.includes(p.key)) : data;
}

export async function fetchJiraItems(
  config: JiraConfig,
  projectKey: string
): Promise<MigrationItem[]> {
  const jql = `project = ${projectKey} ORDER BY created DESC`;
  const res = await fetch(
    `${config.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=500&fields=summary,description,issuetype,status,story_points,parent,customfield_10016`,
    { headers: { Authorization: authHeader(config.email, config.apiToken) } }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Jira issues: ${res.statusText}`);
  }
  const data = (await res.json()) as {
    issues: { id: string; fields: Record<string, unknown> }[];
  };

  const typeMap: Record<string, "epic" | "feature" | "story"> = {
    epic: "epic",
    story: "story",
    "sub-task": "story",
    task: "story",
  };

  return data.issues.map((issue) => {
    const fields = issue.fields;
    const issueType = (
      (fields.issuetype as { name?: string })?.name ?? "story"
    ).toLowerCase();

    return {
      type: typeMap[issueType] ?? "story",
      title: (fields.summary as string) ?? "",
      description: (fields.description as string) ?? undefined,
      status: (fields.status as { name?: string })?.name ?? undefined,
      storyPoints:
        (fields.story_points as number) ??
        (fields.customfield_10016 as number) ??
        undefined,
      parentTitle:
        (fields.parent as { fields?: { summary?: string } })?.fields
          ?.summary ?? undefined,
      externalId: issue.id,
    };
  });
}

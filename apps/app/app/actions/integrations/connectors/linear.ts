const LINEAR_GQL = "https://api.linear.app/graphql";

async function linearQuery<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Linear API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LinearTeam = { id: string; name: string; key: string };

export type LinearIssue = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  state: { name: string; type: string };
  priority: number;
  estimate: number | null;
  assignee: { id: string; name: string; email: string } | null;
  team: { id: string; name: string };
  labels: { nodes: { name: string }[] };
  parent: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
};

// ─── testConnection ───────────────────────────────────────────────────────────

export async function linearTestConnection(
  apiKey: string
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const data = await linearQuery<{ viewer: { id: string; name: string } }>(
      apiKey,
      "{ viewer { id name } }"
    );
    return { ok: true, name: data.viewer.name };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

// ─── discoverProjects (teams in Linear) ──────────────────────────────────────

export async function linearDiscoverTeams(
  apiKey: string
): Promise<LinearTeam[]> {
  const data = await linearQuery<{ teams: { nodes: LinearTeam[] } }>(
    apiKey,
    "{ teams { nodes { id name key } } }"
  );
  return data.teams.nodes;
}

// ─── importSnapshot ──────────────────────────────────────────────────────────

const ISSUE_FIELDS = `
  id title description url
  state { name type }
  priority estimate
  assignee { id name email }
  team { id name }
  labels { nodes { name } }
  parent { id title }
  createdAt updatedAt
`;

export async function linearImportTeamIssues(
  apiKey: string,
  teamId: string,
  after?: string
): Promise<{ issues: LinearIssue[]; nextCursor: string | null }> {
  const data = await linearQuery<{
    team: {
      issues: {
        nodes: LinearIssue[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  }>(
    apiKey,
    `query TeamIssues($teamId: String!, $after: String) {
      team(id: $teamId) {
        issues(first: 100, after: $after, filter: { state: { type: { nin: ["cancelled"] } } }) {
          nodes { ${ISSUE_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    { teamId, after: after ?? null }
  );

  const { nodes, pageInfo } = data.team.issues;
  return {
    issues: nodes,
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  };
}

// ─── Map Linear state → Cosmos statusId ──────────────────────────────────────

const STATE_TYPE_MAP: Record<string, string> = {
  backlog: "BACKLOG",
  unstarted: "TODO",
  started: "IN_PROGRESS",
  completed: "DONE",
  cancelled: "CANCELLED",
};

export function linearStateToStatus(stateType: string): string {
  return STATE_TYPE_MAP[stateType.toLowerCase()] ?? "BACKLOG";
}

// ─── Map Linear priority → Cosmos type hint ──────────────────────────────────

export function linearPriorityLabel(priority: number): string {
  return (
    ["No priority", "Urgent", "High", "Medium", "Low"][priority] ??
    "No priority"
  );
}

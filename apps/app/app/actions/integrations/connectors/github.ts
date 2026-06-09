const GITHUB_GQL = "https://api.github.com/graphql";

async function githubQuery<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(GITHUB_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "cosmos-nebuloz/1.0",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
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

export type GitHubViewer = { login: string; name: string | null };

export type GitHubProject = {
  id: string;
  title: string;
  url: string;
  number: number;
};

export type GitHubProjectItem = {
  id: string;
  type: string; // ISSUE | PULL_REQUEST | DRAFT_ISSUE
  content: {
    __typename: string;
    title: string;
    body: string | null;
    url: string;
    number: number;
    state: string; // OPEN | CLOSED | MERGED
    assignees: { nodes: { login: string; name: string | null }[] };
    labels: { nodes: { name: string }[] };
    createdAt: string;
    updatedAt: string;
  } | null;
  fieldValues: {
    nodes: {
      __typename: string;
      name?: string; // SingleSelectFieldValue
      text?: string; // TextFieldValue
      number?: number; // NumberFieldValue
      field: { name: string };
    }[];
  };
};

// ─── testConnection ───────────────────────────────────────────────────────────

export async function githubTestConnection(
  token: string
): Promise<{ ok: boolean; login?: string; error?: string }> {
  try {
    const data = await githubQuery<{ viewer: GitHubViewer }>(
      token,
      "{ viewer { login name } }"
    );
    return { ok: true, login: data.viewer.login };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

// ─── discoverProjects ─────────────────────────────────────────────────────────

export async function githubDiscoverProjects(
  token: string,
  org: string
): Promise<GitHubProject[]> {
  const data = await githubQuery<{
    organization: { projectsV2: { nodes: GitHubProject[] } } | null;
    user: { projectsV2: { nodes: GitHubProject[] } } | null;
  }>(
    token,
    `query DiscoverProjects($login: String!) {
      organization(login: $login) {
        projectsV2(first: 50) {
          nodes { id title url number }
        }
      }
      user(login: $login) {
        projectsV2(first: 50) {
          nodes { id title url number }
        }
      }
    }`,
    { login: org }
  );

  const orgProjects = data.organization?.projectsV2.nodes ?? [];
  const userProjects = data.user?.projectsV2.nodes ?? [];
  const seen = new Set<string>();
  return [...orgProjects, ...userProjects].filter((p) => {
    if (seen.has(p.id)) {
      return false;
    }
    seen.add(p.id);
    return true;
  });
}

// ─── importSnapshot ──────────────────────────────────────────────────────────

export async function githubImportProjectItems(
  token: string,
  projectId: string,
  after?: string
): Promise<{ items: GitHubProjectItem[]; nextCursor: string | null }> {
  const data = await githubQuery<{
    node: {
      items: {
        nodes: GitHubProjectItem[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  }>(
    token,
    `query ProjectItems($projectId: ID!, $after: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100, after: $after) {
            nodes {
              id type
              content {
                __typename
                ... on Issue {
                  title body url number state
                  assignees(first: 5) { nodes { login name } }
                  labels(first: 10) { nodes { name } }
                  createdAt updatedAt
                }
                ... on PullRequest {
                  title body url number state
                  assignees(first: 5) { nodes { login name } }
                  labels(first: 10) { nodes { name } }
                  createdAt updatedAt
                }
              }
              fieldValues(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldSingleSelectValue { name field { name } }
                  ... on ProjectV2ItemFieldTextValue         { text  field { name } }
                  ... on ProjectV2ItemFieldNumberValue       { number field { name } }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }`,
    { projectId, after: after ?? null }
  );

  const { nodes, pageInfo } = data.node.items;
  return {
    items: nodes,
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  };
}

// ─── Map GitHub state → Cosmos statusId ──────────────────────────────────────

export function githubStateToStatus(state: string): string {
  if (state === "CLOSED" || state === "MERGED") {
    return "DONE";
  }
  return "IN_PROGRESS";
}

// Story-024 AC-006: cursor-resumable full pull (250/page)

import { database } from "@repo/database";
import { handleLinearWebhook, type LinearWebhookPayload } from "./linear-pull";

const PAGE_SIZE = 250;

type LinearIssueNode = {
  id: string;
  title: string;
  description?: string;
  state?: { name: string };
  assignee?: { id: string } | null;
  updatedAt?: string;
};

type LinearIssuesPage = {
  nodes: LinearIssueNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

async function fetchLinearIssuesPage(opts: {
  apiKey: string;
  teamId: string;
  after?: string | null;
}): Promise<LinearIssuesPage> {
  const query = `
    query Issues($teamId: String!, $first: Int!, $after: String) {
      team(id: $teamId) {
        issues(first: $first, after: $after, orderBy: updatedAt) {
          nodes { id title description state { name } assignee { id } updatedAt }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: opts.apiKey,
    },
    body: JSON.stringify({
      query,
      variables: {
        teamId: opts.teamId,
        first: PAGE_SIZE,
        after: opts.after ?? null,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`LINEAR_API_ERROR: status=${res.status}`);
  }

  const json = (await res.json()) as {
    data?: { team?: { issues?: LinearIssuesPage } };
  };
  const page = json.data?.team?.issues;
  if (!page) {
    throw new Error("LINEAR_API_ERROR: unexpected response shape");
  }
  return page;
}

type FullPullOptions = {
  tenantId: string;
  integrationId: string;
  teamId: string;
  apiKey: string;
  resumeCursor?: string | null; // AC-006: resume from cursor on interruption
};

type FullPullResult = {
  itemsProcessed: number;
  cursor: string | null;
  complete: boolean;
};

export async function triggerLinearFullPull(
  opts: FullPullOptions
): Promise<FullPullResult> {
  let cursor = opts.resumeCursor ?? null;
  let itemsProcessed = 0;
  let hasNext = true;

  while (hasNext) {
    const page = await fetchLinearIssuesPage({
      apiKey: opts.apiKey,
      teamId: opts.teamId,
      after: cursor,
    });

    for (const node of page.nodes) {
      const webhookPayload: LinearWebhookPayload = {
        action: "update",
        type: "Issue",
        data: {
          id: node.id,
          title: node.title,
          description: node.description,
          state: node.state,
          assignee: node.assignee,
          updatedAt: node.updatedAt,
        },
      };
      await handleLinearWebhook(
        opts.tenantId,
        opts.integrationId,
        webhookPayload
      );
      itemsProcessed += 1;
    }

    cursor = page.pageInfo.endCursor;
    hasNext = page.pageInfo.hasNextPage;

    // Persist cursor after each page so interruption can resume (AC-006)
    if (cursor) {
      await database.linearSync.updateMany({
        where: { tenantId: opts.tenantId },
        data: {
          metadata: {
            fullPullCursor: cursor,
            fullPullAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  return { itemsProcessed, cursor, complete: true };
}

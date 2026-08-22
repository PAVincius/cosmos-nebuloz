// Story-024 AC-006: cursor-resumable full pull (250/page)

import { database } from "@repo/database";
import { LINEAR_GQL } from "../connectors/linear";
import { handleLinearWebhook, type LinearWebhookPayload } from "./linear-pull";

const PAGE_SIZE = 250;

type LinearIssueNode = {
  id: string;
  title: string;
  description?: string;
  state?: { name: string };
  assignee?: { id: string } | null;
  updatedAt?: string;
  // COS-85: pedido de graça na mesma página paginada por time — permite
  // filtrar por Project do Linear sem uma segunda chamada de detalhe.
  project?: { id: string } | null;
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
          nodes { id title description state { name } assignee { id } updatedAt project { id } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  const res = await fetch(LINEAR_GQL, {
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
  // COS-85: Project real do Linear — filtra as issues do time para as de um
  // único produto/ART. Ausente → todo o time entra, igual ao comportamento
  // anterior.
  linearProjectId?: string;
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

    // COS-85: só monta opts de filtro quando há linearProjectId configurado
    // — handleLinearWebhook trata "sem opts" como "sem filtro", igual ao
    // comportamento anterior a esta issue.
    const webhookOpts = opts.linearProjectId
      ? { linearProjectId: opts.linearProjectId }
      : undefined;

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
          project: node.project ?? undefined,
        },
      };
      await handleLinearWebhook(
        opts.tenantId,
        opts.integrationId,
        webhookPayload,
        webhookOpts
      );
      itemsProcessed += 1;
    }

    cursor = page.pageInfo.endCursor;
    hasNext = page.pageInfo.hasNextPage;

    // Persist cursor after each page so interruption can resume (AC-006).
    // COS-84: o cursor é por tenant+time — a chave única de LinearSync é
    // `@@unique([tenantId, linearId, linearType])` (o modelo não tem
    // `integrationId`). Um `updateMany({ where: { tenantId } })` batia em
    // toda linha LinearSync do tenant (outros times, outras issues) e
    // substituía `metadata` inteiro, apagando chaves de terceiros (ex.:
    // `linearTeamId`, que linear-push.ts usa para resolver o time ao
    // empurrar labels). Aqui o `where` fecha em tenant+time, e o metadata
    // é mesclado, não trocado.
    if (cursor) {
      const teamSync = await database.linearSync.findFirst({
        where: {
          tenantId: opts.tenantId,
          linearId: opts.teamId,
          linearType: "team",
        },
        select: { metadata: true },
      });

      await database.linearSync.updateMany({
        where: {
          tenantId: opts.tenantId,
          linearId: opts.teamId,
          linearType: "team",
        },
        data: {
          metadata: {
            ...((teamSync?.metadata as Record<string, unknown> | null) ?? {}),
            fullPullCursor: cursor,
            fullPullAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  return { itemsProcessed, cursor, complete: true };
}

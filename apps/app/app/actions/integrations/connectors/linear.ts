/** Endpoint GraphQL do Linear. `LINEAR_API_URL` existe para o E2E apontar o
 *  fluxo inteiro (conectar → importar → sync) para um Linear falso — as
 *  chamadas acontecem no servidor Next, fora do alcance de interceptação do
 *  navegador de teste. Produção nunca define a variável. */
export const LINEAR_GQL =
  process.env.LINEAR_API_URL ?? "https://api.linear.app/graphql";

async function linearQuery<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Personal API key vai crua — Bearer é formato de OAuth, e a API
      // devolve 400 INPUT_ERROR para chave pessoal com o prefixo. Igual a
      // linear-push.ts e linear-full-pull.ts, que sempre mandaram assim.
      Authorization: apiKey,
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
  project: { id: string } | null;
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
  project { id }
  labels { nodes { name } }
  parent { id title }
  createdAt updatedAt
`;

/**
 * `linearProjectId` filtra pelo Project real do Linear (COS-85) — distinto
 * do `teamId` recebido acima, que no vocabulário deste conector é chamado
 * de "projectId" (ver schema.ts). A paginação continua varrendo o time
 * inteiro: o cursor do Linear é por time, não por project, então o filtro
 * é aplicado nos nós de cada página já buscada, não na query em si.
 */
export async function linearImportTeamIssues(
  apiKey: string,
  teamId: string,
  after?: string,
  linearProjectId?: string
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
  const issues = linearProjectId
    ? nodes.filter((n) => n.project?.id === linearProjectId)
    : nodes;
  return {
    issues,
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

/** Nomes de estado que significam "pronto, esperando alguém olhar".
 *  Cobre pt e en porque o time nomeia a coluna na língua dele. */
const NOME_DE_REVISAO = /review|revis|test|qa\b|homolog/i;

/**
 * O Linear não tem tipo de estado para revisão: "In Review", "Testando" e "QA"
 * são todos `started`, iguais a "In Progress". Olhando só o tipo, a coluna
 * REVIEW do board (`(cosmos)/actions/board.constants.ts`) nunca receberia nada
 * vindo de integração — e quem separa desenvolvimento de teste no Linear via
 * as duas colunas colapsarem numa só ao importar.
 *
 * O nome só desempata dentro de `started`. Um estado `completed` chamado
 * "Reviewed" terminou; devolvê-lo como REVIEW o traria de volta para uma
 * coluna em aberto.
 */
export function linearStateToStatus(
  stateType: string,
  stateName?: string
): string {
  const tipo = stateType.toLowerCase();
  if (tipo === "started" && stateName && NOME_DE_REVISAO.test(stateName)) {
    return "REVIEW";
  }
  return STATE_TYPE_MAP[tipo] ?? "BACKLOG";
}

// ─── Map Linear priority → Cosmos type hint ──────────────────────────────────

export function linearPriorityLabel(priority: number): string {
  return (
    ["No priority", "Urgent", "High", "Medium", "Low"][priority] ??
    "No priority"
  );
}

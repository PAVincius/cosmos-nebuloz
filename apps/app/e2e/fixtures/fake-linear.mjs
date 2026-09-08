#!/usr/bin/env node
/**
 * fake-linear.mjs — Linear GraphQL de mentira para o E2E do fluxo
 * conectar → importar → sincronizar.
 *
 * As chamadas ao Linear acontecem no SERVIDOR Next (server actions), fora do
 * alcance da interceptação de rede do navegador de teste — por isso um
 * servidor de verdade numa porta local, apontado por `LINEAR_API_URL`.
 *
 * Responde só o que os conectores do repo perguntam:
 *   { viewer }            → conta "Nebuloz E2E"
 *   { teams }             → Cosmos (COS) e Nebuloz (NEB)
 *   team(id).issues(...)  → 6 issues fixas cobrindo os 4 destinos do board:
 *                           backlog, unstarted, started, started+"Testando"
 *                           (que o import traduz para REVIEW) e completed.
 *
 * Qualquer chave serve, MENOS a que contém "invalida" — essa recebe o erro
 * real de autenticação, para o E2E provar que credencial ruim é recusada
 * antes de gravar qualquer coisa.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_LINEAR_PORT ?? 4801);

// O time COS carrega um project "Meridian" — o desenho do plano free, em que
// o produto mora como project dentro do time. Metade das issues pertence a
// ele, para o E2E provar que o filtro por project importa só essa metade.
const TEAMS = [
  {
    id: "fake-team-cosmos",
    name: "Cosmos",
    key: "COS",
    projects: { nodes: [{ id: "fake-prj-meridian", name: "Meridian" }] },
  },
  { id: "fake-team-nebuloz", name: "Nebuloz", key: "NEB", projects: { nodes: [] } },
];

const PRJ_MERIDIAN = { id: "fake-prj-meridian" };

const ISSUES = [
  {
    id: "fk-1",
    title: "E2E — WSJF Scoring Engine",
    state: { name: "Done", type: "completed" },
    estimate: 5,
    project: PRJ_MERIDIAN,
  },
  {
    id: "fk-2",
    title: "E2E — Program Board",
    state: { name: "Done", type: "completed" },
    estimate: 8,
  },
  {
    id: "fk-3",
    title: "E2E — Fluxo de conexão do Linear",
    state: { name: "Testando", type: "started" },
    estimate: 3,
    project: PRJ_MERIDIAN,
  },
  {
    id: "fk-4",
    title: "E2E — Guards de FK cross-tenant",
    state: { name: "In Progress", type: "started" },
    estimate: 5,
  },
  {
    id: "fk-5",
    title: "E2E — Import filtrado por project",
    state: { name: "Todo", type: "unstarted" },
    estimate: 2,
    project: PRJ_MERIDIAN,
  },
  {
    id: "fk-6",
    title: "E2E — Conector do GitHub",
    state: { name: "Backlog", type: "backlog" },
    estimate: 1,
  },
];

function issueNode(i) {
  return {
    project: null,
    ...i,
    description: null,
    url: `https://linear.app/fake/issue/${i.id}`,
    priority: 3,
    assignee: null,
    team: { id: TEAMS[0].id, name: TEAMS[0].name },
    labels: { nodes: [] },
    parent: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => {
    body += c;
  });
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");

    const auth = req.headers.authorization ?? "";
    // O conector correto manda a chave crua; Bearer aqui reproduziria o 400
    // real do Linear. O E2E afirma que isso nunca acontece.
    if (auth.startsWith("Bearer ")) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          errors: [
            {
              message:
                "It looks like you're trying to use an API key as a Bearer token. Remove the Bearer prefix from the Authorization header.",
            },
          ],
        })
      );
      return;
    }
    if (!auth || auth.includes("invalida")) {
      res.statusCode = 401;
      res.end(
        JSON.stringify({
          errors: [{ message: "Authentication required, not authenticated" }],
        })
      );
      return;
    }

    let query = "";
    try {
      query = JSON.parse(body || "{}").query ?? "";
    } catch {
      // corpo inválido cai no ramo de query vazia abaixo
    }

    if (query.includes("viewer")) {
      res.end(
        JSON.stringify({
          data: { viewer: { id: "u-e2e", name: "Nebuloz E2E" } },
        })
      );
      return;
    }
    if (query.includes("issues")) {
      res.end(
        JSON.stringify({
          data: {
            team: {
              issues: {
                nodes: ISSUES.map(issueNode),
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      );
      return;
    }
    if (query.includes("teams")) {
      res.end(JSON.stringify({ data: { teams: { nodes: TEAMS } } }));
      return;
    }

    res.statusCode = 400;
    res.end(
      JSON.stringify({
        errors: [{ message: "fake-linear: query não mapeada" }],
      })
    );
  });
});

server.listen(PORT, () => {
  console.log(`fake-linear ouvindo em http://localhost:${PORT}`);
});

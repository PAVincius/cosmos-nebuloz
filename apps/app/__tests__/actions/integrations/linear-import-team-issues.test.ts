// linear-import-team-issues.test.ts — filtro por project do Linear no
// conector usado pelo import inicial e pelo re-sync (COS-85).
//
// `runImportSnapshot` chama linearImportTeamIssues com o teamId do mapping
// (chamado de `projectId` no schema por herança do GitHub — ver
// schema.ts). O filtro por Project real do Linear é outro campo,
// `linearProjectId`, resolvido aqui client-side: a paginação continua
// varrendo o time inteiro (o cursor do Linear é por time, não por project),
// e cada página filtra os nós antes de devolver ao chamador.
import { afterEach, describe, expect, it, vi } from "vitest";
import { linearImportTeamIssues } from "../../../app/actions/integrations/connectors/linear";

afterEach(() => {
  vi.unstubAllGlobals();
});

function issue(id: string, projectId?: string) {
  return {
    id,
    title: id,
    description: null,
    url: `https://linear.app/nebuloz/issue/${id}`,
    state: { name: "Todo", type: "unstarted" },
    priority: 0,
    estimate: null,
    assignee: null,
    team: { id: "team-1", name: "NEB" },
    labels: { nodes: [] },
    parent: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...(projectId ? { project: { id: projectId } } : {}),
  };
}

function stubIssuesPage(nodes: ReturnType<typeof issue>[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        team: {
          issues: { nodes, pageInfo: { hasNextPage: false, endCursor: null } },
        },
      },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("linearImportTeamIssues — filtro por project (COS-85)", () => {
  it("sem linearProjectId, devolve todas as issues do time (comportamento atual intacto)", async () => {
    stubIssuesPage([issue("i1", "proj-a"), issue("i2", "proj-b")]);

    const { issues } = await linearImportTeamIssues("key", "team-1");

    expect(issues.map((i) => i.id)).toEqual(["i1", "i2"]);
  });

  it("com linearProjectId, só devolve issues daquele project", async () => {
    stubIssuesPage([
      issue("i1", "proj-a"),
      issue("i2", "proj-b"),
      issue("i3", "proj-a"),
    ]);

    const { issues } = await linearImportTeamIssues(
      "key",
      "team-1",
      undefined,
      "proj-a"
    );

    expect(issues.map((i) => i.id)).toEqual(["i1", "i3"]);
  });

  it("descarta issue sem project quando o filtro está ativo", async () => {
    stubIssuesPage([issue("i1", "proj-a"), issue("i2")]);

    const { issues } = await linearImportTeamIssues(
      "key",
      "team-1",
      undefined,
      "proj-a"
    );

    expect(issues.map((i) => i.id)).toEqual(["i1"]);
  });
});

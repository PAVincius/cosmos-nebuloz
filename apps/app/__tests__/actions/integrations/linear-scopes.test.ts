// linear-scopes.test.ts — o leitor de mapping do Linear precisa atravessar os
// dois formatos: o novo (lista de escopos numa integração por conta) e o
// antigo (uma integração por project, campos soltos na raiz). Enquanto houver
// integração não fundida, os dois convivem em produção.
import { describe, expect, it } from "vitest";
import {
  lerScopes,
  projectsAceitos,
  scopeDoProject,
} from "../../../app/actions/integrations/linear-scopes";

describe("lerScopes", () => {
  it("lê a lista de escopos do formato novo", () => {
    expect(
      lerScopes({
        scopes: [
          {
            linearTeamId: "lt_neb",
            linearProjectId: "prj_mer",
            epicId: "epc_mer",
            label: "Meridian",
          },
          { linearTeamId: "lt_neb", linearProjectId: "prj_cha" },
        ],
      })
    ).toEqual([
      {
        linearTeamId: "lt_neb",
        linearProjectId: "prj_mer",
        epicId: "epc_mer",
        label: "Meridian",
      },
      { linearTeamId: "lt_neb", linearProjectId: "prj_cha" },
    ]);
  });

  it("lê o formato antigo como escopo único — `projectId` era o teamId", () => {
    expect(
      lerScopes({
        projectId: "lt_cos",
        linearProjectId: "prj_x",
        epicId: "epc_1",
        targetType: "feature",
      })
    ).toEqual([
      { linearTeamId: "lt_cos", linearProjectId: "prj_x", epicId: "epc_1" },
    ]);
  });

  it("formato antigo sem filtro de project vira escopo de time inteiro", () => {
    expect(lerScopes({ projectId: "lt_cos" })).toEqual([
      { linearTeamId: "lt_cos" },
    ]);
  });

  it("devolve lista vazia para mapping ausente, nulo ou sem time", () => {
    expect(lerScopes(null)).toEqual([]);
    expect(lerScopes(undefined)).toEqual([]);
    expect(lerScopes({ statusMap: {} })).toEqual([]);
    expect(lerScopes({ projectId: "" })).toEqual([]);
  });

  it("descarta escopo sem linearTeamId em vez de propagar lixo", () => {
    expect(
      lerScopes({
        scopes: [
          { linearProjectId: "prj_sem_time" },
          { linearTeamId: "lt_ok" },
          "nem objeto",
        ],
      })
    ).toEqual([{ linearTeamId: "lt_ok" }]);
  });
});

describe("projectsAceitos", () => {
  it("lista os projects quando todo escopo tem project", () => {
    expect(
      projectsAceitos([
        { linearTeamId: "lt", linearProjectId: "p1" },
        { linearTeamId: "lt", linearProjectId: "p2" },
      ])
    ).toEqual(["p1", "p2"]);
  });

  it("desliga o filtro quando algum escopo acompanha o time inteiro", () => {
    // O payload do webhook não carrega time: filtrar por project aqui
    // descartaria issues que o escopo de time inteiro aceita.
    expect(
      projectsAceitos([
        { linearTeamId: "lt_neb", linearProjectId: "p1" },
        { linearTeamId: "lt_cos" },
      ])
    ).toBeNull();
  });

  it("desliga o filtro quando não há escopo nenhum", () => {
    expect(projectsAceitos([])).toBeNull();
  });
});

describe("scopeDoProject", () => {
  const scopes = [
    { linearTeamId: "lt", linearProjectId: "p1", epicId: "e1" },
    { linearTeamId: "lt", linearProjectId: "p2", epicId: "e2" },
    { linearTeamId: "lt_cos", epicId: "e_cos" },
  ];

  it("acha o escopo pelo project da issue", () => {
    expect(scopeDoProject(scopes, "p2")?.epicId).toBe("e2");
  });

  it("issue sem project cai no escopo de time inteiro", () => {
    expect(scopeDoProject(scopes, null)?.epicId).toBe("e_cos");
  });

  it("project desconhecido cai no escopo de time inteiro, se houver", () => {
    expect(scopeDoProject(scopes, "p_desconhecido")?.epicId).toBe("e_cos");
  });

  it("sem escopo de time inteiro, project desconhecido não casa com nada", () => {
    expect(
      scopeDoProject([{ linearTeamId: "lt", linearProjectId: "p1" }], "p_outro")
    ).toBeNull();
  });
});

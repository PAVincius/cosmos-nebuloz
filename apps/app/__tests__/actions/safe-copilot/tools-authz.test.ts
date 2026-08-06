// tools-authz.test.ts — quem pode escrever pelo copiloto.
//
// O guard antigo comparava o papel com a string `"VIEWER"`. **`VIEWER` não
// existe no enum `MemberRole`** (ADMIN | STE | RTE | SM | PO | DEV | MEMBER),
// então a comparação nunca era verdadeira — e a única chamada em produção
// sequer passava o papel. O bloqueio existia no código e não bloqueava nada.
//
// A correção não é consertar a string: é perguntar ao RBAC, que já é a resposta
// do repositório para "quem pode escrever feature" e já tem teste próprio. Uma
// segunda tabela de permissão em `tools.ts` seria livre para divergir da
// primeira, e foi assim que este bug nasceu.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  featureCreate: vi.fn(),
  featureFindFirst: vi.fn(),
  featureUpdate: vi.fn(),
  piPlanFindFirst: vi.fn(),
  vazio: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: { findMany: mocks.vazio },
    leanBudget: { findMany: mocks.vazio },
    strategicTheme: { findMany: mocks.vazio },
    team: { findMany: mocks.vazio },
    epic: { findMany: mocks.vazio },
    oKR: { findMany: mocks.vazio },
    feature: {
      create: mocks.featureCreate,
      findFirst: mocks.featureFindFirst,
      update: mocks.featureUpdate,
      updateMany: mocks.vazio,
      findMany: mocks.vazio,
    },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
    aRT: { findMany: mocks.vazio },
    pIObjective: { findMany: mocks.vazio },
    pIRisk: { findMany: mocks.vazio },
  },
}));
vi.mock("@repo/ai/lib/models", () => ({
  models: { embeddings: "text-embedding-3-small" },
}));
vi.mock("@repo/database/vector-search", () => ({
  searchKnowledge: mocks.vazio,
}));
vi.mock("ai", () => ({ tool: (def: unknown) => def, embed: mocks.vazio }));
vi.mock("../../../app/actions/safe-copilot/tools/pricing-tools", () => ({
  awsPricingTool: { description: "aws", inputSchema: {}, execute: vi.fn() },
  gcpPricingTool: { description: "gcp", inputSchema: {}, execute: vi.fn() },
}));

import { buildCopilotTools } from "../../../app/actions/safe-copilot/tools";

type AnyTools = Record<string, { execute: (...args: any[]) => Promise<any> }>;

const TENANT = "tenant-teste";

const NOVA_FEATURE = {
  title: "Feature nova",
  bv: 5,
  tc: 5,
  rr: 5,
  js: 8,
  storyPoints: 8,
};

function tools(role?: string) {
  return buildCopilotTools(TENANT, role) as unknown as AnyTools;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.vazio.mockResolvedValue([]);
  mocks.featureCreate.mockResolvedValue({ id: "f-1", title: "Feature nova" });
  mocks.featureFindFirst.mockResolvedValue({
    id: "f-1",
    title: "Feature nova",
    status: "BACKLOG",
  });
  mocks.featureUpdate.mockResolvedValue({ id: "f-1", status: "IN_PROGRESS" });
  mocks.piPlanFindFirst.mockResolvedValue({ id: "pi-1" });
});

describe("papel sem feature:write não escreve", () => {
  // MEMBER e DEV têm `feature:read` e não têm `feature:write` na matriz do
  // @repo/rbac. O guard antigo deixava os dois passarem.
  for (const role of ["MEMBER", "DEV"]) {
    it(`${role} não cria feature`, async () => {
      const r = await tools(role).createFeature.execute(NOVA_FEATURE);

      expect(r.ok).toBe(false);
      expect(mocks.featureCreate).not.toHaveBeenCalled();
    });

    it(`${role} não move feature`, async () => {
      const r = await tools(role).moveFeature.execute({
        featureId: "f-1",
        status: "IN_PROGRESS",
      });

      expect(r.ok).toBe(false);
      expect(mocks.featureUpdate).not.toHaveBeenCalled();
    });
  }
});

describe("papel com feature:write escreve", () => {
  for (const role of ["ADMIN", "RTE", "PO", "SM"]) {
    it(`${role} cria feature`, async () => {
      const r = await tools(role).createFeature.execute(NOVA_FEATURE);

      expect(r.ok).not.toBe(false);
      expect(mocks.featureCreate).toHaveBeenCalled();
    });
  }
});

describe("papel ausente", () => {
  it("sem papel, não escreve", async () => {
    // O modo de falha certo. Era exatamente este o caso em produção — a rota
    // chamava `buildCopilotTools(tenantId)` sem o papel — e o antigo abria a
    // escrita para qualquer um.
    const r = await tools(undefined).createFeature.execute(NOVA_FEATURE);

    expect(r.ok).toBe(false);
    expect(mocks.featureCreate).not.toHaveBeenCalled();
  });

  it("papel desconhecido não escreve", async () => {
    const r = await tools("PAPEL_QUE_NAO_EXISTE").createFeature.execute(
      NOVA_FEATURE
    );

    expect(r.ok).toBe(false);
    expect(mocks.featureCreate).not.toHaveBeenCalled();
  });
});

describe("leitura continua aberta a todo papel", () => {
  it("MEMBER consulta ARTs", async () => {
    const r = await tools("MEMBER").queryARTs.execute({});

    expect(r).toBeDefined();
  });
});

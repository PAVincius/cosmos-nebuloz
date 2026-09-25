// agregados.test.ts — os KPIs contam o universo, não a página.
//
// Decisão do dono (crítica rodada 6): a carteira passa de 100 clientes em 12
// meses. Com as listas no teto de `lib/paginacao.ts`, KPI calculado sobre a
// lista vira dado errado sem erro nenhum — "Clientes na carteira: 100" com
// 140 clientes. As leituras daqui são contagem no banco (`count`/`groupBy`),
// com o mesmo filtro de tenant das listas e número fixo de consultas.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  tenantCount: vi.fn(),
  tenantModuleGroupBy: vi.fn(),
  proposalGroupBy: vi.fn(),
  estagioFindMany: vi.fn(),
  leadCount: vi.fn(),
  leadGroupBy: vi.fn(),
  engagementAggregate: vi.fn(),
  engagementGroupBy: vi.fn(),
  accessFindMany: vi.fn(),
  integrationFindMany: vi.fn(),
  integrationCount: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {},
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@repo/database", () => ({
  database: {
    tenant: { count: mocks.tenantCount },
    tenantModule: { groupBy: mocks.tenantModuleGroupBy },
    proposal: { groupBy: mocks.proposalGroupBy },
    estagioDoFunil: { findMany: mocks.estagioFindMany },
    lead: { count: mocks.leadCount, groupBy: mocks.leadGroupBy },
    engagement: {
      aggregate: mocks.engagementAggregate,
      groupBy: mocks.engagementGroupBy,
    },
    accessLog: { findMany: mocks.accessFindMany },
    integration: {
      findMany: mocks.integrationFindMany,
      count: mocks.integrationCount,
    },
    auditLog: { findMany: mocks.auditFindMany },
  },
}));

import { listPlatformHealth } from "../app/actions/access";
import {
  agregadoDaCarteira,
  agregadoDasContas,
  agregadoDasPropostas,
  agregadoDoBenchmark,
  agregadoDoFunil,
} from "../app/actions/agregados";

const DIA = 86_400_000;
const AGORA = new Date("2026-09-22T15:00:00.000Z");

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue({ userId: "u-1" });
  mocks.tenantCount.mockResolvedValue(0);
  mocks.tenantModuleGroupBy.mockResolvedValue([]);
  mocks.proposalGroupBy.mockResolvedValue([]);
  mocks.estagioFindMany.mockResolvedValue([]);
  mocks.leadCount.mockResolvedValue(0);
  mocks.leadGroupBy.mockResolvedValue([]);
  mocks.engagementAggregate.mockResolvedValue({ _sum: { valorCentavos: 0 } });
  mocks.engagementGroupBy.mockResolvedValue([]);
  mocks.accessFindMany.mockResolvedValue([]);
  mocks.integrationFindMany.mockResolvedValue([]);
  mocks.integrationCount.mockResolvedValue(0);
  mocks.auditFindMany.mockResolvedValue([]);
});

describe("agregadoDaCarteira", () => {
  it("conta clientes e módulos no banco, fora o tenant interno", async () => {
    mocks.tenantCount.mockResolvedValue(140);
    mocks.tenantModuleGroupBy.mockResolvedValue([
      { status: "ACTIVE", _count: { _all: 210 } },
      { status: "TRIAL", _count: { _all: 12 } },
      { status: "SUSPENDED", _count: { _all: 5 } },
      { status: "CANCELED", _count: { _all: 3 } },
    ]);

    const res = await agregadoDaCarteira();

    expect(res).toEqual({
      ok: true,
      data: { clientes: 140, modulosAtivos: 210, trials: 12, suspensos: 5 },
    });
    expect(mocks.tenantCount).toHaveBeenCalledWith({
      where: { isSystem: false },
    });
    expect(mocks.tenantModuleGroupBy.mock.calls[0][0]).toMatchObject({
      by: ["status"],
      where: { tenant: { isSystem: false } },
    });
  });

  it("status ausente no groupBy vale zero, não some", async () => {
    mocks.tenantCount.mockResolvedValue(3);

    const res = await agregadoDaCarteira();

    expect(res).toEqual({
      ok: true,
      data: { clientes: 3, modulosAtivos: 0, trials: 0, suspensos: 0 },
    });
  });

  it("a Home e a Carteira dão o mesmo número de clientes", async () => {
    mocks.tenantCount.mockResolvedValue(140);

    const home = await listPlatformHealth();
    const carteira = await agregadoDaCarteira();

    if (!(home.ok && carteira.ok)) {
      throw new Error("as duas leituras deviam dar certo");
    }
    expect(home.data.tenants).toBe(140);
    expect(carteira.data.clientes).toBe(home.data.tenants);
    const [daHome, daCarteira] = mocks.tenantCount.mock.calls;
    expect(daCarteira[0]).toEqual(daHome[0]);
  });

  it("sem staff, não conta", async () => {
    mocks.requirePlatformStaff.mockRejectedValue(new Error("fora"));

    const res = await agregadoDaCarteira();

    expect(res.ok).toBe(false);
    expect(mocks.tenantCount).not.toHaveBeenCalled();
  });
});

describe("agregadoDasContas", () => {
  it("quatro contagens, na ordem risco, atenção, renovando, sem sinal", async () => {
    mocks.tenantCount
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(7);

    const res = await agregadoDasContas(AGORA);

    expect(res).toEqual({
      ok: true,
      data: { risco: 12, atencao: 30, renovando: 18, semSinal: 7 },
    });
    expect(mocks.tenantCount).toHaveBeenCalledTimes(4);
  });

  it("as fronteiras de data são as de `diasAte`: vencida, janela de renovação e silêncio", async () => {
    await agregadoDasContas(AGORA);

    const [risco, atencao, renovando, semSinal] =
      mocks.tenantCount.mock.calls.map((c) => c[0].where);

    // Renovação vencida: `diasAte` < 0 ⇔ expira até um dia antes de agora.
    expect(risco).toMatchObject({
      isSystem: false,
      modules: {
        some: {
          OR: [
            { status: { in: ["SUSPENDED", "CANCELED"] } },
            {
              status: { notIn: ["SUSPENDED", "CANCELED"] },
              expiresAt: { lte: new Date(AGORA.getTime() - DIA) },
            },
          ],
        },
      },
    });
    // Renovando: `diasAte` ≤ 60 — inclui a vencida, como a tela contava.
    expect(renovando).toEqual({
      isSystem: false,
      modules: {
        some: {
          status: { notIn: ["SUSPENDED", "CANCELED"] },
          expiresAt: { lte: new Date(AGORA.getTime() + 60 * DIA) },
        },
      },
    });
    // Atenção: tem módulo, nenhum em risco, e algum sinal de atenção.
    expect(atencao.modules).toEqual({ some: {}, none: risco.modules.some });
    expect(atencao.OR).toEqual([
      { modules: renovando.modules },
      { integrations: { some: { status: "ERROR" } } },
      {
        AND: [
          { auditLogs: { some: {} } },
          {
            auditLogs: {
              none: {
                createdAt: { gt: new Date(AGORA.getTime() - 30 * DIA) },
              },
            },
          },
        ],
      },
    ]);
    expect(semSinal).toEqual({ isSystem: false, modules: { none: {} } });
  });
});

describe("agregadoDasPropostas", () => {
  it("um groupBy por status dá pipeline, win rate, ticket e fila", async () => {
    mocks.proposalGroupBy.mockResolvedValue([
      { status: "RASCUNHO", _count: { _all: 40 }, _sum: { acvCentavos: 400 } },
      {
        status: "AGUARDANDO_APROVACAO",
        _count: { _all: 23 },
        _sum: { acvCentavos: 230 },
      },
      { status: "ENVIADA", _count: { _all: 17 }, _sum: { acvCentavos: 170 } },
      { status: "ACEITA", _count: { _all: 45 }, _sum: { acvCentavos: 900 } },
      { status: "RECUSADA", _count: { _all: 15 }, _sum: { acvCentavos: null } },
    ]);

    const res = await agregadoDasPropostas();

    expect(res).toEqual({
      ok: true,
      data: {
        total: 140,
        abertas: 80,
        pipelineAbertoCentavos: 800,
        // (400 + 230 + 170 + 900 + 0) / 140
        ticketMedioCentavos: 12,
        ganhas: 45,
        decididas: 60,
        naFila: 23,
      },
    });
    expect(mocks.proposalGroupBy.mock.calls[0][0]).toMatchObject({
      by: ["status"],
      where: { tenantId: "system" },
    });
  });

  it("sem proposta nenhuma, ticket zero e nada decidido", async () => {
    const res = await agregadoDasPropostas();

    expect(res).toEqual({
      ok: true,
      data: {
        total: 0,
        abertas: 0,
        pipelineAbertoCentavos: 0,
        ticketMedioCentavos: 0,
        ganhas: 0,
        decididas: 0,
        naFila: 0,
      },
    });
  });
});

describe("agregadoDoFunil", () => {
  it("ativos, estagnados pelo teto de cada estágio e a fatia da Escada", async () => {
    mocks.estagioFindMany.mockResolvedValue([
      { codigo: "LEAD", tetoDias: 14 },
      { codigo: "DIAGNOSTICO", tetoDias: 21 },
    ]);
    mocks.leadCount.mockResolvedValueOnce(140).mockResolvedValueOnce(9);
    mocks.leadGroupBy.mockResolvedValue([
      { entrada: "MERIDIAN", _count: { _all: 30 } },
      { entrada: "COSMOS", _count: { _all: 10 } },
    ]);

    const res = await agregadoDoFunil(AGORA);

    expect(res).toEqual({
      ok: true,
      data: { ativos: 140, estagnados: 9, pelaEscada: 75 },
    });
    const [ativos, estagnados] = mocks.leadCount.mock.calls.map(
      (c) => c[0].where
    );
    // Ativo é o que `situacaoDe` chama de ATIVO: não perdido, proposta nem
    // aceita nem recusada (ou sem proposta).
    expect(ativos).toEqual({
      tenantId: "system",
      perdidoEm: null,
      OR: [
        { proposta: { is: null } },
        { proposta: { is: { status: { notIn: ["ACEITA", "RECUSADA"] } } } },
      ],
    });
    // Estagnado: dias por fronteira UTC (`diasNoEstagio`) acima do teto.
    const meiaNoite = Date.UTC(2026, 8, 22);
    expect(estagnados).toEqual({
      AND: [
        ativos,
        {
          OR: [
            {
              estagio: "LEAD",
              estagioDesde: { lt: new Date(meiaNoite - 14 * DIA) },
            },
            {
              estagio: "DIAGNOSTICO",
              estagioDesde: { lt: new Date(meiaNoite - 21 * DIA) },
            },
          ],
        },
      ],
    });
  });

  it("sem lead com entrada, a fatia da Escada é nula, não zero", async () => {
    const res = await agregadoDoFunil(AGORA);

    expect(res).toEqual({
      ok: true,
      data: { ativos: 0, estagnados: 0, pelaEscada: null },
    });
  });
});

describe("agregadoDoBenchmark", () => {
  it("clientes, receita e sem contrato sobre a carteira inteira", async () => {
    mocks.tenantCount.mockResolvedValue(140);
    mocks.engagementAggregate.mockResolvedValue({
      _sum: { valorCentavos: 9_000_000 },
    });
    mocks.engagementGroupBy.mockResolvedValue(
      Array.from({ length: 110 }, (_, i) => ({ clienteTenantId: `t${i}` }))
    );

    const res = await agregadoDoBenchmark();

    expect(res).toEqual({
      ok: true,
      data: { clientes: 140, receitaCentavos: 9_000_000, semContrato: 30 },
    });
    // Cancelado fora — o mesmo corte das linhas por cliente.
    const conta = {
      tenantId: "system",
      status: { in: ["ATIVO", "CONCLUIDO", "PAUSADO"] },
      clienteTenantId: { not: "system" },
    };
    expect(mocks.engagementAggregate.mock.calls[0][0]).toMatchObject({
      where: conta,
    });
    expect(mocks.engagementGroupBy.mock.calls[0][0]).toMatchObject({
      by: ["clienteTenantId"],
      where: conta,
    });
    expect(mocks.tenantCount).toHaveBeenCalledWith({
      where: { isSystem: false },
    });
  });
});

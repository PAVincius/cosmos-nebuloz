// teto-das-leituras.test.ts — nenhuma listagem sai do banco sem `take`.
//
// O invariante em um lugar só, para as seis leituras: carteira, funil,
// engajamentos, propostas, saúde das contas e benchmark. Cada uma pede ao
// banco a página mais um (`TETO_DA_LISTA + 1`) — remover o `take` de qualquer
// delas derruba o teste dela aqui. A chamada sem argumento continua
// devolvendo a forma antiga (array, ou o pacote do funil), para os chamadores
// que não paginam não mudarem; com `{ pagina }` vem `{ itens, temMais }`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TETO_DA_LISTA } from "../lib/paginacao";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  tenantFindMany: vi.fn(),
  leadFindMany: vi.fn(),
  estagioFindMany: vi.fn(),
  canalFindMany: vi.fn(),
  historicoFindMany: vi.fn(),
  engagementFindMany: vi.fn(),
  proposalFindMany: vi.fn(),
  serviceFindMany: vi.fn(),
  integrationFindMany: vi.fn(),
  auditGroupBy: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {},
}));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: vi.fn(),
  ProvisioningError: class extends Error {},
  platformDb: { tenant: { findMany: mocks.tenantFindMany } },
}));
vi.mock("@/lib/comercial", () => ({
  gerarNumeroProposta: vi.fn(),
  LIMITE_DESCONTO_SEM_APROVACAO: 15,
}));
vi.mock("@/app/actions/approvals", () => ({
  requestPlatformApproval: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  database: {
    tenant: { findMany: mocks.tenantFindMany },
    lead: { findMany: mocks.leadFindMany },
    estagioDoFunil: { findMany: mocks.estagioFindMany },
    canalDeLead: { findMany: mocks.canalFindMany },
    historicoDeEstagio: { findMany: mocks.historicoFindMany },
    engagement: { findMany: mocks.engagementFindMany },
    proposal: { findMany: mocks.proposalFindMany },
    service: { findMany: mocks.serviceFindMany },
    integration: { findMany: mocks.integrationFindMany },
    auditLog: { groupBy: mocks.auditGroupBy },
  },
  ProductModule: { MERIDIAN: "MERIDIAN", CHARTER: "CHARTER" },
}));

import { listAccountHealth } from "../app/actions/accounts";
import { listBenchmark } from "../app/actions/benchmark";
import { listClients } from "../app/actions/clients";
import { listEngagements } from "../app/actions/engagements";
import { listarFunil } from "../app/actions/leads";
import { listProposals } from "../app/actions/proposals";

const TAKE = TETO_DA_LISTA + 1;

function tenants(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t-${i}`,
    name: `Cliente ${i}`,
    slug: `cliente-${i}`,
    plan: "ORBIT",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    modules: [],
    _count: { members: 1 },
  }));
}

function leads(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `l-${i}`,
    nome: `Lead ${i}`,
    contatoNome: null,
    contatoEmail: null,
    estagio: "LEAD",
    estagioDesde: new Date("2026-09-01T00:00:00Z"),
    entrada: null,
    origem: null,
    acvEstimadoCentavos: null,
    donoNome: null,
    proximaAcao: null,
    proximaAcaoEm: null,
    perdidoEm: null,
    perdidoNoEstagio: null,
    motivoPerda: null,
    notaPerda: null,
    criadoEm: new Date("2026-09-01T00:00:00Z"),
    canal: null,
    proposta: null,
  }));
}

function engajamentos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e-${i}`,
    codigo: `ENG-${i}`,
    nome: `Eng ${i}`,
    clienteTenantId: "t-0",
    status: "ATIVO",
    valorCentavos: 100,
    inicioEm: null,
    fimEm: null,
  }));
}

function propostas(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${i}`,
    numero: `P-${i}`,
    titulo: `Proposta ${i}`,
    clienteNome: null,
    status: "DRAFT",
    descontoPercent: 0,
    totalCentavos: 100,
    acvCentavos: 100,
    criadoEm: new Date("2026-09-01T00:00:00Z"),
  }));
}

function takeDe(mock: ReturnType<typeof vi.fn>): unknown {
  return (mock.mock.calls[0]?.[0] as { take?: unknown })?.take;
}

function skipDe(mock: ReturnType<typeof vi.fn>): unknown {
  return (mock.mock.calls[0]?.[0] as { skip?: unknown })?.skip;
}

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue({
    userId: "u-1",
    name: "V",
    email: "v@nebuloz.com",
    canWrite: true,
  });
  for (const m of [
    mocks.tenantFindMany,
    mocks.leadFindMany,
    mocks.estagioFindMany,
    mocks.canalFindMany,
    mocks.historicoFindMany,
    mocks.engagementFindMany,
    mocks.proposalFindMany,
    mocks.serviceFindMany,
    mocks.integrationFindMany,
    mocks.auditGroupBy,
  ]) {
    m.mockResolvedValue([]);
  }
});

describe("listClients — teto", () => {
  it("pede ao banco a página mais um", async () => {
    await listClients();
    expect(takeDe(mocks.tenantFindMany)).toBe(TAKE);
    expect(skipDe(mocks.tenantFindMany)).toBe(0);
  });

  it("sem argumento devolve array, cortado no teto", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(TAKE));
    const res = await listClients();
    expect(res.ok && Array.isArray(res.data)).toBe(true);
    expect(res.ok && res.data.length).toBe(TETO_DA_LISTA);
  });

  it("com página devolve itens e temMais", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(TAKE));
    const res = await listClients({ pagina: 2 });
    expect(skipDe(mocks.tenantFindMany)).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
    expect(res.ok && res.data.itens.length).toBe(TETO_DA_LISTA);
  });

  it("página incompleta: temMais false", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(3));
    const res = await listClients({ pagina: 1 });
    expect(res.ok && res.data.temMais).toBe(false);
    expect(res.ok && res.data.itens.length).toBe(3);
  });
});

describe("listarFunil — teto nos leads", () => {
  it("leads com página mais um; histórico só dos leads da página", async () => {
    mocks.leadFindMany.mockResolvedValue(leads(2));
    await listarFunil();
    expect(takeDe(mocks.leadFindMany)).toBe(TAKE);
    const whereHistorico = mocks.historicoFindMany.mock.calls[0]?.[0] as {
      where: { leadId?: { in: string[] } };
    };
    expect(whereHistorico.where.leadId?.in).toEqual(["l-0", "l-1"]);
  });

  it("sem argumento devolve o pacote de sempre, com temMaisLeads", async () => {
    mocks.leadFindMany.mockResolvedValue(leads(TAKE));
    const res = await listarFunil();
    expect(res.ok && res.data.leads.length).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMaisLeads).toBe(true);
    expect(res.ok && Array.isArray(res.data.estagios)).toBe(true);
  });

  it("com página pula a anterior e diz que acabou", async () => {
    mocks.leadFindMany.mockResolvedValue(leads(4));
    const res = await listarFunil({ pagina: 2 });
    expect(skipDe(mocks.leadFindMany)).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.leads.length).toBe(4);
    expect(res.ok && res.data.temMaisLeads).toBe(false);
  });
});

describe("listEngagements — teto", () => {
  it("pede a página mais um e devolve array sem argumento", async () => {
    mocks.engagementFindMany.mockResolvedValue(engajamentos(TAKE));
    const res = await listEngagements();
    expect(takeDe(mocks.engagementFindMany)).toBe(TAKE);
    expect(res.ok && Array.isArray(res.data)).toBe(true);
    expect(res.ok && res.data.length).toBe(TETO_DA_LISTA);
  });

  it("com página: itens e temMais", async () => {
    mocks.engagementFindMany.mockResolvedValue(engajamentos(TAKE));
    const res = await listEngagements({ pagina: 3 });
    expect(skipDe(mocks.engagementFindMany)).toBe(2 * TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
    expect(res.ok && res.data.itens.length).toBe(TETO_DA_LISTA);
  });
});

describe("listProposals — teto", () => {
  it("pede a página mais um e devolve array sem argumento", async () => {
    mocks.proposalFindMany.mockResolvedValue(propostas(TAKE));
    const res = await listProposals();
    expect(takeDe(mocks.proposalFindMany)).toBe(TAKE);
    expect(res.ok && Array.isArray(res.data)).toBe(true);
    expect(res.ok && res.data.length).toBe(TETO_DA_LISTA);
  });

  it("com página: itens e temMais", async () => {
    mocks.proposalFindMany.mockResolvedValue(propostas(1));
    const res = await listProposals({ pagina: 2 });
    expect(skipDe(mocks.proposalFindMany)).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(false);
    expect(res.ok && res.data.itens.length).toBe(1);
  });
});

describe("listAccountHealth — teto", () => {
  it("pede a página mais um e devolve array sem página", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(TAKE));
    const res = await listAccountHealth();
    expect(takeDe(mocks.tenantFindMany)).toBe(TAKE);
    expect(res.ok && Array.isArray(res.data)).toBe(true);
    expect(res.ok && res.data.length).toBe(TETO_DA_LISTA);
  });

  it("com página: itens e temMais, data de referência preservada", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(TAKE));
    const res = await listAccountHealth(new Date("2026-09-20T00:00:00Z"), {
      pagina: 2,
    });
    expect(skipDe(mocks.tenantFindMany)).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
    expect(res.ok && res.data.itens.length).toBe(TETO_DA_LISTA);
  });
});

describe("listBenchmark — teto", () => {
  it("clientes com página mais um; engajamentos e propostas só dos clientes da página", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(2));
    await listBenchmark();
    expect(takeDe(mocks.tenantFindMany)).toBe(TAKE);
    const whereEng = mocks.engagementFindMany.mock.calls[0]?.[0] as {
      where: { clienteTenantId?: { in: string[] } };
    };
    expect(whereEng.where.clienteTenantId?.in).toEqual(["t-0", "t-1"]);
    const whereProp = mocks.proposalFindMany.mock.calls[0]?.[0] as {
      where: { clienteTenantId?: { in: string[] } };
    };
    expect(whereProp.where.clienteTenantId?.in).toEqual(["t-0", "t-1"]);
    expect(takeDe(mocks.serviceFindMany)).toBe(TETO_DA_LISTA);
  });

  it("sem argumento devolve o pacote de sempre, com temMaisClientes", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(TAKE));
    const res = await listBenchmark();
    expect(res.ok && res.data.clientes.length).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMaisClientes).toBe(true);
  });

  it("com página pula a anterior", async () => {
    mocks.tenantFindMany.mockResolvedValue(tenants(1));
    const res = await listBenchmark({ pagina: 2 });
    expect(skipDe(mocks.tenantFindMany)).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMaisClientes).toBe(false);
  });
});

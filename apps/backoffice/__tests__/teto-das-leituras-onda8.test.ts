// teto-das-leituras-onda8.test.ts — onda 8a, bloco 3. `lib/paginacao.ts`
// promete que nenhuma listagem sai do banco sem `take`, e seis saíam:
// títulos (crescia para sempre), biblioteca de IP, avaliações de maturidade,
// diagramas, fornecedores e membros do tenant. Cada uma agora pede a página
// mais um (`TETO_DA_LISTA + 1`) — tirar o `take` de qualquer delas derruba o
// teste dela aqui. Chamada sem página continua na forma de antes, até o teto.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TETO_DA_LISTA } from "../lib/paginacao";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  tituloFindMany: vi.fn(),
  ipAssetFindMany: vi.fn(),
  avaliacaoFindMany: vi.fn(),
  diagramFindMany: vi.fn(),
  fornecedorFindMany: vi.fn(),
  fornecedorGroupBy: vi.fn(),
  memberFindMany: vi.fn(),
  tenantFindFirst: vi.fn(),
  contasDoPlano: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: vi.fn(),
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {},
}));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: vi.fn(),
  deriveVendorMaxClass: vi.fn(),
  platformDb: {},
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/empresa/consultas", () => ({
  assertContaAtiva: vi.fn(),
  contasDoPlano: mocks.contasDoPlano,
}));
vi.mock("@repo/database", () => ({
  database: {
    titulo: { findMany: mocks.tituloFindMany },
    ipAsset: { findMany: mocks.ipAssetFindMany },
    avaliacaoDeMaturidade: { findMany: mocks.avaliacaoFindMany },
    staffDiagram: { findMany: mocks.diagramFindMany },
    fornecedorDpa: {
      findMany: mocks.fornecedorFindMany,
      groupBy: mocks.fornecedorGroupBy,
    },
    tenantMember: { findMany: mocks.memberFindMany },
    tenant: { findFirst: mocks.tenantFindFirst },
  },
  withTenantDb: vi.fn(),
}));

import { listDiagrams } from "../app/actions/diagrams";
import { listarFornecedoresDpa } from "../app/actions/empresa/fornecedores";
import { listarTitulos } from "../app/actions/empresa/titulos";
import { listIpAssets } from "../app/actions/ip-library";
import { listarAvaliacoes } from "../app/actions/maturidade";
import { listTenantMembers } from "../app/actions/tenant-members";

const TAKE = TETO_DA_LISTA + 1;
const DIA = new Date("2026-09-01T00:00:00Z");

function chamada(mock: ReturnType<typeof vi.fn>): {
  take?: unknown;
  skip?: unknown;
  where?: Record<string, unknown>;
} {
  return mock.mock.calls[0]?.[0] ?? {};
}

function vezes<T>(n: number, f: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => f(i));
}

const titulo = (i: number) => ({
  id: `t-${i}`,
  tipo: "PAGAR",
  descricao: `Título ${i}`,
  contraparte: "X",
  conta: "5.1",
  valorCentavos: 100,
  emissao: DIA,
  vencimento: DIA,
  status: "ABERTO",
  baixadoEm: null,
  competenciaBaixa: null,
  motivoCancelamento: null,
  clienteSlug: null,
});

const ativo = (i: number) => ({
  id: `ip-${i}`,
  nome: `Ativo ${i}`,
  slug: `ativo-${i}`,
  tipo: "PLAYBOOK",
  descricao: null,
  link: null,
  procedencia: "INTERNA",
  licenca: "PROPRIETARIA",
  atualizadoEm: DIA,
  origem: null,
  dono: null,
  servicos: [],
  reusos: [],
  _count: { versions: 1 },
});

const avaliacao = (i: number) => ({
  id: `a-${i}`,
  organizacao: `Org ${i}`,
  leadId: null,
  rubricaVersao: 1,
  status: "RASCUNHO",
  scoreGeral: null,
  nivelGeral: null,
  autorNome: null,
  concluidaEm: null,
  criadoEm: DIA,
  lead: null,
  _count: { respostas: 0 },
});

const diagrama = (i: number) => ({
  id: `d-${i}`,
  kind: "BPMN",
  name: `Diagrama ${i}`,
  slug: `diagrama-${i}`,
  descricao: null,
  atualizadoEm: DIA,
  criadoPorNome: null,
  _count: { versions: 1 },
});

const fornecedor = (i: number) => ({
  codigo: `V-${String(i).padStart(3, "0")}`,
  nome: `Fornecedor ${i}`,
  estado: "A_ASSINAR",
  classificacaoProvisoria: false,
  regiao: null,
  retencao: null,
  transferencia: null,
  dpaUrl: null,
  subprocessadoresUrl: null,
  evidenciaUrl: null,
  verificadoEm: DIA,
  acaoPendente: null,
  donoPapel: null,
  bloqueiaVenda: false,
  pedidoEm: null,
  assinadoEm: null,
  exportadoAoCharterEm: null,
  notas: null,
});

const membro = (i: number) => ({
  id: `m-${i}`,
  role: "MEMBER",
  createdAt: DIA,
  user: { name: `Pessoa ${i}`, email: `p${i}@x.com` },
});

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue({ userId: "u-1" });
  mocks.contasDoPlano.mockResolvedValue([]);
  mocks.tenantFindFirst.mockResolvedValue({ id: "t-1", slug: "acme" });
  mocks.fornecedorGroupBy.mockResolvedValue([]);
  for (const m of [
    mocks.tituloFindMany,
    mocks.ipAssetFindMany,
    mocks.avaliacaoFindMany,
    mocks.diagramFindMany,
    mocks.fornecedorFindMany,
    mocks.memberFindMany,
  ]) {
    m.mockResolvedValue([]);
  }
});

describe("listarTitulos — em aberto + últimos 90 dias, até o teto", () => {
  it("pede a página mais um e, por padrão, só aberto ou mexido há 90 dias", async () => {
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
    await listarTitulos({});
    const { take, skip, where } = chamada(mocks.tituloFindMany);
    expect(take).toBe(TAKE);
    expect(skip).toBe(0);
    expect(where?.OR).toEqual([
      { status: "ABERTO" },
      { atualizadoEm: { gte: new Date("2026-06-24T12:00:00Z") } },
    ]);
    vi.useRealTimers();
  });

  it("com `antigos`, sem o recorte de 90 dias — mas com o mesmo teto", async () => {
    await listarTitulos({ antigos: true });
    const { take, where } = chamada(mocks.tituloFindMany);
    expect(take).toBe(TAKE);
    expect(where?.OR).toBeUndefined();
  });

  it("página cheia diz temMais e corta a linha extra; a 2ª pula o teto", async () => {
    mocks.tituloFindMany.mockResolvedValue(vezes(TAKE, titulo));
    const res = await listarTitulos({ pagina: 2 });
    expect(chamada(mocks.tituloFindMany).skip).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
    expect(res.ok && res.data.titulos.length).toBe(TETO_DA_LISTA);
  });

  it("página incompleta: temMais false", async () => {
    mocks.tituloFindMany.mockResolvedValue(vezes(3, titulo));
    const res = await listarTitulos({});
    expect(res.ok && res.data.temMais).toBe(false);
    expect(res.ok && res.data.titulos.length).toBe(3);
  });
});

describe("listIpAssets — teto", () => {
  it("pede a página mais um; sem argumento devolve array cortado no teto", async () => {
    mocks.ipAssetFindMany.mockResolvedValue(vezes(TAKE, ativo));
    const res = await listIpAssets();
    expect(chamada(mocks.ipAssetFindMany).take).toBe(TAKE);
    expect(res.ok && Array.isArray(res.data)).toBe(true);
    expect(res.ok && res.data.length).toBe(TETO_DA_LISTA);
  });

  it("com página devolve itens e temMais", async () => {
    mocks.ipAssetFindMany.mockResolvedValue(vezes(TAKE, ativo));
    const res = await listIpAssets({ pagina: 2 });
    expect(chamada(mocks.ipAssetFindMany).skip).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
    expect(res.ok && res.data.itens.length).toBe(TETO_DA_LISTA);
  });
});

describe("listarAvaliacoes — teto", () => {
  it("pede a página mais um e diz temMais", async () => {
    mocks.avaliacaoFindMany.mockResolvedValue(vezes(TAKE, avaliacao));
    const res = await listarAvaliacoes();
    expect(chamada(mocks.avaliacaoFindMany).take).toBe(TAKE);
    expect(res.ok && res.data.avaliacoes.length).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
  });

  it("página 2 pula o teto; incompleta, temMais false", async () => {
    mocks.avaliacaoFindMany.mockResolvedValue(vezes(2, avaliacao));
    const res = await listarAvaliacoes({ pagina: 2 });
    expect(chamada(mocks.avaliacaoFindMany).skip).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(false);
  });
});

describe("listDiagrams — teto", () => {
  it("pede a página mais um; sem página devolve array cortado no teto", async () => {
    mocks.diagramFindMany.mockResolvedValue(vezes(TAKE, diagrama));
    const res = await listDiagrams("BPMN");
    expect(chamada(mocks.diagramFindMany).take).toBe(TAKE);
    expect(res.ok && res.data.length).toBe(TETO_DA_LISTA);
  });

  it("com página devolve itens e temMais", async () => {
    mocks.diagramFindMany.mockResolvedValue(vezes(TAKE, diagrama));
    const res = await listDiagrams("MERMAID", { pagina: 2 });
    const { skip, where } = chamada(mocks.diagramFindMany);
    expect(skip).toBe(TETO_DA_LISTA);
    expect(where?.kind).toBe("MERMAID");
    expect(res.ok && res.data.temMais).toBe(true);
  });
});

describe("listarFornecedoresDpa — teto, com contadores do inventário inteiro", () => {
  it("pede a página mais um e diz temMais", async () => {
    mocks.fornecedorFindMany.mockResolvedValue(vezes(TAKE, fornecedor));
    const res = await listarFornecedoresDpa();
    expect(chamada(mocks.fornecedorFindMany).take).toBe(TAKE);
    expect(res.ok && res.data.linhas.length).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
  });

  it("os contadores contam o inventário todo, não só a página", async () => {
    mocks.fornecedorFindMany.mockResolvedValue(vezes(2, fornecedor));
    mocks.fornecedorGroupBy.mockResolvedValue([
      { estado: "A_ASSINAR", bloqueiaVenda: true, _count: { _all: 150 } },
      { estado: "EMBUTIDO", bloqueiaVenda: false, _count: { _all: 7 } },
    ]);
    const res = await listarFornecedoresDpa();
    expect(res.ok && res.data.contadores).toEqual({
      aAssinar: 150,
      bloqueiamVenda: 150,
      embutidos: 7,
      semDocumento: 0,
    });
  });
});

describe("listTenantMembers — teto", () => {
  it("pede a página mais um; sem página devolve array cortado no teto", async () => {
    mocks.memberFindMany.mockResolvedValue(vezes(TAKE, membro));
    const res = await listTenantMembers("acme");
    expect(chamada(mocks.memberFindMany).take).toBe(TAKE);
    expect(res.ok && res.data.length).toBe(TETO_DA_LISTA);
  });

  it("com página devolve itens e temMais", async () => {
    mocks.memberFindMany.mockResolvedValue(vezes(TAKE, membro));
    const res = await listTenantMembers("acme", { pagina: 2 });
    expect(chamada(mocks.memberFindMany).skip).toBe(TETO_DA_LISTA);
    expect(res.ok && res.data.temMais).toBe(true);
    expect(res.ok && res.data.itens.length).toBe(TETO_DA_LISTA);
  });
});

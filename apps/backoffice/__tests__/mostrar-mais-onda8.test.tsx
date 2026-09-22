/** @vitest-environment jsdom */
// mostrar-mais-onda8.test.tsx — onda 8a, bloco 3, nas telas. As seis leituras
// que ganharam teto (`teto-das-leituras-onda8.test.ts`) param em 100; aqui,
// cada tela que as mostra oferece "Mostrar mais" quando a primeira página veio
// cheia, pede a página 2 à action e anexa. Títulos, além disso, abre com "em
// aberto + últimos 90 dias" e deixa pedir os pagos e cancelados antigos.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbaUsuarios } from "@/app/(staff)/clientes/[slug]/abas/usuarios";
import { Titulos } from "@/app/(staff)/empresa/financeiro/titulos";
import { Inventario } from "@/app/(staff)/empresa/fornecedores/inventario";
import { Estudio } from "@/app/(staff)/ferramentas/estudio";
import { Lista } from "@/app/(staff)/growth/readiness/lista";
import { Biblioteca } from "@/app/(staff)/ip/biblioteca";
import type { DiagramRow } from "@/app/actions/diagrams";
import type { FornecedorDpaRow } from "@/app/actions/empresa/fornecedores";
import type { IpAssetRow } from "@/app/actions/ip-library";
import type { AvaliacaoRow } from "@/app/actions/maturidade";
import type { TenantMemberRow } from "@/app/actions/tenant-members";
import type { TituloRow } from "@/lib/empresa/livro";
import { TETO_DA_LISTA } from "@/lib/paginacao";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listarTitulos: vi.fn(),
  listIpAssets: vi.fn(),
  listarAvaliacoes: vi.fn(),
  listDiagrams: vi.fn(),
  listarFornecedoresDpa: vi.fn(),
  listTenantMembers: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/empresa/titulos", () => ({
  baixarTitulo: vi.fn(),
  cancelarTitulo: vi.fn(),
  criarTitulo: vi.fn(),
  listarTitulos: mocks.listarTitulos,
}));
vi.mock("@/app/actions/ip-library", () => ({
  createIpAssetAction: vi.fn(),
  getIpAsset: vi.fn(),
  listIpAssets: mocks.listIpAssets,
  registrarReusoAction: vi.fn(),
  updateIpAssetAction: vi.fn(),
}));
vi.mock("@/app/actions/maturidade", () => ({
  criarAvaliacao: vi.fn(),
  listarAvaliacoes: mocks.listarAvaliacoes,
}));
vi.mock("@/app/actions/diagrams", () => ({
  createDiagramAction: vi.fn(),
  definirClienteDoDiagramaAction: vi.fn(),
  getDiagram: vi.fn(),
  listDiagrams: mocks.listDiagrams,
  updateDiagramAction: vi.fn(),
}));
vi.mock("@/app/actions/empresa/fornecedores", () => ({
  aplicarAcaoDpa: vi.fn(),
  exportarAoCharter: vi.fn(),
  listarFornecedoresDpa: mocks.listarFornecedoresDpa,
}));
vi.mock("@/app/actions/tenant-members", () => ({
  listTenantMembers: mocks.listTenantMembers,
  updateTenantMemberRoleAction: vi.fn(),
}));
vi.mock("@/components/bpmn-modeler", () => ({
  BPMN_EM_BRANCO: "<bpmn/>",
  BpmnModeler: () => <div>editor</div>,
}));
vi.mock("@/components/mermaid-editor", () => ({
  MERMAID_EXEMPLO: "flowchart",
  MermaidEditor: () => <div>mermaid</div>,
}));

const BOTAO = `Mostrar mais ${TETO_DA_LISTA}`;
// Consultas por texto, não por papel: com 100 linhas na tela, `getByRole`
// calcula o nome acessível de cada nó e o arquivo leva minutos.

function vezes<T>(n: number, f: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => f(i));
}

const titulo = (i: number, over: Partial<TituloRow> = {}): TituloRow => ({
  baixadoEm: null,
  clienteSlug: null,
  competenciaBaixa: null,
  conta: "5.1",
  contraparte: "X",
  descricao: `Título ${i}`,
  emissao: "2026-09-01",
  id: `t-${i}`,
  motivoCancelamento: null,
  status: "ABERTO",
  tipo: "PAGAR",
  valorCentavos: 100,
  vencimento: "2026-10-01",
  ...over,
});

const ativo = (i: number): IpAssetRow => ({
  atualizadoEm: "2026-09-01T00:00:00.000Z",
  descricao: null,
  dono: null,
  horasPoupadas: 0,
  id: `ip-${i}`,
  licenca: "INTERNA",
  link: null,
  maturidade: "RASCUNHO",
  nome: `Ativo ${i}`,
  origem: null,
  procedencia: "PROPRIA",
  reusos: 0,
  servicos: [],
  slug: `ativo-${i}`,
  tipo: "PLAYBOOK",
  versoes: 1,
});

const avaliacao = (i: number): AvaliacaoRow => ({
  autorNome: null,
  concluidaEm: null,
  criadoEm: "2026-09-01T00:00:00.000Z",
  id: `a-${i}`,
  leadId: null,
  leadNome: null,
  nivelGeral: null,
  organizacao: `Org ${i}`,
  respondidos: 0,
  rubricaVersao: "v1",
  scoreGeral: null,
  status: "RASCUNHO",
});

const diagrama = (i: number): DiagramRow => ({
  atualizadoEm: "2026-09-01T00:00:00.000Z",
  criadoPorNome: null,
  descricao: null,
  id: `d-${i}`,
  kind: "BPMN",
  name: `Diagrama ${i}`,
  slug: `diagrama-${i}`,
  versoes: 1,
});

const fornecedor = (i: number): FornecedorDpaRow => ({
  acaoPendente: null,
  acoes: [],
  assinadoEm: null,
  bloqueiaVenda: false,
  classificacaoProvisoria: false,
  codigo: `V-${String(i).padStart(3, "0")}`,
  donoPapel: null,
  dpaUrl: null,
  estado: "ASSINADO",
  evidenciaUrl: null,
  exportadoAoCharterEm: null,
  nome: `Fornecedor ${i}`,
  notas: null,
  pedidoEm: null,
  regiao: null,
  retencao: null,
  subprocessadoresUrl: null,
  transferencia: null,
  verificadoEm: "2026-09-01T00:00:00.000Z",
});

const membro = (i: number): TenantMemberRow => ({
  desde: "2026-01-01T00:00:00.000Z",
  email: `p${i}@acme.com`,
  id: `m-${i}`,
  nome: `Pessoa ${i}`,
  role: "MEMBER",
});

beforeEach(() => {
  zerarRoteador("/");
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
});

describe("Títulos — em aberto + 90 dias, até o teto", () => {
  const cheia = vezes(TETO_DA_LISTA, (i) => titulo(i));

  beforeEach(() => {
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
  });

  it("diz o recorte e, com a página cheia, pede a 2ª e anexa", async () => {
    mocks.listarTitulos.mockResolvedValue({
      data: { contas: [], temMais: false, titulos: [titulo(900)] },
      ok: true,
    });
    render(
      <Titulos
        inicial={{ contas: [], temMais: true, titulos: cheia }}
        podeEscrever
      />
    );
    expect(
      screen.getByText(
        /em aberto e o que foi baixado ou cancelado nos últimos 90 dias/i
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByText(BOTAO));

    await screen.findByText("Título 900");
    expect(mocks.listarTitulos).toHaveBeenCalledWith({
      antigos: false,
      pagina: 2,
    });
    expect(screen.queryByText(BOTAO)).toBeNull();
  });

  it("'Mostrar pagos e cancelados antigos' relê a primeira página sem o recorte", async () => {
    const antigo = titulo(901, {
      baixadoEm: "2025-01-10",
      descricao: "Aluguel de 2025",
      status: "BAIXADO",
    });
    mocks.listarTitulos.mockResolvedValue({
      data: { contas: [], temMais: false, titulos: [antigo] },
      ok: true,
    });
    render(
      <Titulos
        inicial={{ contas: [], temMais: false, titulos: [titulo(1)] }}
        podeEscrever
      />
    );

    fireEvent.click(screen.getByText("Mostrar pagos e cancelados antigos"));

    await screen.findByText("Aluguel de 2025");
    expect(mocks.listarTitulos).toHaveBeenCalledWith({
      antigos: true,
      pagina: 1,
    });
    expect(
      screen.getByText("Esconder pagos e cancelados antigos").tagName
    ).toBe("BUTTON");
  });
});

describe("Biblioteca de IP — Mostrar mais", () => {
  it("página cheia: pede a 2ª a listIpAssets e anexa", async () => {
    mocks.listIpAssets.mockResolvedValue({
      data: { itens: [ativo(900)], temMais: false },
      ok: true,
    });
    render(
      <Biblioteca
        engajamentos={[]}
        iniciais={vezes(TETO_DA_LISTA, ativo)}
        pessoas={[]}
        podeEscrever={false}
        servicos={[]}
      />
    );
    fireEvent.click(screen.getByText(BOTAO));
    await screen.findByText("Ativo 900");
    expect(mocks.listIpAssets).toHaveBeenCalledWith({ pagina: 2 });
  });

  it("página incompleta: sem botão", () => {
    render(
      <Biblioteca
        engajamentos={[]}
        iniciais={vezes(3, ativo)}
        pessoas={[]}
        podeEscrever={false}
        servicos={[]}
      />
    );
    expect(screen.queryByText(BOTAO)).toBeNull();
  });
});

describe("Avaliações de maturidade — Mostrar mais", () => {
  it("temMais: pede a 2ª a listarAvaliacoes e anexa", async () => {
    mocks.listarAvaliacoes.mockResolvedValue({
      data: {
        avaliacoes: [avaliacao(900)],
        temMais: false,
        totalDeCriterios: 18,
      },
      ok: true,
    });
    render(
      <Lista
        avaliacoes={vezes(TETO_DA_LISTA, avaliacao)}
        podeEscrever={false}
        temMais
        totalDeCriterios={18}
      />
    );
    fireEvent.click(screen.getByText(BOTAO));
    await screen.findByText("Org 900");
    expect(mocks.listarAvaliacoes).toHaveBeenCalledWith({ pagina: 2 });
  });
});

describe("Estúdio de diagramas — Mostrar mais", () => {
  it("página cheia: pede a 2ª a listDiagrams, do mesmo tipo, e anexa", async () => {
    mocks.listDiagrams.mockResolvedValue({
      data: { itens: [diagrama(900)], temMais: false },
      ok: true,
    });
    render(
      <Estudio
        clientes={[]}
        iniciais={vezes(TETO_DA_LISTA, diagrama)}
        kind="BPMN"
        podeEscrever={false}
      />
    );
    fireEvent.click(screen.getByText(BOTAO));
    await screen.findByText("Diagrama 900");
    expect(mocks.listDiagrams).toHaveBeenCalledWith("BPMN", { pagina: 2 });
  });
});

describe("Fornecedores — Mostrar mais", () => {
  it("temMais: pede a 2ª a listarFornecedoresDpa e anexa", async () => {
    mocks.listarFornecedoresDpa.mockResolvedValue({
      data: {
        contadores: {
          aAssinar: 0,
          bloqueiamVenda: 0,
          embutidos: 0,
          semDocumento: 0,
        },
        linhas: [fornecedor(900)],
        temMais: false,
      },
      ok: true,
    });
    render(
      <Inventario
        contadoresDoInventario={{
          aAssinar: 0,
          bloqueiamVenda: 0,
          embutidos: 0,
          semDocumento: 0,
        }}
        iniciais={vezes(TETO_DA_LISTA, fornecedor)}
        podeEscrever={false}
        temMais
      />
    );
    fireEvent.click(screen.getByText(BOTAO));
    await screen.findByText("Fornecedor 900");
    expect(mocks.listarFornecedoresDpa).toHaveBeenCalledWith({ pagina: 2 });
  });

  it("com mais páginas, os cartões contam o inventário inteiro, não só o que carregou", async () => {
    render(
      <Inventario
        contadoresDoInventario={{
          aAssinar: 42,
          bloqueiamVenda: 0,
          embutidos: 0,
          semDocumento: 0,
        }}
        iniciais={vezes(TETO_DA_LISTA, fornecedor)}
        podeEscrever={false}
        temMais
      />
    );
    // O `KpiCard` conta de 0 até o valor; espera a contagem chegar.
    expect(
      await screen.findByText("42", undefined, { timeout: 3000 })
    ).toBeTruthy();
  });
});

describe("Usuários do tenant — Mostrar mais", () => {
  it("página cheia: pede a 2ª a listTenantMembers com o slug e anexa", async () => {
    mocks.listTenantMembers.mockResolvedValue({
      data: { itens: [membro(900)], temMais: false },
      ok: true,
    });
    render(
      <AbaUsuarios
        canWrite={false}
        membros={vezes(TETO_DA_LISTA, membro)}
        slug="acme"
      />
    );
    fireEvent.click(screen.getByText(BOTAO));
    await waitFor(() => expect(screen.getByText("p900@acme.com")).toBeTruthy());
    expect(mocks.listTenantMembers).toHaveBeenCalledWith("acme", {
      pagina: 2,
    });
  });
});

/** @vitest-environment jsdom */
// um-dialeto-so.test.tsx — heurística 4 (consistência), rodada 3: o componente
// certo existia e substituiu metade das cópias. `<Confirmacao>` (status
// polite) tinha 3 usos e 8 `<output>` verdes copiados sem `aria-live`;
// `<Vazio>` tinha 16 usos e ~20 `<p>` centralizados soltos. Aqui se prova a
// outra metade: toda confirmação é um status polite, nasce junto do controle
// que agiu (a linha, o botão), e todo vazio é o `<Vazio>` tracejado que diz o
// que alimenta a tela.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decisao } from "@/app/(staff)/aprovacoes/decisao";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import { Inventario } from "@/app/(staff)/empresa/fornecedores/inventario";
import { Barras } from "@/app/(staff)/funil/barras";
import { Biblioteca } from "@/app/(staff)/ip/biblioteca";
import { Propostas } from "@/app/(staff)/propostas/propostas";
import { Catalogo } from "@/app/(staff)/servicos/catalogo";
import type { FornecedorDpaRow } from "@/app/actions/empresa/fornecedores";
import type { EngagementRow } from "@/app/actions/engagements";
import type { IpAssetDetail, IpAssetRow } from "@/app/actions/ip-library";
import type { ProposalRow } from "@/app/actions/proposals";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  createEngagementAction: vi.fn(),
  decidePlatformApprovalAction: vi.fn(),
  exportarAoCharter: vi.fn(),
  getIpAsset: vi.fn(),
  listEngagements: vi.fn(),
  setEngagementStatusAction: vi.fn(),
  submitProposalAction: vi.fn(),
  updateIpAssetAction: vi.fn(),
}));

vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: mocks.createEngagementAction,
  listEngagements: mocks.listEngagements,
  setEngagementStatusAction: mocks.setEngagementStatusAction,
}));
vi.mock("@/app/actions/ip-library", () => ({
  createIpAssetAction: vi.fn(),
  getIpAsset: mocks.getIpAsset,
  registrarReusoAction: vi.fn(),
  updateIpAssetAction: mocks.updateIpAssetAction,
}));
vi.mock("@/app/actions/proposals", () => ({
  submitProposalAction: mocks.submitProposalAction,
}));
vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: mocks.decidePlatformApprovalAction,
}));
vi.mock("@/app/actions/empresa/fornecedores", () => ({
  aplicarAcaoDpa: vi.fn(),
  exportarAoCharter: mocks.exportarAoCharter,
}));
vi.mock("@/app/actions/services", () => ({
  createServiceAction: vi.fn(),
  setServiceAtivoAction: vi.fn(),
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

const ENG: EngagementRow = {
  clienteNome: "Atlas",
  clienteSlug: "atlas",
  codigo: "ENG-01",
  fimEm: null,
  id: "e1",
  inicioEm: "2026-09-01",
  nome: "Diagnóstico",
  proximos: ["ATIVO", "CANCELADO"],
  status: "PROPOSTO",
  valorCentavos: 1_200_000,
};

const ATIVO: IpAssetRow = {
  atualizadoEm: "2026-09-01T00:00:00.000Z",
  descricao: null,
  dono: null,
  horasPoupadas: 0,
  id: "a1",
  licenca: "NENHUMA",
  link: null,
  maturidade: "RASCUNHO",
  nome: "Playbook",
  origem: null,
  procedencia: "INTERNO",
  reusos: 0,
  servicos: [],
  slug: "a1",
  tipo: "PLAYBOOK",
  versoes: 1,
};
const DETALHE: IpAssetDetail = {
  ...ATIVO,
  conteudo: "conteudo-a1",
  historico: [],
};

const PROPOSTA: ProposalRow = {
  acvCentavos: 100_000,
  cliente: "Atlas Energia",
  criadoEm: "2026-09-01T00:00:00.000Z",
  descontoPercent: 0,
  id: "prop-1",
  numero: "P-0001",
  status: "RASCUNHO",
  titulo: "Atlas — plataforma",
  totalCentavos: 100_000,
};

const FORNECEDOR: FornecedorDpaRow = {
  acaoPendente: null,
  acoes: [],
  assinadoEm: null,
  bloqueiaVenda: false,
  classificacaoProvisoria: false,
  codigo: "F-01",
  donoPapel: null,
  dpaUrl: null,
  estado: "EMBUTIDO",
  evidenciaUrl: null,
  exportadoAoCharterEm: null,
  nome: "Vercel",
  notas: null,
  pedidoEm: null,
  regiao: "EUA",
  retencao: null,
  subprocessadoresUrl: null,
  transferencia: null,
  verificadoEm: "2026-09-01T00:00:00.000Z",
};

/** O que marca o `<Vazio>` do painel: a moldura tracejada do `Pendente`. */
function ehVazio(el: HTMLElement): boolean {
  return el.style.border.includes("dashed");
}

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
});

describe("Confirmação nasce junto do controle que agiu", () => {
  it("Engajamentos — mudar status confirma dentro da linha do engajamento", async () => {
    mocks.setEngagementStatusAction.mockResolvedValue({
      data: { id: "e1" },
      ok: true,
    });
    mocks.listEngagements.mockResolvedValue({
      data: {
        itens: [{ ...ENG, proximos: ["PAUSADO"], status: "ATIVO" }],
        temMais: false,
      },
      ok: true,
    });
    render(
      <Engajamentos clientes={[]} iniciais={[ENG]} podeEscrever servicos={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: "→ Ativo" }));

    const status = await screen.findByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    const linha = status.closest("li");
    expect(linha?.textContent).toContain("ENG-01");
  });

  it("Engajamentos — criar confirma dentro da linha do engajamento novo", async () => {
    mocks.createEngagementAction.mockResolvedValue({
      data: { codigo: "ENG-09", id: "e9" },
      ok: true,
    });
    render(
      <Engajamentos
        clientes={[{ id: "t1", name: "Atlas", slug: "atlas" }]}
        iniciais={[ENG]}
        podeEscrever
        servicos={[]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Novo engajamento" }));
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "ENG-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Roadmap" },
    });
    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "t1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar como proposto" })
    );

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("ENG-09");
    expect(status.closest("li")?.textContent).toContain("Roadmap");
  });

  it("Biblioteca — salvar revisão confirma logo abaixo do botão de salvar", async () => {
    zerarRoteador("/ip", "ativo=a1");
    mocks.getIpAsset.mockResolvedValue({ data: DETALHE, ok: true });
    mocks.updateIpAssetAction.mockResolvedValue({
      data: { id: "a1", versao: 2 },
      ok: true,
    });
    render(
      <Biblioteca
        engajamentos={[]}
        iniciais={[ATIVO]}
        pessoas={[]}
        podeEscrever
        servicos={[]}
      />
    );
    const editor = await screen.findByDisplayValue("conteudo-a1");
    fireEvent.change(editor, { target: { value: "conteudo-a1 editado" } });
    mocks.getIpAsset.mockResolvedValue({
      data: { ...DETALHE, conteudo: "conteudo-a1 editado" },
      ok: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));

    const status = await screen.findByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    // O irmão imediatamente acima é a linha que tem o botão que agiu — não o
    // topo da página, duas telas acima do editor.
    const botao = await screen.findByRole("button", { name: "Sem alterações" });
    expect(status.previousElementSibling?.contains(botao)).toBe(true);
  });

  it("Propostas — ?enviada=<id> confirma dentro da linha da proposta", () => {
    zerarRoteador("/propostas", "enviada=prop-1");
    render(
      <Propostas iniciais={[{ ...PROPOSTA, status: "ENVIADA" }]} podeEscrever />
    );

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.closest("li")?.textContent).toContain("P-0001");
  });

  it("Aprovações — a decisão é anunciada como status polite", async () => {
    mocks.decidePlatformApprovalAction.mockResolvedValue({
      data: { id: "ap-1" },
      ok: true,
    });
    render(<Decisao alvo="Desconto 30% · Atlas" canWrite id="ap-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("Fornecedores — exportar ao Charter é anunciado como status polite", async () => {
    mocks.exportarAoCharter.mockResolvedValue({
      data: { exportados: ["F-01"], semCorrespondente: [] },
      ok: true,
    });
    render(<Inventario iniciais={[FORNECEDOR]} podeEscrever />);
    fireEvent.click(
      screen.getByRole("button", { name: "Exportar para o Charter" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });
});

describe("Vazio é o <Vazio> — tracejado, dizendo o que alimenta a tela", () => {
  it("Engajamentos sem linha", () => {
    render(
      <Engajamentos clientes={[]} iniciais={[]} podeEscrever servicos={[]} />
    );
    expect(ehVazio(screen.getByText(/Nenhum engajamento/))).toBe(true);
  });

  it("Propostas sem linha", () => {
    render(<Propostas iniciais={[]} podeEscrever />);
    expect(ehVazio(screen.getByText(/Nenhuma proposta ainda/))).toBe(true);
  });

  it("Catálogo sem serviço", () => {
    render(<Catalogo iniciais={[]} podeEscrever />);
    expect(ehVazio(screen.getByText(/Catálogo vazio/))).toBe(true);
  });

  it("Fornecedores — filtro sem resultado mantém o botão de limpar dentro do vazio", () => {
    render(<Inventario iniciais={[FORNECEDOR]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "A assinar" }));

    const vazio = screen.getByText(/Nenhum fornecedor com este filtro/);
    expect(ehVazio(vazio)).toBe(true);
    expect(
      vazio.contains(screen.getByRole("button", { name: "Limpar filtro" }))
    ).toBe(true);
  });

  it("Barras sem linha dizem de onde as barras nascem, em vez de cartão em branco", () => {
    render(<Barras linhas={[]} />);
    const vazio = screen.getByText(/lead/i);
    expect(ehVazio(vazio)).toBe(true);
  });
});

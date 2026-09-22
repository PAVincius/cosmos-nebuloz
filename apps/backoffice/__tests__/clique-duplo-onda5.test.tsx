/** @vitest-environment jsdom */
// clique-duplo-onda5.test.tsx — crítica rodada 2 (25/40), heurística 7:
// quatro gatilhos de escrita sem pendente (dois cliques = duas chamadas), e
// dois `recarregar` que falhavam em silêncio deixando a lista velha.
//
// Prova por gatilho: com a action pendente, o segundo clique não chama de
// novo — é o `executando`/`disabled` que segura; tirá-lo derruba a linha.
// DPA: a URL da evidência é validada antes de gravar. Listas: `recarregar`
// que falha mostra "Lista pode estar desatualizada" com "tentar de novo".
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import { Inventario } from "@/app/(staff)/empresa/fornecedores/inventario";
import { Estudio } from "@/app/(staff)/ferramentas/estudio";
import { type DadosFunil, Funil } from "@/app/(staff)/funil/funil";
import { Propostas } from "@/app/(staff)/propostas/propostas";
import { Catalogo } from "@/app/(staff)/servicos/catalogo";
import type { FornecedorDpaRow } from "@/app/actions/empresa/fornecedores";
import type { EngagementRow } from "@/app/actions/engagements";
import type { LeadRow } from "@/app/actions/leads";
import type { ProposalRow } from "@/app/actions/proposals";
import type { ServiceRow } from "@/app/actions/services";
import { zerarRoteador } from "../vitest-mocks/next-navigation";
import { pendenteAteOFim } from "../vitest-mocks/pendente";

const mocks = vi.hoisted(() => ({
  aplicarAcaoDpa: vi.fn(),
  createDiagramAction: vi.fn(),
  getDiagram: vi.fn(),
  listEngagements: vi.fn(),
  listarFunil: vi.fn(),
  moverEstagio: vi.fn(),
  setEngagementStatusAction: vi.fn(),
  setServiceAtivoAction: vi.fn(),
  submitProposalAction: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/proposals", () => ({
  submitProposalAction: mocks.submitProposalAction,
}));
vi.mock("@/app/actions/services", () => ({
  createServiceAction: vi.fn(),
  setServiceAtivoAction: mocks.setServiceAtivoAction,
}));
vi.mock("@/app/actions/diagrams", () => ({
  createDiagramAction: mocks.createDiagramAction,
  definirClienteDoDiagramaAction: vi.fn(),
  getDiagram: mocks.getDiagram,
  updateDiagramAction: vi.fn(),
}));
vi.mock("@/components/bpmn-modeler", () => ({
  BPMN_EM_BRANCO: "<bpmn/>",
  BpmnModeler: () => <div>editor</div>,
}));
vi.mock("@/components/mermaid-editor", () => ({
  MERMAID_EXEMPLO: "flowchart",
  MermaidEditor: () => <div>mermaid</div>,
}));
vi.mock("@/app/actions/empresa/fornecedores", () => ({
  aplicarAcaoDpa: mocks.aplicarAcaoDpa,
  exportarAoCharter: vi.fn(),
}));
vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: vi.fn(),
  listEngagements: mocks.listEngagements,
  setEngagementStatusAction: mocks.setEngagementStatusAction,
}));
vi.mock("@/app/actions/leads", () => ({
  converterEmProposta: vi.fn(),
  criarLead: vi.fn(),
  listarFunil: mocks.listarFunil,
  marcarPerdido: vi.fn(),
  moverEstagio: mocks.moverEstagio,
  registrarProximaAcao: vi.fn(),
}));
vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: vi.fn(),
  lerEstagio: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
});

// ── Propostas: enviar pela lista ──

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

describe("Propostas — enviar pela lista", () => {
  it("dois cliques em Confirmar = uma chamada; o botão diz que está executando", async () => {
    mocks.submitProposalAction.mockReturnValue(pendenteAteOFim());
    render(<Propostas iniciais={[PROPOSTA]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const confirmar = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Executando…" })).toBeTruthy()
    );
    expect(mocks.submitProposalAction).toHaveBeenCalledTimes(1);
  });
});

// ── Catálogo: devolver ao catálogo ──

const SERVICO_INATIVO: ServiceRow = {
  ativo: false,
  codigo: "SV-02",
  descricao: null,
  duracao: null,
  entregaveis: [],
  exigeLab: false,
  id: "s2",
  modalidade: "PROJETO",
  moduloVinculado: null,
  nome: "Antigo",
  papeis: [],
  precoBaseCentavos: 100_000,
  preRequisitos: [],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
};

describe("Catálogo — alternar", () => {
  it("dois cliques em Devolver = uma chamada", async () => {
    mocks.setServiceAtivoAction.mockReturnValue(pendenteAteOFim());
    render(<Catalogo iniciais={[SERVICO_INATIVO]} podeEscrever />);

    const devolver = screen.getByRole("button", { name: "Devolver" });
    fireEvent.click(devolver);
    fireEvent.click(devolver);

    await waitFor(() => expect(devolver.hasAttribute("disabled")).toBe(true));
    expect(mocks.setServiceAtivoAction).toHaveBeenCalledTimes(1);
  });

  it("o botão que fecha o formulário de novo serviço diz Fechar, não Cancelar", () => {
    render(<Catalogo iniciais={[SERVICO_INATIVO]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Novo serviço" }));

    expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });
});

// ── Estúdio: criar/importar ──

describe("Estúdio — criar", () => {
  beforeEach(() => {
    zerarRoteador("/ferramentas/bpmn", "novo=Gate%20de%20fase");
    mocks.createDiagramAction.mockReturnValue(pendenteAteOFim());
  });

  it("dois cliques em Criar em branco = uma chamada", async () => {
    render(<Estudio clientes={[]} iniciais={[]} kind="BPMN" podeEscrever />);

    const criar = screen.getByRole("button", { name: "Criar em branco" });
    fireEvent.click(criar);
    fireEvent.click(criar);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Criando…" })).toBeTruthy()
    );
    expect(mocks.createDiagramAction).toHaveBeenCalledTimes(1);
  });

  it("o botão que fecha o formulário diz Fechar, não Cancelar", () => {
    render(<Estudio clientes={[]} iniciais={[]} kind="BPMN" podeEscrever />);

    expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });
});

// ── DPA: Registrar pedido e Confirmar com evidência ──

function fornecedor(over: Partial<FornecedorDpaRow>): FornecedorDpaRow {
  return {
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
    ...over,
  };
}

describe("DPA — registrar pedido e confirmar aceite", () => {
  it("dois cliques em Registrar pedido = uma chamada", async () => {
    mocks.aplicarAcaoDpa.mockReturnValue(pendenteAteOFim());
    render(
      <Inventario
        iniciais={[fornecedor({ acoes: ["REGISTRAR_PEDIDO"] })]}
        podeEscrever
      />
    );

    const registrar = screen.getByRole("button", { name: "Registrar pedido" });
    fireEvent.click(registrar);
    fireEvent.click(registrar);

    await waitFor(() => expect(registrar.hasAttribute("disabled")).toBe(true));
    expect(mocks.aplicarAcaoDpa).toHaveBeenCalledTimes(1);
  });

  it("Confirmar com evidência que não é URL não grava e diz o motivo", () => {
    render(
      <Inventario
        iniciais={[fornecedor({ acoes: ["MARCAR_ACEITO"] })]}
        podeEscrever
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Marcar aceito" }));
    fireEvent.change(screen.getByLabelText("Evidência do DPA de Vercel"), {
      target: { value: "isso não é um link" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(mocks.aplicarAcaoDpa).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/https?:\/\//);
  });

  it("Confirmar com URL válida: dois cliques = uma chamada", async () => {
    mocks.aplicarAcaoDpa.mockReturnValue(pendenteAteOFim());
    render(
      <Inventario
        iniciais={[fornecedor({ acoes: ["MARCAR_ACEITO"] })]}
        podeEscrever
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Marcar aceito" }));
    fireEvent.change(screen.getByLabelText("Evidência do DPA de Vercel"), {
      target: { value: "https://vercel.com/legal/dpa" },
    });
    const confirmar = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);

    await waitFor(() => expect(confirmar.hasAttribute("disabled")).toBe(true));
    expect(mocks.aplicarAcaoDpa).toHaveBeenCalledTimes(1);
    expect(mocks.aplicarAcaoDpa).toHaveBeenCalledWith({
      acao: "MARCAR_ACEITO",
      codigo: "F-01",
      evidenciaUrl: "https://vercel.com/legal/dpa",
    });
  });
});

// ── Listas: recarregar que falha ──

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

describe("Engajamentos — recarregar que falha", () => {
  it("avisa que a lista pode estar desatualizada e oferece tentar de novo", async () => {
    mocks.setEngagementStatusAction.mockResolvedValue({
      data: { id: "e1" },
      ok: true,
    });
    mocks.listEngagements
      .mockResolvedValueOnce({ error: "Banco indisponível.", ok: false })
      .mockResolvedValueOnce({
        data: {
          itens: [{ ...ENG, proximos: [], status: "ATIVO" }],
          temMais: false,
        },
        ok: true,
      });
    render(
      <Engajamentos clientes={[]} iniciais={[ENG]} podeEscrever servicos={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: "→ Ativo" }));

    const aviso = await screen.findByText(/Lista pode estar desatualizada/);
    expect(aviso.textContent).toContain("Banco indisponível.");
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    await waitFor(() => expect(mocks.listEngagements).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText(/Lista pode estar desatualizada/)).toBeNull()
    );
    expect(screen.getByText("Ativo")).toBeTruthy();
  });
});

function lead(over: Partial<LeadRow>): LeadRow {
  return {
    acvEstimadoCentavos: 500_000,
    canal: { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
    contatoEmail: "ana@meridian.com",
    contatoNome: "Ana",
    criadoEm: "2026-07-01T00:00:00.000Z",
    donoNome: "Vini",
    entrada: "MERIDIAN",
    estagio: "LEAD",
    estagioDesde: "2026-09-01T00:00:00.000Z",
    id: "lead-1",
    motivoPerda: null,
    nome: "Meridian Corp",
    notaPerda: null,
    origem: null,
    perdidoEm: null,
    perdidoNoEstagio: null,
    proposta: null,
    proximaAcao: "Ligar",
    proximaAcaoEm: "2026-09-10T00:00:00.000Z",
    situacao: "ATIVO",
    ...over,
  };
}

const DADOS_FUNIL: DadosFunil = {
  canais: [{ cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" }],
  estagios: [
    { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
    { codigo: "DISCOVERY", criterios: [], pesoPercent: 30, tetoDias: 14 },
    { codigo: "EVALUATION", criterios: [], pesoPercent: 60, tetoDias: 21 },
    { codigo: "PROPOSAL", criterios: [], pesoPercent: 80, tetoDias: 30 },
  ],
  historico: [],
  hoje: "2026-09-06T12:00:00.000Z",
  leads: [lead({})],
};

describe("Funil — recarregar que falha", () => {
  it("avisa que a lista pode estar desatualizada e oferece tentar de novo", async () => {
    mocks.moverEstagio.mockResolvedValue({ data: { id: "lead-1" }, ok: true });
    mocks.listarFunil
      .mockResolvedValueOnce({ error: "Banco indisponível.", ok: false })
      .mockResolvedValueOnce({ data: DADOS_FUNIL, ok: true });
    render(<Funil inicial={DADOS_FUNIL} podeEscrever />);

    const card = screen.getAllByRole("button", {
      name: "Abrir lead Meridian Corp",
    })[0];
    const coluna = screen.getByRole("group", { name: "Coluna Descoberta" });
    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(coluna, { dataTransfer: {} });

    const aviso = await screen.findByText(/Lista pode estar desatualizada/);
    expect(aviso.textContent).toContain("Banco indisponível.");
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    await waitFor(() => expect(mocks.listarFunil).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText(/Lista pode estar desatualizada/)).toBeNull()
    );
  });
});

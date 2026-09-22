/** @vitest-environment jsdom */
// fins-nomeados-onda9b.test.tsx — crítica R6, heurística 1: os últimos fins
// mudos. Criar e excluir ligação, excluir processo, tirar e devolver serviço,
// registrar reuso de IP e gravar a célula da semana no Caixa terminavam sem
// dizer nada; "Lançamento excluído." não dizia qual. Cada um agora termina
// num `<Confirmacao>` (role status) que nomeia o que mudou.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Caixa } from "@/app/(staff)/empresa/financeiro/caixa";
import { Lancamentos } from "@/app/(staff)/empresa/financeiro/lancamentos";
import type { DadosMapa } from "@/app/(staff)/ferramentas/processos/mapa";
import { Mapa } from "@/app/(staff)/ferramentas/processos/mapa";
import { Biblioteca } from "@/app/(staff)/ip/biblioteca";
import { Catalogo } from "@/app/(staff)/servicos/catalogo";
import type { CaixaView } from "@/app/actions/empresa/financeiro";
import type { EngagementRow } from "@/app/actions/engagements";
import type { IpAssetRow } from "@/app/actions/ip-library";
import type { ProcessoRow } from "@/app/actions/processos";
import type { ServiceRow } from "@/app/actions/services";
import type { LinhaDoLivro } from "@/lib/empresa/livro";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  criarLigacao: vi.fn(),
  excluirLancamento: vi.fn(),
  excluirLigacao: vi.fn(),
  excluirProcesso: vi.fn(),
  getIpAsset: vi.fn(),
  listServices: vi.fn(),
  listarLancamentos: vi.fn(),
  listarProcessos: vi.fn(),
  registrarReusoAction: vi.fn(),
  salvarSemana: vi.fn(),
  setServiceAtivoAction: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/processos", () => ({
  criarLigacao: mocks.criarLigacao,
  excluirLigacao: mocks.excluirLigacao,
  excluirProcesso: mocks.excluirProcesso,
  listarProcessos: mocks.listarProcessos,
}));
vi.mock("@/app/actions/services", () => ({
  createServiceAction: vi.fn(),
  listServices: mocks.listServices,
  setServiceAtivoAction: mocks.setServiceAtivoAction,
}));
vi.mock("@/app/actions/ip-library", () => ({
  createIpAssetAction: vi.fn(),
  getIpAsset: mocks.getIpAsset,
  registrarReusoAction: mocks.registrarReusoAction,
  updateIpAssetAction: vi.fn(),
}));
vi.mock("@/app/actions/empresa/financeiro", () => ({
  salvarSemana: mocks.salvarSemana,
}));
vi.mock("@/app/actions/empresa/livro", () => ({
  atualizarLancamento: vi.fn(),
  criarLancamento: vi.fn(),
  excluirLancamento: mocks.excluirLancamento,
  listarLancamentos: mocks.listarLancamentos,
}));

vi.setConfig({ testTimeout: 20_000 });

async function statusCom(texto: string) {
  await waitFor(() =>
    expect(
      screen.getAllByRole("status").some((s) => s.textContent === texto)
    ).toBe(true)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Mapa de processos ───────────────────────────────────────────────────────

function processo(over: Partial<ProcessoRow>): ProcessoRow {
  return {
    codigo: "PZ-01",
    descricao: "",
    diagram: null,
    diagramId: null,
    docUrl: null,
    dominio: "COMERCIAL",
    donoNome: null,
    id: "a",
    nivel: 2,
    nome: "Processo",
    revisadoEm: null,
    tags: [],
    tipo: "CORE",
    ...over,
  };
}

const DADOS: DadosMapa = {
  diagramas: [],
  ligacoes: [{ deId: "a", id: "e1", paraId: "b", rotulo: "converte em" }],
  processos: [
    processo({ codigo: "PZ-01", id: "a", nome: "Funil de leads" }),
    processo({ codigo: "PZ-02", id: "b", nome: "Gate de fase" }),
    processo({ codigo: "PZ-03", id: "c", nome: "Medição de CAC" }),
  ],
};

describe("Mapa de processos — fins nomeados", () => {
  beforeEach(() => {
    zerarRoteador("/ferramentas/processos");
    mocks.listarProcessos.mockResolvedValue({ data: DADOS, ok: true });
  });

  it("criar ligação diz com quem", async () => {
    mocks.criarLigacao.mockResolvedValue({ data: { id: "e2" }, ok: true });
    render(<Mapa inicial={DADOS} podeEscrever />);
    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));

    fireEvent.change(screen.getByLabelText("Destino da ligação"), {
      target: { value: "c" },
    });
    fireEvent.change(screen.getByLabelText("Rótulo da ligação"), {
      target: { value: "mede" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await statusCom("Ligação com Medição de CAC criada.");
  });

  it("remover ligação diz qual", async () => {
    mocks.excluirLigacao.mockResolvedValue({ data: { id: "e1" }, ok: true });
    render(<Mapa inicial={DADOS} podeEscrever />);
    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));

    fireEvent.click(screen.getByLabelText("Remover ligação com Gate de fase"));
    fireEvent.click(
      screen.getByLabelText("Confirmar remoção da ligação com Gate de fase")
    );

    await statusCom("Ligação com Gate de fase removida.");
  });

  it("excluir processo diz qual saiu do mapa", async () => {
    mocks.excluirProcesso.mockResolvedValue({ data: { id: "a" }, ok: true });
    render(<Mapa inicial={DADOS} podeEscrever />);
    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await statusCom("PZ-01 · Funil de leads excluído do mapa.");
  });
});

// ── Catálogo de serviços ────────────────────────────────────────────────────

const SERVICO: ServiceRow = {
  ativo: true,
  codigo: "SV-01",
  descricao: null,
  duracao: null,
  entregaveis: [],
  exigeLab: false,
  id: "s1",
  modalidade: "PROJETO",
  moduloVinculado: null,
  nome: "Kickoff",
  papeis: [],
  precoBaseCentavos: 100_000,
  preRequisitos: [],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
} as ServiceRow;

describe("Catálogo — tirar e devolver dizem qual serviço", () => {
  it("tirar do catálogo", async () => {
    mocks.setServiceAtivoAction.mockResolvedValue({ data: {}, ok: true });
    render(<Catalogo iniciais={[SERVICO]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Tirar do catálogo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await statusCom("SV-01 · Kickoff saiu do catálogo.");
  });

  it("devolver", async () => {
    mocks.setServiceAtivoAction.mockResolvedValue({ data: {}, ok: true });
    render(<Catalogo iniciais={[{ ...SERVICO, ativo: false }]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Devolver" }));

    await statusCom("SV-01 · Kickoff voltou ao catálogo.");
  });
});

// ── Biblioteca de IP ────────────────────────────────────────────────────────

const ATIVO: IpAssetRow = {
  atualizadoEm: "2026-09-01T00:00:00.000Z",
  descricao: null,
  dono: null,
  horasPoupadas: 0,
  id: "a1",
  licenca: "INTERNA",
  link: null,
  maturidade: "RASCUNHO",
  nome: "Playbook de discovery",
  origem: null,
  procedencia: "PROPRIA",
  reusos: 0,
  servicos: [],
  slug: "a1",
  tipo: "PLAYBOOK",
  versoes: 1,
} as IpAssetRow;

const ENGAJAMENTO: EngagementRow = {
  clienteNome: "Atlas",
  clienteSlug: "atlas",
  codigo: "ENG-07",
  fimEm: null,
  id: "e7",
  inicioEm: null,
  nome: "Diagnóstico",
  proximos: [],
  status: "ATIVO",
  valorCentavos: 0,
};

describe("Biblioteca — registrar reuso diz onde", () => {
  it("nomeia o ativo e o engajamento", async () => {
    zerarRoteador("/ip");
    mocks.registrarReusoAction.mockResolvedValue({
      data: { horasPoupadas: 4, maturidade: "RASCUNHO", reusos: 1 },
      ok: true,
    });
    render(
      <Biblioteca
        engajamentos={[ENGAJAMENTO]}
        iniciais={[ATIVO]}
        pessoas={[]}
        podeEscrever
        servicos={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Registrar reuso" }));
    fireEvent.change(screen.getByLabelText("Horas poupadas"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await statusCom(
      "Reuso de Playbook de discovery registrado em ENG-07 · Diagnóstico."
    );
  });
});

// ── Caixa ───────────────────────────────────────────────────────────────────

function semana(inicio: string) {
  return {
    contratosAssinadosCentavos: null,
    pipelinePonderadoCentavos: null,
    recebiveisCentavos: null,
    saidasComercialCentavos: null,
    saidasFornecedoresCentavos: null,
    saidasImpostosCentavos: null,
    saidasOutrasCentavos: null,
    saidasPessoalCentavos: null,
    saldoFinalCentavos: null,
    saldoInicialCentavos: null,
    saldoInicialEfetivoCentavos: null,
    semanaInicio: inicio,
    totalEntradasCentavos: null,
    totalSaidasCentavos: null,
  };
}

const CAIXA = {
  convPropostaAceitaPercent: null,
  intervalo: { ate: "2026-09-30", de: "2026-09-01" },
  referenciaPipelineCentavos: null,
  semanas: [semana("2026-09-02"), semana("2026-09-09")],
  totalPropostasAbertasCentavos: 0,
} as unknown as CaixaView;

describe("Caixa — a célula gravada diz qual", () => {
  it("nomeia a linha e a semana", async () => {
    mocks.salvarSemana.mockResolvedValue({ data: CAIXA, ok: true });
    render(<Caixa inicial={CAIXA} podeEscrever />);

    const celula = screen.getByLabelText("Saídas — pessoal 2026-09-09");
    fireEvent.change(celula, { target: { value: "1.500,00" } });
    fireEvent.blur(celula);

    await statusCom("Saídas — pessoal da semana de 09/09/2026 gravado.");
  });

  it("sair da célula sem mudar nada não grava nem anuncia", () => {
    render(<Caixa inicial={CAIXA} podeEscrever />);
    fireEvent.blur(screen.getByLabelText("Saídas — pessoal 2026-09-09"));
    expect(mocks.salvarSemana).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

// ── Lançamentos ─────────────────────────────────────────────────────────────

const LINHA: LinhaDoLivro = {
  competencia: "2026-09",
  conta: "4.1",
  contraparte: null,
  data: "2026-09-03",
  descricao: "Anúncios Google Ads",
  documento: null,
  id: "l1",
  nota: null,
  tituloId: null,
  valorCentavos: 150_000,
} as LinhaDoLivro;

describe("Lançamentos — excluir nomeia o lançamento", () => {
  it("diz qual lançamento saiu", async () => {
    mocks.excluirLancamento.mockResolvedValue({ data: { id: "l1" }, ok: true });
    mocks.listarLancamentos.mockResolvedValue({
      data: { contas: [], linhas: [] },
      ok: true,
    });
    zerarRoteador("/empresa/financeiro", "aba=lancamentos");
    render(
      <Lancamentos
        contaFiltro={null}
        inicial={{ contas: [], linhas: [LINHA] }}
        intervalo={{ ate: "2026-09-30", de: "2026-09-01" }}
        podeEscrever
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Excluir lançamento — Anúncios Google Ads",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await statusCom("Lançamento «Anúncios Google Ads» excluído.");
  });
});

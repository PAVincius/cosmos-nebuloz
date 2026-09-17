/** @vitest-environment jsdom */
// barreiras-onda5.test.tsx — crítica rodada 2 (25/40): regra do dono é
// barreira em toda operação sem volta, não só na destrutiva. Cinco faltavam:
// Aprovar (só Rejeitar confirmava), → Concluído (só Cancelado confirmava),
// soltar o card em Proposta (convertia sem perguntar enquanto o diálogo
// perguntava), Enviar ao jurídico / Marcar parecer recebido e o STANDING no
// `onChange`, e Baixar título (gera lançamento no razão com um botão só).
//
// Por item: gatilho não chama a action; o alvo aparece escrito; Confirmar
// chama com o payload certo; Voltar não chama. Ligar o gatilho direto na
// action derruba a primeira linha de cada bloco.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decisao } from "@/app/(staff)/aprovacoes/decisao";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import { Painel } from "@/app/(staff)/empresa/consentimento/painel";
import {
  Titulos,
  type TitulosPayload,
} from "@/app/(staff)/empresa/financeiro/titulos";
import { type DadosFunil, Funil } from "@/app/(staff)/funil/funil";
import type { ConsentimentoView } from "@/app/actions/empresa/consentimento";
import type { EngagementRow } from "@/app/actions/engagements";
import type { LeadRow } from "@/app/actions/leads";
import type { TituloRow } from "@/lib/empresa/livro";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  baixarTitulo: vi.fn(),
  converterEmProposta: vi.fn(),
  decidePlatformApprovalAction: vi.fn(),
  lerConsentimento: vi.fn(),
  listEngagements: vi.fn(),
  listarFunil: vi.fn(),
  listarTitulos: vi.fn(),
  marcarParecer: vi.fn(),
  salvarDecisao: vi.fn(),
  setEngagementStatusAction: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: mocks.decidePlatformApprovalAction,
}));
vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: vi.fn(),
  listEngagements: mocks.listEngagements,
  setEngagementStatusAction: mocks.setEngagementStatusAction,
}));
vi.mock("@/app/actions/leads", () => ({
  converterEmProposta: mocks.converterEmProposta,
  criarLead: vi.fn(),
  listarFunil: mocks.listarFunil,
  marcarPerdido: vi.fn(),
  moverEstagio: vi.fn(),
  registrarProximaAcao: vi.fn(),
}));
vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: vi.fn(),
  lerEstagio: vi.fn(),
}));
vi.mock("@/app/actions/empresa/consentimento", () => ({
  lerConsentimento: mocks.lerConsentimento,
  marcarParecer: mocks.marcarParecer,
  responderPergunta: vi.fn(),
  salvarDecisao: mocks.salvarDecisao,
}));
vi.mock("@/app/actions/empresa/titulos", () => ({
  baixarTitulo: mocks.baixarTitulo,
  cancelarTitulo: vi.fn(),
  criarTitulo: vi.fn(),
  listarTitulos: mocks.listarTitulos,
}));

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
});

// ── 1. Aprovar ──

describe("Aprovações — aprovar", () => {
  beforeEach(() => {
    mocks.decidePlatformApprovalAction.mockResolvedValue({
      data: { status: "APPROVED" },
      ok: true,
    });
  });

  it("o clique em Aprovar não decide, mostra o alvo e o que o servidor faz", () => {
    render(<Decisao alvo="Desconto 30% · Atlas" canWrite id="ap-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    expect(mocks.decidePlatformApprovalAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Desconto 30% · Atlas/)).toBeTruthy();
    expect(screen.getByText(/registrada com o seu nome/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });

  it("Confirmar chama com APPROVED e a nota; o fim é anunciado", async () => {
    render(<Decisao alvo="Desconto 30% · Atlas" canWrite id="ap-1" />);

    fireEvent.change(screen.getByLabelText("Nota da decisão"), {
      target: { value: "Cliente estratégico." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.decidePlatformApprovalAction).toHaveBeenCalledTimes(1)
    );
    expect(mocks.decidePlatformApprovalAction).toHaveBeenCalledWith({
      id: "ap-1",
      nota: "Cliente estratégico.",
      outcome: "APPROVED",
    });
    const fim = await screen.findByRole("status");
    expect(fim.textContent).toContain("Aprovado");
  });

  it("Voltar não decide", () => {
    render(<Decisao canWrite id="ap-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(mocks.decidePlatformApprovalAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
  });
});

// ── 2. → Concluído ──

const ENG_ATIVO: EngagementRow = {
  clienteNome: "Atlas",
  clienteSlug: "atlas",
  codigo: "ENG-01",
  fimEm: null,
  id: "e1",
  inicioEm: "2026-09-01",
  nome: "Diagnóstico",
  proximos: ["PAUSADO", "CONCLUIDO", "CANCELADO"],
  status: "ATIVO",
  valorCentavos: 1_200_000,
};

describe("Engajamentos — → Concluído", () => {
  beforeEach(() => {
    mocks.setEngagementStatusAction.mockResolvedValue({
      data: { id: "e1" },
      ok: true,
    });
    mocks.listEngagements.mockResolvedValue({ data: [ENG_ATIVO], ok: true });
  });

  function montar() {
    render(
      <Engajamentos
        clientes={[]}
        iniciais={[ENG_ATIVO]}
        podeEscrever
        servicos={[]}
      />
    );
  }

  it("o clique em → Concluído não muda o status e mostra o alvo", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "→ Concluído" }));

    expect(mocks.setEngagementStatusAction).not.toHaveBeenCalled();
    expect(screen.getByText(/ENG-01 · Diagnóstico/)).toBeTruthy();
    expect(screen.getByText(/não pode ser reaberto/)).toBeTruthy();
  });

  it("Confirmar chama setEngagementStatusAction com CONCLUIDO", async () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "→ Concluído" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.setEngagementStatusAction).toHaveBeenCalledTimes(1)
    );
    expect(mocks.setEngagementStatusAction).toHaveBeenCalledWith({
      id: "e1",
      status: "CONCLUIDO",
    });
  });

  it("Voltar não muda o status; → Pausado continua sem barreira", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "→ Concluído" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(mocks.setEngagementStatusAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "→ Pausado" }));
    expect(mocks.setEngagementStatusAction).toHaveBeenCalledWith({
      id: "e1",
      status: "PAUSADO",
    });
  });
});

// ── 3. Soltar o card em Proposta ──

function lead(over: Partial<LeadRow>): LeadRow {
  return {
    acvEstimadoCentavos: 500_000,
    canal: { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
    contatoEmail: "ana@meridian.com",
    contatoNome: "Ana",
    criadoEm: "2026-07-01T00:00:00.000Z",
    donoNome: "Vini",
    entrada: "MERIDIAN",
    estagio: "EVALUATION",
    estagioDesde: "2026-09-01T00:00:00.000Z",
    id: "lead-2",
    motivoPerda: null,
    nome: "Scaffold Ltda",
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

describe("Funil — soltar o card em Proposta", () => {
  beforeEach(() => {
    mocks.listarFunil.mockResolvedValue({ data: DADOS_FUNIL, ok: true });
    mocks.converterEmProposta.mockResolvedValue({
      data: { id: "prop-1" },
      ok: true,
    });
  });

  function soltarEmProposta() {
    render(<Funil inicial={DADOS_FUNIL} podeEscrever />);
    const colunaDeOrigem = screen.getByRole("group", {
      name: "Coluna Avaliação",
    });
    const card = within(colunaDeOrigem).getByRole("button", {
      name: "Abrir lead Scaffold Ltda",
    });
    const coluna = screen.getByRole("group", { name: "Coluna Proposta" });
    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(coluna, { dataTransfer: {} });
  }

  it("soltar não converte: abre o diálogo do lead já na pergunta de conversão", () => {
    soltarEmProposta();

    expect(mocks.converterEmProposta).not.toHaveBeenCalled();
    const dialogo = screen.getByRole("dialog");
    expect(
      within(dialogo).getByText(/vira rascunho de proposta; não volta/)
    ).toBeTruthy();
    expect(
      within(dialogo).getByRole("button", { name: "Confirmar" })
    ).toBeTruthy();
  });

  it("Confirmar no diálogo é o que converte", async () => {
    soltarEmProposta();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      })
    );

    await waitFor(() =>
      expect(mocks.converterEmProposta).toHaveBeenCalledTimes(1)
    );
    expect(mocks.converterEmProposta).toHaveBeenCalledWith({ id: "lead-2" });
  });

  it("Voltar não converte e o diálogo continua aberto", () => {
    soltarEmProposta();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar" })
    );

    expect(mocks.converterEmProposta).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Converter em proposta",
      })
    ).toBeTruthy();
  });
});

// ── 4. Parecer jurídico e consentimento permanente ──

const VIEW: ConsentimentoView = {
  abertas: 0,
  avisos: [],
  camposEmAberto: [],
  decisao: {
    baseLegal: "SEM_DECISAO",
    contatoTitular: null,
    ferramenta: null,
    parecer: "PENDENTE",
    parecerEnviadoEm: null,
    parecerRecebidoEm: null,
    prazoRetencao: null,
    standingHabilitavel: null,
  },
  perguntas: [],
};

describe("Consentimento — parecer jurídico", () => {
  beforeEach(() => {
    mocks.marcarParecer.mockResolvedValue({ data: VIEW.decisao, ok: true });
    mocks.lerConsentimento.mockResolvedValue({ data: VIEW, ok: true });
  });

  it("Enviar ao jurídico não grava no clique e diz o que muda", () => {
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Enviar ao jurídico" }));

    expect(mocks.marcarParecer).not.toHaveBeenCalled();
    expect(screen.getByText(/não volta a pendente/)).toBeTruthy();
  });

  it("Confirmar chama marcarParecer com ENVIADO; Voltar não", async () => {
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Enviar ao jurídico" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(mocks.marcarParecer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enviar ao jurídico" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mocks.marcarParecer).toHaveBeenCalledTimes(1));
    expect(mocks.marcarParecer).toHaveBeenCalledWith({ status: "ENVIADO" });
  });

  it("Marcar parecer recebido também passa pela barreira", async () => {
    const enviado: ConsentimentoView = {
      ...VIEW,
      decisao: { ...VIEW.decisao, parecer: "ENVIADO" },
    };
    render(<Painel inicial={enviado} podeEscrever />);

    fireEvent.click(
      screen.getByRole("button", { name: "Marcar parecer recebido" })
    );
    expect(mocks.marcarParecer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.marcarParecer).toHaveBeenCalledTimes(1));
    expect(mocks.marcarParecer).toHaveBeenCalledWith({ status: "RECEBIDO" });
  });
});

describe("Consentimento — consentimento permanente habilitável", () => {
  beforeEach(() => {
    mocks.salvarDecisao.mockResolvedValue({ data: VIEW.decisao, ok: true });
    mocks.lerConsentimento.mockResolvedValue({ data: VIEW, ok: true });
  });

  it("o rótulo é humano, não o enum STANDING", () => {
    render(<Painel inicial={VIEW} podeEscrever />);

    expect(
      screen.getByLabelText(/Consentimento permanente habilitável/)
    ).toBeTruthy();
    expect(screen.queryByText(/STANDING/)).toBeNull();
  });

  it("marcar não grava no onChange: aparece a pergunta", () => {
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(
      screen.getByLabelText(/Consentimento permanente habilitável/)
    );

    expect(mocks.salvarDecisao).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });

  it("Confirmar grava standingHabilitavel; Voltar devolve a caixa ao valor anterior", async () => {
    render(<Painel inicial={VIEW} podeEscrever />);
    const caixa = screen.getByLabelText<HTMLInputElement>(
      /Consentimento permanente habilitável/
    );

    fireEvent.click(caixa);
    expect(caixa.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(caixa.checked).toBe(false);
    expect(mocks.salvarDecisao).not.toHaveBeenCalled();

    fireEvent.click(caixa);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mocks.salvarDecisao).toHaveBeenCalledTimes(1));
    expect(mocks.salvarDecisao).toHaveBeenCalledWith({
      standingHabilitavel: true,
    });
  });
});

// ── 5. Baixar título ──

const TITULO: TituloRow = {
  baixadoEm: null,
  clienteSlug: null,
  competenciaBaixa: null,
  conta: "5.1",
  contraparte: "AWS",
  descricao: "Hospedagem AWS",
  emissao: "2026-09-01",
  id: "t1",
  motivoCancelamento: null,
  status: "ABERTO",
  tipo: "PAGAR",
  valorCentavos: 300_000,
  vencimento: "2026-10-01",
};

const PAYLOAD_TITULOS: TitulosPayload = {
  contas: [
    {
      ativa: true,
      centroDeCusto: "produto-engenharia",
      conta: "5.1",
      grupo: 5,
      nome: "Infra e nuvem",
      ordem: 0,
    },
  ],
  titulos: [TITULO],
};

describe("Títulos — baixar", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    mocks.baixarTitulo.mockResolvedValue({ data: { id: "t1" }, ok: true });
    mocks.listarTitulos.mockResolvedValue({ data: PAYLOAD_TITULOS, ok: true });
  });

  function abrirBaixa() {
    render(<Titulos inicial={PAYLOAD_TITULOS} podeEscrever />);
    fireEvent.click(
      screen.getByRole("button", { name: "Baixar — Hospedagem AWS" })
    );
  }

  it("Confirmar baixa não grava no clique: mostra valor, data e que só se estorna", () => {
    abrirBaixa();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));

    expect(mocks.baixarTitulo).not.toHaveBeenCalled();
    const dialogo = screen.getByRole("dialog");
    // O alvo leva o valor; a consequência leva valor, data e o que não volta.
    expect(
      within(dialogo).getByText(/Hospedagem AWS · R\$.3\.000,00/)
    ).toBeTruthy();
    expect(
      within(dialogo).getByText(
        /lançamento de R\$.3\.000,00 no livro em 15\/09\/2026.*estorno/
      )
    ).toBeTruthy();
  });

  it("Confirmar chama baixarTitulo com data e competência; Voltar não", async () => {
    abrirBaixa();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(mocks.baixarTitulo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mocks.baixarTitulo).toHaveBeenCalledTimes(1));
    expect(mocks.baixarTitulo).toHaveBeenCalledWith({
      competencia: "2026-09",
      data: "2026-09-15",
      id: "t1",
    });
  });
});

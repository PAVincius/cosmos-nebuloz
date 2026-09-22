/** @vitest-environment jsdom */
// vazios-e-jargao.test.tsx — heurísticas 1 (status) e 4 (consistência).
//
// As quatro abas do Financeiro mostravam `<thead>` sem linha: nada dizia se
// era falta de dado ou falha. O caixa escondia a data da semana em `title`.
// A fila de gates travava o botão sem dizer que faltam caracteres, usava
// Assess/Pilot/Scale/Embed sem legenda e um grid de seis colunas sem
// cabeçalho. Readiness dizia só "Nenhuma avaliação ainda.", Resumo dizia
// "Health", e dois plurais eram "item(ns)".
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbaResumo } from "@/app/(staff)/clientes/[slug]/abas/resumo";
import { Caixa } from "@/app/(staff)/empresa/financeiro/caixa";
import { Lancamentos } from "@/app/(staff)/empresa/financeiro/lancamentos";
import { Orcado } from "@/app/(staff)/empresa/financeiro/orcado";
import { Recorrente } from "@/app/(staff)/empresa/financeiro/recorrente";
import { Titulos } from "@/app/(staff)/empresa/financeiro/titulos";
import { Lista } from "@/app/(staff)/growth/readiness/lista";
import { FilaDeGates } from "@/app/(staff)/scaffold/fila-de-gates";
import type { CaixaView, ContaView } from "@/app/actions/empresa/financeiro";
import type { QueueEntry } from "@/app/actions/scaffold-supervision";
import { SeletorDeAcervo } from "@/components/seletor-de-acervo";
import type { TituloRow } from "@/lib/empresa/livro";

vi.mock("@/app/actions/empresa/titulos", () => ({
  baixarTitulo: vi.fn(),
  cancelarTitulo: vi.fn(),
  criarTitulo: vi.fn(),
  listarTitulos: vi.fn(),
}));
vi.mock("@/app/actions/empresa/livro", () => ({
  atualizarLancamento: vi.fn(),
  criarLancamento: vi.fn(),
  excluirLancamento: vi.fn(),
  listarLancamentos: vi.fn(),
}));
vi.mock("@/app/actions/empresa/orcamento", () => ({
  lerOrcado: vi.fn(),
  salvarOrcamento: vi.fn(),
}));
vi.mock("@/app/actions/empresa/recorrente", () => ({
  alterarValor: vi.fn(),
  criarAssinatura: vi.fn(),
  encerrarAssinatura: vi.fn(),
  listarRecorrente: vi.fn(),
  salvarCreditoDoMes: vi.fn(),
}));
vi.mock("@/app/actions/empresa/financeiro", () => ({
  salvarSemana: vi.fn(),
}));
vi.mock("@/app/actions/clients", () => ({ listClients: vi.fn() }));
vi.mock("@/app/actions/maturidade", () => ({ criarAvaliacao: vi.fn() }));
vi.mock("@/app/actions/scaffold-supervision", () => ({
  enterTenantContext: vi.fn(),
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.setConfig({ testTimeout: 30_000 });

const INTERVALO = { ate: "2026-09-30", de: "2026-09-01" };

const CONTA: ContaView = {
  ativa: true,
  centroDeCusto: "produto-engenharia",
  conta: "5.1",
  grupo: 5,
  nome: "Infra e nuvem",
  ordem: 0,
};

const TITULO: TituloRow = {
  baixadoEm: null,
  clienteSlug: null,
  competenciaBaixa: null,
  conta: "5.1",
  contraparte: "Vercel",
  descricao: "Hospedagem",
  emissao: "2026-09-01",
  id: "t1",
  motivoCancelamento: null,
  status: "ABERTO",
  tipo: "PAGAR",
  valorCentavos: 100_000,
  vencimento: "2099-12-31",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Financeiro — vazios que ensinam", () => {
  it("Títulos sem nada: cada lista diz o que a alimenta e aponta 'Novo título'", () => {
    render(<Titulos inicial={{ contas: [CONTA], titulos: [] }} podeEscrever />);
    const vazios = screen.getAllByText(/Novo título/, { selector: "p" });
    expect(vazios).toHaveLength(2);
    expect(vazios[0].textContent).toMatch(/a pagar/i);
    expect(vazios[1].textContent).toMatch(/a receber/i);
    expect(screen.queryByRole("columnheader")).toBeNull();
  });

  it("Títulos com filtro que não bate: diz que é o filtro, não o cadastro", () => {
    render(
      <Titulos inicial={{ contas: [CONTA], titulos: [TITULO] }} podeEscrever />
    );
    fireEvent.click(screen.getByRole("button", { name: "Baixados" }));
    const vazios = screen.getAllByText(/Nenhum título .*baixado/);
    expect(vazios.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Novo título/, { selector: "p" })).toBeNull();
  });

  it("Lançamentos sem nada no período: explica de onde vêm e o que fazer", () => {
    render(
      <Lancamentos
        contaFiltro={null}
        inicial={{ contas: [CONTA], linhas: [] }}
        intervalo={INTERVALO}
        podeEscrever
      />
    );
    const vazio = screen.getByText(/Novo lançamento/, { selector: "p" });
    expect(vazio.textContent).toMatch(/período/);
    expect(screen.queryByRole("columnheader")).toBeNull();
  });

  it("Lançamentos com busca que não bate: diz que é o filtro", () => {
    render(
      <Lancamentos
        contaFiltro={null}
        inicial={{
          contas: [CONTA],
          linhas: [
            {
              competencia: "2026-09",
              conta: "5.1",
              contraparte: "Vercel",
              data: "2026-09-03",
              descricao: "Hospedagem",
              documento: null,
              id: "l1",
              nota: null,
              tituloId: null,
              valorCentavos: 100_000,
            },
          ],
        }}
        intervalo={INTERVALO}
        podeEscrever
      />
    );
    fireEvent.change(
      screen.getByLabelText("Buscar por descrição ou contraparte"),
      { target: { value: "zzz" } }
    );
    expect(screen.getByText(/Nenhum lançamento .*busca/)).toBeTruthy();
  });

  it("Orçado sem plano de contas: diz que o plano está vazio e aponta a aba", () => {
    render(
      <Orcado
        inicial={{ competencias: ["2026-09"], contas: [] }}
        intervalo={INTERVALO}
        podeEscrever
      />
    );
    const vazio = screen.getByText(/Plano de contas/, { selector: "p" });
    expect(within(vazio).getByRole("link").getAttribute("href")).toContain(
      "aba=plano"
    );
    expect(screen.queryByRole("columnheader")).toBeNull();
  });

  it("Recorrente sem assinatura: diz o que a aba mede e aponta 'Nova assinatura'", () => {
    render(
      <Recorrente
        competencia="2026-09"
        inicial={{
          assinaturas: [],
          creditos: [],
          lancamentosDaCompetencia: {},
          mudancas: [],
        }}
        podeEscrever
      />
    );
    const vazio = screen.getByText(/Nova assinatura/, { selector: "p" });
    expect(vazio.textContent).toMatch(/MRR/);
    expect(screen.queryByRole("columnheader")).toBeNull();
  });
});

const CAIXA: CaixaView = {
  convPropostaAceitaPercent: null,
  intervalo: { ate: "2026-09-30", de: "2026-09-01" },
  referenciaPipelineCentavos: null,
  semanas: [
    {
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
      semanaInicio: "2026-09-02",
      totalEntradasCentavos: null,
      totalSaidasCentavos: null,
    },
    {
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
      semanaInicio: "2026-09-09",
      totalEntradasCentavos: null,
      totalSaidasCentavos: null,
    },
  ],
  totalPropostasAbertasCentavos: 0,
} as CaixaView;

describe("Caixa — a data da semana é visível", () => {
  it("cada cabeçalho diz 'S1 · 02/09', não só S1 com a data em title", () => {
    render(<Caixa inicial={CAIXA} podeEscrever={false} />);
    const cabecalhos = screen.getAllByRole("columnheader");
    expect(cabecalhos.map((c) => c.textContent)).toEqual([
      "Linha",
      "S1 · 02/09",
      "S2 · 09/09",
    ]);
  });
});

const ENTRADA: QueueEntry = {
  ageDays: 3,
  ageLabel: "3 d",
  criteriaMet: 2,
  criteriaTotal: 4,
  kind: "sign-off",
  orgName: "Acme Saúde",
  phase: "PILOT",
  phaseInstanceId: "pi-1",
  trackCode: "TRK-42",
  trackId: "trk-42",
};

describe("Fila de gates — legenda, cabeçalho e contador", () => {
  it("as quatro fases e os termos gate/trilha têm definição visível", () => {
    render(<FilaDeGates iniciais={[ENTRADA]} />);
    const legenda = screen.getByLabelText("Legenda");
    expect(legenda.tagName).toBe("DL");
    for (const termo of [
      "Assess",
      "Pilot",
      "Scale",
      "Embed",
      "Gate",
      "Trilha",
    ]) {
      expect(within(legenda).getByText(termo)).toBeTruthy();
    }
  });

  it("as colunas da fila têm cabeçalho", () => {
    render(<FilaDeGates iniciais={[ENTRADA]} />);
    const cabecalhos = screen.getAllByRole("columnheader");
    expect(cabecalhos.map((c) => c.textContent)).toEqual([
      "Trilha",
      "Organização",
      "Fase",
      "Idade",
      "Critérios",
      "",
    ]);
  });

  it("o motivo mostra 'n/12' enquanto o botão está travado", () => {
    render(<FilaDeGates iniciais={[ENTRADA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar no cliente" }));
    const campo = screen.getByLabelText("Por que precisa entrar");
    expect(screen.getByText(/0\/12/)).toBeTruthy();
    fireEvent.change(campo, { target: { value: "revisar" } });
    expect(screen.getByText(/7\/12/)).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /Registrar e entrar/ })
        .hasAttribute("disabled")
    ).toBe(true);
    fireEvent.change(campo, { target: { value: "revisar o log do piloto" } });
    expect(
      screen
        .getByRole("button", { name: /Registrar e entrar/ })
        .hasAttribute("disabled")
    ).toBe(false);
  });
});

describe("Readiness — vazio que ensina", () => {
  it("diz o que uma avaliação é e aponta o formulário acima", () => {
    render(<Lista avaliacoes={[]} podeEscrever totalDeCriterios={12} />);
    const vazio = screen.getByText(/Nenhuma avaliação/, { selector: "p" });
    expect(vazio.textContent).toMatch(/Criar e responder/);
    expect(vazio.textContent).toMatch(/12 critérios/);
  });
});

describe("Copy e plurais", () => {
  it("Resumo do cliente diz 'Saúde', não 'Health'", () => {
    render(
      <AbaResumo
        acoesDeModulo={null}
        integracoes={{ data: [], ok: true }}
        modulos={[]}
      />
    );
    expect(screen.getByText("Saúde")).toBeTruthy();
    expect(screen.queryByText("Health")).toBeNull();
  });

  it("SeletorDeAcervo: '1 item' e '2 itens', não 'item(ns)'", () => {
    const { rerender } = render(
      <SeletorDeAcervo
        icone="book"
        itens={[{ detalhe: "v1", id: "a", titulo: "A" }]}
        onSelecionar={() => {}}
        selecionadoId={null}
        titulo="Acervo"
        vazio="Acervo vazio."
      />
    );
    expect(screen.getByText("1 item")).toBeTruthy();
    rerender(
      <SeletorDeAcervo
        icone="book"
        itens={[
          { detalhe: "v1", id: "a", titulo: "A" },
          { detalhe: "v1", id: "b", titulo: "B" },
        ]}
        onSelecionar={() => {}}
        selecionadoId={null}
        titulo="Acervo"
        vazio="Acervo vazio."
      />
    );
    expect(screen.getByText("2 itens")).toBeTruthy();
    expect(screen.queryByText(/item\(ns\)/)).toBeNull();
  });
});

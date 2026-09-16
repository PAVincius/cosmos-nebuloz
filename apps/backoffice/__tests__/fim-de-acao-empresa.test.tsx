/** @vitest-environment jsdom */
// fim-de-acao-empresa.test.tsx — heurísticas 1 (status), 7 (eficiência) e 9
// (recuperação) em Fornecedores e CAC: exportar e salvar travam e trocam o
// rótulo enquanto pendentes; "Salvar revisão" só quando há o que salvar;
// campo somente leitura se declara; filtro sem resultado tem saída; o `*` da
// tabela tem legenda; e o resultado do CAC — o número que a tela existe para
// dar — vem antes das parcelas, com "faltam N de 8" quando incompleto.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Painel } from "@/app/(staff)/empresa/cac/painel";
import { Inventario } from "@/app/(staff)/empresa/fornecedores/inventario";
import type { CacView } from "@/app/actions/empresa/cac";
import type { FornecedorDpaRow } from "@/app/actions/empresa/fornecedores";
import { pendenteAteOFim } from "../vitest-mocks/pendente";

const mocks = vi.hoisted(() => ({
  aplicarAcaoDpa: vi.fn(),
  exportarAoCharter: vi.fn(),
  salvarAlocacao: vi.fn(),
  salvarConversao: vi.fn(),
  salvarParcelas: vi.fn(),
}));

vi.mock("@/app/actions/empresa/fornecedores", () => ({
  aplicarAcaoDpa: mocks.aplicarAcaoDpa,
  exportarAoCharter: mocks.exportarAoCharter,
}));
vi.mock("@/app/actions/empresa/cac", () => ({
  salvarAlocacao: mocks.salvarAlocacao,
  salvarConversao: mocks.salvarConversao,
  salvarParcelas: mocks.salvarParcelas,
}));
// O seletor de período puxa Radix + calendário; aqui só o painel interessa.
vi.mock("@/components/seletor-de-periodo", () => ({
  SeletorDePeriodo: () => null,
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

const FORNECEDOR: FornecedorDpaRow = {
  acaoPendente: null,
  acoes: [],
  assinadoEm: "2026-08-01T00:00:00.000Z",
  bloqueiaVenda: false,
  classificacaoProvisoria: false,
  codigo: "V-01",
  donoPapel: "CTO",
  dpaUrl: null,
  estado: "ASSINADO",
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

const CAC: CacView = {
  alocacoes: [],
  competenciaEditavel: "2026-09",
  competencias: ["2026-09"],
  conversao: {
    convDiscoveryEvaluationPercent: null,
    convEvaluationPropostaPercent: null,
    convLeadDiscoveryPercent: null,
    convPropostaAceitaPercent: null,
  },
  editavel: true,
  intervalo: { ate: "2026-09-30", de: "2026-09-01" },
  mensalidadeReferenciaCentavos: null,
  parcelas: {
    "4.1": 100_000,
    "4.2": 100_000,
    "4.3": null,
    "4.4": null,
    "4.5": null,
    "4.6": null,
    clientesGanhos: null,
    entregaDiagnosticoCentavos: null,
  },
  resultado: {
    cacCentavos: null,
    paybackMeses: null,
    porProduto: [],
    preenchidas: 2,
    total: 8,
  },
  sugestaoClientesGanhos: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Inventário — exportar ao Charter", () => {
  it("Confirmar duas vezes rápido chama a action uma vez e o gatilho diz Exportando…", async () => {
    mocks.exportarAoCharter.mockReturnValue(pendenteAteOFim());
    render(<Inventario iniciais={[FORNECEDOR]} podeEscrever />);

    fireEvent.click(
      screen.getByRole("button", { name: "Exportar para o Charter" })
    );
    const confirmar = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);

    await waitFor(() =>
      expect(mocks.exportarAoCharter).toHaveBeenCalledTimes(1)
    );
    expect(screen.getByText(/Exportando…/)).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Executando…" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("sucesso confirma em texto com role=status", async () => {
    mocks.exportarAoCharter.mockResolvedValue({
      data: { exportados: ["V-01"], semCorrespondente: [] },
      ok: true,
    });
    render(<Inventario iniciais={[FORNECEDOR]} podeEscrever />);

    fireEvent.click(
      screen.getByRole("button", { name: "Exportar para o Charter" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const aviso = await screen.findByRole("status");
    expect(aviso.textContent).toContain("1 exportado ao Charter");
  });
});

describe("Inventário — filtro vazio e legenda", () => {
  it("filtro sem resultado diz isso e Limpar filtro volta a mostrar as linhas", () => {
    render(<Inventario iniciais={[FORNECEDOR]} podeEscrever={false} />);

    fireEvent.click(screen.getByRole("button", { name: "A assinar" }));

    expect(screen.getByText("Nenhum fornecedor com este filtro.")).toBeTruthy();
    expect(screen.queryByText("Vercel")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro" }));

    expect(screen.getByText("Vercel")).toBeTruthy();
    expect(screen.queryByText("Nenhum fornecedor com este filtro.")).toBeNull();
  });

  it("o * de classificação provisória tem legenda no rodapé da tabela", () => {
    const { unmount } = render(
      <Inventario
        iniciais={[{ ...FORNECEDOR, classificacaoProvisoria: true }]}
        podeEscrever={false}
      />
    );
    expect(screen.getByText(/^\* classificação provisória/)).toBeTruthy();
    unmount();

    render(<Inventario iniciais={[FORNECEDOR]} podeEscrever={false} />);
    expect(screen.queryByText(/^\* classificação provisória/)).toBeNull();
  });
});

describe("CAC — salvar parcelas", () => {
  it("sem alteração o botão diz Sem alterações e fica desabilitado; editar libera", () => {
    render(<Painel inicial={CAC} podeEscrever />);

    const antes = screen.getByRole("button", { name: "Sem alterações" });
    expect(antes.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Custo de entrega do diagnóstico"), {
      target: { value: "1.000,00" },
    });

    const depois = screen.getByRole("button", { name: "Salvar revisão" });
    expect(depois.hasAttribute("disabled")).toBe(false);
  });

  it("clicar Salvar revisão duas vezes rápido chama a action uma vez e diz Salvando…", async () => {
    mocks.salvarParcelas.mockReturnValue(pendenteAteOFim());
    render(<Painel inicial={CAC} podeEscrever />);
    fireEvent.change(screen.getByLabelText("Custo de entrega do diagnóstico"), {
      target: { value: "1.000,00" },
    });

    const botao = screen.getByRole("button", { name: "Salvar revisão" });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() => expect(mocks.salvarParcelas).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: "Salvando…" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("Salvar pesos e Salvar conversão travam e trocam o rótulo enquanto pendentes", async () => {
    mocks.salvarAlocacao.mockReturnValue(pendenteAteOFim());
    mocks.salvarConversao.mockReturnValue(pendenteAteOFim());
    render(<Painel inicial={CAC} podeEscrever />);

    const pesos = screen.getByRole("button", { name: "Salvar pesos" });
    fireEvent.click(pesos);
    fireEvent.click(pesos);
    await waitFor(() => expect(mocks.salvarAlocacao).toHaveBeenCalledTimes(1));
    expect(
      screen
        .getByRole("button", { name: "Salvando pesos…" })
        .hasAttribute("disabled")
    ).toBe(true);

    const conv = screen.getByRole("button", { name: "Salvar conversão" });
    fireEvent.click(conv);
    fireEvent.click(conv);
    await waitFor(() => expect(mocks.salvarConversao).toHaveBeenCalledTimes(1));
    expect(
      screen
        .getByRole("button", { name: "Salvando conversão…" })
        .hasAttribute("disabled")
    ).toBe(true);
  });
});

describe("CAC — leitura, resultado e escala", () => {
  it("campo somente leitura se declara (aria-readonly) e tem estilo de leitura", () => {
    render(<Painel inicial={{ ...CAC, editavel: false }} podeEscrever />);

    const campo = screen.getByLabelText("Custo de entrega do diagnóstico");
    expect(campo.getAttribute("aria-readonly")).toBe("true");
    expect(campo.hasAttribute("readonly")).toBe(true);
    expect(campo.style.background).toBe("var(--surface-2)");
    // Sem moldura de campo: lê-se como valor, não como algo a preencher.
    expect(campo.style.border).toBe("1px solid transparent");
  });

  it("o resultado vem antes das parcelas e diz quantas faltam quando incompleto", () => {
    render(<Painel inicial={CAC} podeEscrever={false} />);

    const resultado = screen.getByText("faltam 6 de 8 parcelas");
    const parcelas = screen.getByText("Parcelas do período");
    // `parcelas` vem depois de `resultado` no documento (e não o contém).
    expect(resultado.compareDocumentPosition(parcelas)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("o número do CAC usa a escala de tipo do painel, não px literal", () => {
    render(
      <Painel
        inicial={{
          ...CAC,
          resultado: { ...CAC.resultado, cacCentavos: 250_000, preenchidas: 8 },
        }}
        podeEscrever={false}
      />
    );

    const numero = screen.getByText("R$ 2.500,00");
    expect(numero.style.fontSize).toBe("var(--fs-display)");
  });
});

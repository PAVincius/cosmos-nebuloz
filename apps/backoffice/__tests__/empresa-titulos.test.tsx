/** @vitest-environment jsdom */
// empresa-titulos.test.tsx — Task 6, spec 2026-09-06 §4. Prova a aba Títulos
// (`titulos.tsx` + `titulo-dialogs.tsx`): duas listas (a pagar/a receber), o
// envelhecimento no topo, os chips de situação, os três diálogos (novo,
// baixar, cancelar) e `podeEscrever={false}` escondendo as três escritas.
// Relógio congelado em 2026-09-15T12:00:00Z — mesma data que `situacaoDoTitulo`
// e `envelhecimento` usam para classificar os títulos ABERTO da fixture.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Titulos } from "@/app/(staff)/empresa/financeiro/titulos";
import type { ContaView } from "@/app/actions/empresa/financeiro";
import { formatarBRL } from "@/lib/comercial/formato";
import type { TituloRow } from "@/lib/empresa/livro";

const {
  listarTitulosMock,
  criarTituloMock,
  baixarTituloMock,
  cancelarTituloMock,
} = vi.hoisted(() => ({
  baixarTituloMock: vi.fn(),
  cancelarTituloMock: vi.fn(),
  criarTituloMock: vi.fn(),
  listarTitulosMock: vi.fn(),
}));

vi.mock("@/app/actions/empresa/titulos", () => ({
  baixarTitulo: baixarTituloMock,
  cancelarTitulo: cancelarTituloMock,
  criarTitulo: criarTituloMock,
  listarTitulos: listarTitulosMock,
}));

const ESPACO_DURO = / /g;
function dinheiro(centavos: number): string {
  return formatarBRL(centavos).replace(ESPACO_DURO, " ");
}

const CONTAS: ContaView[] = [
  {
    ativa: true,
    centroDeCusto: "produto-engenharia",
    conta: "5.1",
    grupo: 5,
    nome: "Infra e nuvem",
    ordem: 0,
  },
];

function tituloFactory(over: Partial<TituloRow>): TituloRow {
  return {
    baixadoEm: null,
    clienteSlug: null,
    competenciaBaixa: null,
    conta: "5.1",
    contraparte: "Contraparte",
    descricao: "Título",
    emissao: "2026-09-01",
    id: "t0",
    motivoCancelamento: null,
    status: "ABERTO",
    tipo: "PAGAR",
    valorCentavos: 0,
    vencimento: "2026-09-20",
    ...over,
  };
}

// A vencer: vencimento em 2026-10-01, hoje é 2026-09-15.
const T1 = tituloFactory({
  contraparte: "AWS",
  descricao: "Hospedagem AWS",
  id: "t1",
  tipo: "PAGAR",
  valorCentavos: 300_000,
  vencimento: "2026-10-01",
});
// Vencido há 14 dias (faixa 1-30).
const T2 = tituloFactory({
  contraparte: "Imobiliária X",
  descricao: "Aluguel escritório",
  id: "t2",
  tipo: "PAGAR",
  valorCentavos: 450_000,
  vencimento: "2026-09-01",
});
const T3 = tituloFactory({
  baixadoEm: "2026-09-10",
  competenciaBaixa: "2026-09",
  contraparte: "Cliente A",
  descricao: "Mensalidade Cliente A",
  id: "t3",
  status: "BAIXADO",
  tipo: "RECEBER",
  valorCentavos: 200_000,
});
const T4 = tituloFactory({
  contraparte: "Cliente B",
  descricao: "Mensalidade Cliente B",
  id: "t4",
  motivoCancelamento: "Cliente cancelou o contrato antes do vencimento.",
  status: "CANCELADO",
  tipo: "RECEBER",
  valorCentavos: 150_000,
});

const TITULOS = [T1, T2, T3, T4];
const PAYLOAD = { contas: CONTAS, titulos: TITULOS };

function montar(podeEscrever = true) {
  render(<Titulos inicial={PAYLOAD} podeEscrever={podeEscrever} />);
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
  vi.clearAllMocks();
  listarTitulosMock.mockResolvedValue({ data: PAYLOAD, ok: true });
  criarTituloMock.mockResolvedValue({ data: { id: "novo" }, ok: true });
  baixarTituloMock.mockResolvedValue({ data: { id: "t1" }, ok: true });
  cancelarTituloMock.mockResolvedValue({ data: { id: "t1" }, ok: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Titulos", () => {
  it("mostra as duas listas (a pagar/a receber) e o envelhecimento com os totais por faixa", () => {
    montar();

    expect(screen.getByText("A pagar")).toBeTruthy();
    expect(screen.getByText("A receber")).toBeTruthy();
    expect(screen.getByText("Hospedagem AWS")).toBeTruthy();
    expect(screen.getByText("Aluguel escritório")).toBeTruthy();
    expect(screen.getByText("Mensalidade Cliente A")).toBeTruthy();
    expect(screen.getByText("Mensalidade Cliente B")).toBeTruthy();

    expect(screen.getByText("A vencer")).toBeTruthy();
    expect(screen.getByText("1 a 30 dias")).toBeTruthy();
    // Cada faixa tem um só título aberto na fixture, então o total da faixa
    // bate com o valor daquele título — aparece duas vezes (cartão + linha).
    expect(screen.getAllByText(dinheiro(300_000)).length).toBe(2);
    expect(screen.getAllByText(dinheiro(450_000)).length).toBe(2);
  });

  it("chips de situação filtram as duas listas; vencido aparece com o badge vermelho", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Vencidos" }));

    expect(screen.getByText("Aluguel escritório")).toBeTruthy();
    expect(screen.queryByText("Hospedagem AWS")).toBeNull();
    expect(screen.queryByText("Mensalidade Cliente A")).toBeNull();
    expect(screen.queryByText("Mensalidade Cliente B")).toBeNull();

    const badge = screen.getByText("Vencido");
    expect(badge.style.color).toBe("var(--red-text)");
  });

  it("'Novo título': Salvar libera só com tudo preenchido, bloqueia vencimento antes da emissão e cria com centavos", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Novo título" }));
    const salvar = screen.getByRole("button", { name: "Salvar" });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "PAGAR" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Nova despesa" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Contraparte"), {
      target: { value: "Fornecedor Y" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Conta"), {
      target: { value: "5.1" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "1.234,56" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("Vencimento"), {
      target: { value: "2026-09-10" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText("Vencimento não pode ser antes da emissão.")
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Vencimento"), {
      target: { value: "2026-09-20" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(false);

    fireEvent.click(salvar);

    expect(criarTituloMock).toHaveBeenCalledWith({
      conta: "5.1",
      contraparte: "Fornecedor Y",
      descricao: "Nova despesa",
      emissao: "2026-09-15",
      tipo: "PAGAR",
      valorCentavos: 123_456,
      vencimento: "2026-09-20",
    });
  });

  it("'Baixar' abre com data = hoje e competência = mês corrente, avisa a divergência e confirma com data/competência", () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: "Baixar — Hospedagem AWS" })
    );

    expect(screen.getByLabelText("Data")).toHaveProperty("value", "2026-09-15");
    expect(screen.getByLabelText("Competência")).toHaveProperty(
      "value",
      "2026-09"
    );
    expect(
      screen.queryByText("Data e competência em meses diferentes")
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-10-05" },
    });
    expect(
      screen.getByText("Data e competência em meses diferentes")
    ).toBeTruthy();

    const confirmar = screen.getByRole("button", { name: "Confirmar baixa" });
    expect(confirmar.hasAttribute("disabled")).toBe(false);
    // Baixar passou pela barreira (onda 5): o gatilho abre a pergunta com
    // valor e data; o Confirmar é quem grava.
    fireEvent.click(confirmar);
    expect(baixarTituloMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(baixarTituloMock).toHaveBeenCalledWith({
      competencia: "2026-09",
      data: "2026-10-05",
      id: "t1",
    });
  });

  it("'Cancelar' exige motivo com 10+ caracteres e confirma em duas etapas", () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: "Cancelar — Hospedagem AWS" })
    );

    const motivo = screen.getByLabelText("Motivo do cancelamento");
    const gatilho = screen.getByRole("button", { name: "Cancelar título" });

    fireEvent.change(motivo, { target: { value: "curto" } });
    expect(gatilho.hasAttribute("disabled")).toBe(true);

    fireEvent.change(motivo, {
      target: { value: "Duplicidade de cobrança identificada." },
    });
    expect(gatilho.hasAttribute("disabled")).toBe(false);

    fireEvent.click(gatilho);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(cancelarTituloMock).toHaveBeenCalledWith({
      id: "t1",
      motivo: "Duplicidade de cobrança identificada.",
    });
  });

  it("título BAIXADO ou CANCELADO não mostra Baixar nem Cancelar", () => {
    montar();

    expect(
      screen.queryByRole("button", {
        name: "Baixar — Mensalidade Cliente A",
      })
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Cancelar — Mensalidade Cliente A",
      })
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Baixar — Mensalidade Cliente B",
      })
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Cancelar — Mensalidade Cliente B",
      })
    ).toBeNull();
  });

  it("podeEscrever={false} esconde Novo título, Baixar e Cancelar", () => {
    montar(false);

    const botaoNovo = screen.getByRole("button", { name: "Novo título" });
    expect(botaoNovo.getAttribute("aria-disabled")).toBe("true");

    expect(
      screen.queryByRole("button", { name: "Baixar — Hospedagem AWS" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Cancelar — Hospedagem AWS" })
    ).toBeNull();
  });
});

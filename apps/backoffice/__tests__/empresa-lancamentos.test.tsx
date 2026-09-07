/** @vitest-environment jsdom */
// empresa-lancamentos.test.tsx — Task 5, spec 2026-09-06 §4. Prova a aba
// Lançamentos (`lancamentos.tsx` + `lancamento-dialog.tsx`): a tabela mostra
// as linhas e o total do período, o chip de centro e a busca filtram no
// cliente, o diálogo cria e edita, excluir pede confirmação em duas etapas e
// recusa linha vinda de título, e `podeEscrever={false}` tira as escritas.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Lancamentos } from "@/app/(staff)/empresa/financeiro/lancamentos";
import type { ContaView } from "@/app/actions/empresa/financeiro";
import { formatarBRL } from "@/lib/comercial/formato";
import type { LinhaDoLivro } from "@/lib/empresa/livro";
import type { Intervalo } from "@/lib/empresa/periodo";

const {
  listarLancamentosMock,
  criarLancamentoMock,
  atualizarLancamentoMock,
  excluirLancamentoMock,
} = vi.hoisted(() => ({
  atualizarLancamentoMock: vi.fn(),
  criarLancamentoMock: vi.fn(),
  excluirLancamentoMock: vi.fn(),
  listarLancamentosMock: vi.fn(),
}));

vi.mock("@/app/actions/empresa/livro", () => ({
  atualizarLancamento: atualizarLancamentoMock,
  criarLancamento: criarLancamentoMock,
  excluirLancamento: excluirLancamentoMock,
  listarLancamentos: listarLancamentosMock,
}));

const INTERVALO: Intervalo = { ate: "2026-09-30", de: "2026-09-01" };

// `formatarBRL` usa `toLocaleString`, que separa "R$" do valor com um espaço
// duro (NBSP) — o normalizador padrão do testing-library só normaliza o texto
// do DOM, não o texto do matcher (dom-testing-library/matches.js), então um
// NBSP de um lado e um espaço comum do outro nunca batem. `dinheiro` devolve
// o mesmo texto que a tela renderiza, já com o NBSP trocado por espaço comum.
const ESPACO_DURO = / /g;
function dinheiro(centavos: number): string {
  return formatarBRL(centavos).replace(ESPACO_DURO, " ");
}

const CONTAS: ContaView[] = [
  {
    ativa: true,
    centroDeCusto: "comercial",
    conta: "4.1",
    grupo: 4,
    nome: "Publicidade paga",
    ordem: 0,
  },
  {
    ativa: true,
    centroDeCusto: "produto-engenharia",
    conta: "5.1",
    grupo: 5,
    nome: "Salários engenharia",
    ordem: 0,
  },
];

function linhaFactory(over: Partial<LinhaDoLivro>): LinhaDoLivro {
  return {
    competencia: "2026-09",
    conta: "4.1",
    contraparte: null,
    data: "2026-09-01",
    descricao: "Lançamento",
    documento: null,
    id: "l0",
    nota: null,
    tituloId: null,
    valorCentavos: 0,
    ...over,
  };
}

const L1 = linhaFactory({
  conta: "4.1",
  contraparte: "Google",
  data: "2026-09-03",
  descricao: "Anúncios Google Ads",
  id: "l1",
  valorCentavos: 150_000,
});
const L2 = linhaFactory({
  conta: "4.1",
  contraparte: "Evento SaaS Brasil",
  data: "2026-09-05",
  descricao: "Patrocínio de evento",
  id: "l2",
  valorCentavos: 80_000,
});
const L3 = linhaFactory({
  conta: "5.1",
  contraparte: null,
  data: "2026-09-10",
  descricao: "Salário squad engenharia",
  id: "l3",
  valorCentavos: 500_000,
});
const L4 = linhaFactory({
  conta: "5.1",
  contraparte: "Acme Tools",
  data: "2026-09-12",
  descricao: "Licença de ferramenta",
  id: "l4",
  tituloId: "titulo-1",
  valorCentavos: 20_000,
});

const L5 = linhaFactory({
  conta: "4.1",
  contraparte: null,
  data: "2026-07-01",
  descricao: "Saldo de abertura (migrado)",
  id: "l5",
  valorCentavos: -50_000,
});

const LINHAS = [L1, L2, L3, L4];
const PAYLOAD = { contas: CONTAS, linhas: LINHAS };

function montar(podeEscrever = true, contaFiltro: string | null = null) {
  render(
    <Lancamentos
      contaFiltro={contaFiltro}
      inicial={PAYLOAD}
      intervalo={INTERVALO}
      podeEscrever={podeEscrever}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listarLancamentosMock.mockResolvedValue({ data: PAYLOAD, ok: true });
  criarLancamentoMock.mockResolvedValue({ data: { id: "novo" }, ok: true });
  atualizarLancamentoMock.mockResolvedValue({ data: { id: "l1" }, ok: true });
  excluirLancamentoMock.mockResolvedValue({ data: { id: "l1" }, ok: true });
});

describe("Lancamentos", () => {
  it("renderiza as linhas com data, conta, descrição, contraparte e valor, e o total do período", () => {
    montar();

    expect(screen.getByText("03/09/2026")).toBeTruthy();
    expect(screen.getByText("Anúncios Google Ads")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText(dinheiro(150_000))).toBeTruthy();

    const total = 150_000 + 80_000 + 500_000 + 20_000;
    expect(screen.getByText(dinheiro(total))).toBeTruthy();
  });

  it("chip de centro filtra pelas contas daquele centro", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));

    expect(screen.getByText("Anúncios Google Ads")).toBeTruthy();
    expect(screen.getByText("Patrocínio de evento")).toBeTruthy();
    expect(screen.queryByText("Salário squad engenharia")).toBeNull();
    expect(screen.queryByText("Licença de ferramenta")).toBeNull();
  });

  it("busca por texto filtra por descrição ou contraparte, sem acento e sem caixa", () => {
    montar();
    const busca = screen.getByLabelText("Buscar por descrição ou contraparte");

    fireEvent.change(busca, { target: { value: "anuncios" } });
    expect(screen.getByText("Anúncios Google Ads")).toBeTruthy();
    expect(screen.queryByText("Patrocínio de evento")).toBeNull();

    fireEvent.change(busca, { target: { value: "ACME" } });
    expect(screen.getByText("Licença de ferramenta")).toBeTruthy();
    expect(screen.queryByText("Anúncios Google Ads")).toBeNull();
  });

  it("'Novo lançamento' abre o diálogo; Salvar libera só com tudo preenchido e cria com centavos", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Novo lançamento" }));

    const salvar = screen.getByRole("button", { name: "Salvar" });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Competência"), {
      target: { value: "2026-09" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-09-15" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Conta"), {
      target: { value: "4.1" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Nova despesa" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "1.234,56" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(false);

    fireEvent.click(salvar);

    expect(criarLancamentoMock).toHaveBeenCalledWith({
      competencia: "2026-09",
      conta: "4.1",
      contraparte: null,
      data: "2026-09-15",
      descricao: "Nova despesa",
      documento: null,
      nota: null,
      valorCentavos: 123_456,
    });
  });

  it("editar uma linha abre o diálogo preenchido e o salvar chama atualizarLancamento com o id", () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar lançamento — Anúncios Google Ads",
      })
    );

    expect(screen.getByLabelText("Competência")).toHaveProperty(
      "value",
      "2026-09"
    );
    expect(screen.getByLabelText("Data")).toHaveProperty("value", "2026-09-03");
    expect(screen.getByLabelText("Conta")).toHaveProperty("value", "4.1");
    expect(screen.getByLabelText("Descrição")).toHaveProperty(
      "value",
      "Anúncios Google Ads"
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(atualizarLancamentoMock).toHaveBeenCalledWith({
      competencia: "2026-09",
      conta: "4.1",
      contraparte: "Google",
      data: "2026-09-03",
      descricao: "Anúncios Google Ads",
      documento: null,
      id: "l1",
      nota: null,
      valorCentavos: 150_000,
    });
  });

  it("linha migrada com valor <= 0 bloqueia o salvamento com aviso", () => {
    render(
      <Lancamentos
        contaFiltro={null}
        inicial={{ contas: CONTAS, linhas: [L5] }}
        intervalo={INTERVALO}
        podeEscrever
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar lançamento — Saldo de abertura (migrado)",
      })
    );

    const salvar = screen.getByRole("button", { name: "Salvar" });
    expect(salvar.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/veio do livro-razão antigo/)).toBeTruthy();

    fireEvent.click(salvar);
    expect(atualizarLancamentoMock).not.toHaveBeenCalled();
  });

  it("excluir confirma em duas etapas e chama excluirLancamento({id}); linha via título não mostra editar nem excluir", () => {
    montar();

    expect(
      screen.queryByRole("button", {
        name: "Editar lançamento — Licença de ferramenta",
      })
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Excluir lançamento — Licença de ferramenta",
      })
    ).toBeNull();
    expect(screen.getByText("via título")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Excluir lançamento — Anúncios Google Ads",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(excluirLancamentoMock).toHaveBeenCalledWith({ id: "l1" });
  });

  it("podeEscrever={false} esconde Novo lançamento, editar e excluir", () => {
    montar(false);

    const botaoNovo = screen.getByRole("button", { name: "Novo lançamento" });
    expect(botaoNovo.hasAttribute("disabled")).toBe(true);

    expect(
      screen.queryByRole("button", {
        name: "Editar lançamento — Anúncios Google Ads",
      })
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Excluir lançamento — Anúncios Google Ads",
      })
    ).toBeNull();
  });
});

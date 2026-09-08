/** @vitest-environment jsdom */
// empresa-orcado.test.tsx — Task 4, spec 2026-09-06 §4. Prova a aba
// "Orçado × realizado" (`orcado.tsx`): uma linha por conta com orçado editável
// (onBlur, em centavos), realizado só leitura e o desvio entre os dois — cuja
// cor de "ruim" inverte entre conta de custo/despesa/dedução e conta de
// receita —, o rodapé somado por centro de custo, e `podeEscrever={false}`
// travando o campo de orçado.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Orcado } from "@/app/(staff)/empresa/financeiro/orcado";
import type { OrcadoView } from "@/app/actions/empresa/orcamento";
import { formatarBRL } from "@/lib/comercial/formato";
import type { Intervalo } from "@/lib/empresa/periodo";

const { lerOrcadoMock, salvarOrcamentoMock } = vi.hoisted(() => ({
  lerOrcadoMock: vi.fn(),
  salvarOrcamentoMock: vi.fn(),
}));

vi.mock("@/app/actions/empresa/orcamento", () => ({
  lerOrcado: lerOrcadoMock,
  salvarOrcamento: salvarOrcamentoMock,
}));

const INTERVALO: Intervalo = { ate: "2026-09-30", de: "2026-09-01" };
const COMPETENCIA = "2026-09";

const ESPACO_DURO = / /g;
function dinheiro(centavos: number): string {
  return formatarBRL(centavos).replace(ESPACO_DURO, " ");
}

// Comercial tem duas contas — a única forma de o total do rodapé ser um
// número diferente de qualquer célula de linha, provando que ele soma em vez
// de repetir um valor que já apareceria de qualquer jeito.
const PAYLOAD: OrcadoView = {
  competencias: [COMPETENCIA],
  contas: [
    {
      centroDeCusto: "comercial",
      conta: "4.1",
      grupo: 4,
      nome: "Publicidade paga",
      porCompetencia: {
        [COMPETENCIA]: {
          desvio: 50_000,
          desvioPercent: 50,
          orcado: 100_000,
          realizado: 150_000,
        },
      },
    },
    {
      centroDeCusto: "comercial",
      conta: "4.2",
      grupo: 4,
      nome: "Eventos e patrocínio",
      porCompetencia: {
        [COMPETENCIA]: {
          desvio: 20_000,
          desvioPercent: 40,
          orcado: 50_000,
          realizado: 70_000,
        },
      },
    },
    {
      centroDeCusto: "produto-engenharia",
      conta: "5.1",
      grupo: 5,
      nome: "Salários engenharia",
      porCompetencia: {
        [COMPETENCIA]: {
          desvio: -20_000,
          desvioPercent: -10,
          orcado: 200_000,
          realizado: 180_000,
        },
      },
    },
    {
      centroDeCusto: null,
      conta: "1.1",
      grupo: 1,
      nome: "Receita SaaS",
      porCompetencia: {
        [COMPETENCIA]: {
          desvio: -50_000,
          desvioPercent: -17,
          orcado: 300_000,
          realizado: 250_000,
        },
      },
    },
    {
      centroDeCusto: "entrega",
      conta: "3.1",
      grupo: 3,
      nome: "Consultoria terceirizada",
      porCompetencia: {
        [COMPETENCIA]: {
          desvio: null,
          desvioPercent: null,
          orcado: null,
          realizado: 40_000,
        },
      },
    },
  ],
};

function linhaDaConta(nome: string): HTMLElement {
  const cel = screen.getByText(nome);
  const linha = cel.closest("tr");
  if (!linha) {
    throw new Error(`Linha não encontrada para ${nome}`);
  }
  return linha as HTMLElement;
}

function montar(podeEscrever = true) {
  render(
    <Orcado
      inicial={PAYLOAD}
      intervalo={INTERVALO}
      podeEscrever={podeEscrever}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  lerOrcadoMock.mockResolvedValue({ data: PAYLOAD, ok: true });
  salvarOrcamentoMock.mockResolvedValue({
    data: { competencia: COMPETENCIA, conta: "4.1" },
    ok: true,
  });
});

describe("Orcado", () => {
  it("uma linha por conta, com orçado, realizado e desvio por competência", () => {
    montar();

    const linha = linhaDaConta("Publicidade paga");
    const campo = within(linha).getByLabelText("Orçado 4.1 set 2026");
    expect(campo).toHaveProperty("value", "1000,00");
    expect(within(linha).getByText(dinheiro(150_000))).toBeTruthy();
    expect(within(linha).getByText(dinheiro(50_000))).toBeTruthy();
  });

  it("desvio que estoura o orçado é vermelho numa conta de custo; dentro do orçado, não — e a direção inverte na receita", () => {
    montar();

    // 4.1: custo, realizado > orçado — ruim, vermelho.
    const linhaCusto = linhaDaConta("Publicidade paga");
    const desvioCusto = within(linhaCusto)
      .getByText(dinheiro(50_000))
      .closest("td");
    expect(desvioCusto?.style.color).toBe("var(--red-text)");

    // 5.1: custo, realizado < orçado — bom, sem vermelho.
    const linhaCustoOk = linhaDaConta("Salários engenharia");
    const desvioCustoOk = within(linhaCustoOk)
      .getByText(dinheiro(-20_000))
      .closest("td");
    expect(desvioCustoOk?.style.color).toBe("var(--ink)");

    // 1.1: receita, realizado < orçado — ruim, vermelho (direção oposta).
    const linhaReceita = linhaDaConta("Receita SaaS");
    const desvioReceita = within(linhaReceita)
      .getByText(dinheiro(-50_000))
      .closest("td");
    expect(desvioReceita?.style.color).toBe("var(--red-text)");
  });

  it("conta sem orçamento mostra o campo vazio e o realizado somado", () => {
    montar();

    const linha = linhaDaConta("Consultoria terceirizada");
    const campo = within(linha).getByLabelText("Orçado 3.1 set 2026");
    expect(campo).toHaveProperty("value", "");
    expect(within(linha).getByText(dinheiro(40_000))).toBeTruthy();
    expect(within(linha).getByText("—")).toBeTruthy();
  });

  it("editar o orçado chama salvarOrcamento com {competencia, conta, valorCentavos} em centavos", async () => {
    montar();

    const linha = linhaDaConta("Consultoria terceirizada");
    const campo = within(linha).getByLabelText("Orçado 3.1 set 2026");
    fireEvent.change(campo, { target: { value: "400,50" } });
    fireEvent.blur(campo);

    await waitFor(() =>
      expect(salvarOrcamentoMock).toHaveBeenCalledWith({
        competencia: COMPETENCIA,
        conta: "3.1",
        valorCentavos: 40_050,
      })
    );
  });

  it("esvaziar o campo chama salvarOrcamento com valorCentavos: null", async () => {
    montar();

    const linha = linhaDaConta("Publicidade paga");
    const campo = within(linha).getByLabelText("Orçado 4.1 set 2026");
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);

    await waitFor(() =>
      expect(salvarOrcamentoMock).toHaveBeenCalledWith({
        competencia: COMPETENCIA,
        conta: "4.1",
        valorCentavos: null,
      })
    );
  });

  it("o rodapé soma por centro de custo", () => {
    montar();

    const totalComercial = screen.getByText("Total Comercial").closest("tr");
    if (!totalComercial) {
      throw new Error("Linha de total não encontrada");
    }
    expect(within(totalComercial).getByText(dinheiro(220_000))).toBeTruthy();
    expect(within(totalComercial).getByText(dinheiro(70_000))).toBeTruthy();
  });

  it("podeEscrever={false} deixa os campos só de leitura", () => {
    montar(false);

    const linha = linhaDaConta("Publicidade paga");
    const campo = within(linha).getByLabelText("Orçado 4.1 set 2026");
    expect(campo).toHaveProperty("readOnly", true);

    fireEvent.change(campo, { target: { value: "1,00" } });
    fireEvent.blur(campo);

    expect(salvarOrcamentoMock).not.toHaveBeenCalled();
  });
});

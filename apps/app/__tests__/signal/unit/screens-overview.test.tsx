import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Visão geral — US3.
//
// O que estes testes protegem é a leitura, não o layout: que o múltiplo bom
// nunca apareça sem o valor em risco ao lado, que a fila mostre o que precisa
// de DECISÃO (não tudo), e que as réguas venham do servidor em vez de uma
// constante local que divergiria dos vereditos já calculados.

const h = vi.hoisted(() => ({
  getPortfolioSummary: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/app/(signal)/actions/initiatives", () => ({
  getPortfolioSummary: h.getPortfolioSummary,
}));
vi.mock("@/components/signal/base", async () => {
  const primitives = await vi.importActual<
    typeof import("@/components/charter/base")
  >("../../../components/charter/base");
  const data = await vi.importActual<
    typeof import("@/components/charter/use-charter-data")
  >("../../../components/charter/use-charter-data");
  return { ...primitives, useSignalData: data.useCharterData };
});

import OverviewScreen from "@/components/signal/screens/overview";

const item = (over: Record<string, unknown> = {}) => ({
  code: "IN-021",
  name: "Copiloto N1",
  businessUnit: "Atendimento",
  category: "PRODUCTIVITY",
  invested: 240_000,
  returned: 216_000,
  multiple: 0.9,
  adoptionPct: 84,
  verdict: "VANITY",
  ...over,
});

const summary = (over: Record<string, unknown> = {}) => ({
  invested: 422_000,
  returned: 980_000,
  multiple: 2.32,
  atRisk: 240_000,
  byVerdict: { PROVEN: 1, VANITY: 1, PROMISE: 0, STOP: 0 },
  items: [
    item(),
    item({
      code: "IN-014",
      name: "Triagem",
      verdict: "PROVEN",
      multiple: 4.2,
      invested: 182_000,
      adoptionPct: 78,
    }),
  ],
  byBusinessUnit: [
    {
      key: "Atendimento",
      invested: 240_000,
      returned: 216_000,
      multiple: 0.9,
      atRisk: 240_000,
      count: 1,
    },
    {
      key: "Operações",
      invested: 182_000,
      returned: 764_000,
      multiple: 4.2,
      atRisk: 0,
      count: 1,
    },
  ],
  byCategory: [
    {
      key: "PRODUCTIVITY",
      invested: 422_000,
      returned: 980_000,
      multiple: 2.32,
      atRisk: 240_000,
      count: 2,
    },
  ],
  bars: { adoptionBar: 60, valueBar: 1.5 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.getPortfolioSummary.mockResolvedValue({ ok: true, data: summary() });
});

describe("card de portfólio", () => {
  it("mostra o múltiplo agregado E o valor em risco juntos", async () => {
    render(<OverviewScreen />);
    await waitFor(() => {
      // O mesmo múltiplo aparece no card e na linha da categoria única — o
      // teste quer só saber que ele está lá.
      expect(screen.getAllByText("2,3×").length).toBeGreaterThan(0);
    });
    // Separar os dois deixaria a primeira leitura ser "2,3×, ótimo" — e o
    // número bom esconderia um terço do orçamento sem prova.
    expect(screen.getAllByText("R$ 240 mil").length).toBeGreaterThan(0);
    // A proporção é o que dá tamanho ao risco: "R$ 240 mil" sozinho não diz se
    // é muito ou pouco para este portfólio.
    expect(screen.getByText(/% do investido/)).toBeDefined();
  });

  it("diz quando NÃO há dinheiro em risco, em vez de omitir", async () => {
    h.getPortfolioSummary.mockResolvedValue({
      ok: true,
      data: summary({
        atRisk: 0,
        byVerdict: { PROVEN: 2, VANITY: 0, PROMISE: 0, STOP: 0 },
      }),
    });
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(
        screen.getByText(/Nenhuma iniciativa sem prova de valor/)
      ).toBeDefined();
    });
  });

  it("conta as iniciativas por quadrante", async () => {
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(screen.getByText("1 Uso sem valor")).toBeDefined();
    });
    expect(screen.getByText("1 Provado")).toBeDefined();
    // Quadrante vazio continua visível: zero é informação.
    expect(screen.getByText("0 Promessa parada")).toBeDefined();
  });
});

describe("fila de decisão", () => {
  it("lista só o que precisa de decisão, não tudo", async () => {
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(screen.getByText(/IN-021 · Copiloto N1/)).toBeDefined();
    });
    // A provada não entra na fila — a tela de iniciativas já lista tudo.
    expect(screen.queryByText(/IN-014 · Triagem/)).toBeNull();
  });

  it("traz a ação sugerida junto, não só o diagnóstico", async () => {
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Investigar método/)).toBeDefined();
    });
  });

  it("celebra a fila vazia em vez de mostrar um vazio mudo", async () => {
    h.getPortfolioSummary.mockResolvedValue({
      ok: true,
      data: summary({
        items: [item({ code: "IN-014", verdict: "PROVEN" })],
        byVerdict: { PROVEN: 1, VANITY: 0, PROMISE: 0, STOP: 0 },
      }),
    });
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(
        screen.getByText(/Toda iniciativa ativa está provada/)
      ).toBeDefined();
    });
  });
});

describe("réguas", () => {
  it("usa as do SERVIDOR, não uma constante local", async () => {
    h.getPortfolioSummary.mockResolvedValue({
      ok: true,
      data: summary({ bars: { adoptionBar: 70, valueBar: 2 } }),
    });
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(screen.getByText(/adoção 70%/)).toBeDefined();
    });
    // Uma cópia local divergiria da régua que produziu os vereditos.
    expect(screen.getByText(/retorno 2,0×/)).toBeDefined();
  });
});

describe("agrupamentos", () => {
  it("mostra área e categoria, com o em-risco por grupo", async () => {
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(screen.getByText("Atendimento")).toBeDefined();
    });
    expect(screen.getByText("Operações")).toBeDefined();
    // Categoria aparece traduzida, não como enum cru.
    expect(screen.getByText("Produtividade")).toBeDefined();
    expect(screen.getAllByText(/em risco/).length).toBeGreaterThan(0);
  });
});

describe("erro", () => {
  it("mostra o erro da action", async () => {
    h.getPortfolioSummary.mockResolvedValue({
      ok: false,
      error: "Sem papel de medição atribuído no Signal.",
    });
    render(<OverviewScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Sem papel de medição/)).toBeDefined();
    });
  });
});

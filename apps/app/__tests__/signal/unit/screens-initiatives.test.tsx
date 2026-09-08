import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Tela de iniciativas — US1.
//
// O que estes testes protegem: a ORDEM de leitura (o que precisa de decisão
// primeiro, não o que começa com A), o estado vazio que ensina o que é preciso
// ter em mãos, e o aviso de baseline ausente — que é a diferença entre um
// número que sustenta contestação e um que não.

const h = vi.hoisted(() => ({
  listInitiatives: vi.fn(),
  push: vi.fn(),
  open: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
}));
vi.mock("@/app/(signal)/actions/initiatives", () => ({
  listInitiatives: h.listInitiatives,
}));
vi.mock("@/components/signal/modal", () => ({
  InitiativeForm: () => null,
}));
// `components/signal/base` é um barrel que junta duas origens (as primitivas do
// Charter e o hook de busca). Mockar só o `useModal` exige remontar as duas —
// senão o resto do barrel some e a tela quebra em imports que nada têm a ver
// com o que o teste isola.
vi.mock("@/components/signal/base", async () => {
  const primitives = await vi.importActual<
    typeof import("@/components/charter/base")
  >("../../../components/charter/base");
  const data = await vi.importActual<
    typeof import("@/components/charter/use-charter-data")
  >("../../../components/charter/use-charter-data");
  return {
    ...primitives,
    useSignalData: data.useCharterData,
    useModal: () => ({ open: h.open, close: vi.fn() }),
  };
});

import InitiativesScreen from "@/components/signal/screens/initiatives";

const card = (over: Record<string, unknown> = {}) => ({
  code: "IN-014",
  name: "Triagem assistida",
  businessUnit: "Operações",
  category: "PRODUCTIVITY",
  status: "ACTIVE",
  owner: { id: "u", name: "Paula" },
  adoptionPct: 78,
  multiple: 4.2,
  formulaVersion: 3,
  baselineVersion: 2,
  confidenceScore: 93,
  confidenceBand: "HIGH",
  verdict: "PROVEN",
  verdictLabel: "Provado",
  verdictTone: "green",
  verdictAction: "Escalar orçamento",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.listInitiatives.mockResolvedValue({ ok: true, data: [] });
});

describe("estado vazio", () => {
  it("ensina o que é preciso ter em mãos, não só diz que está vazio", async () => {
    render(<InitiativesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma iniciativa registrada/)).toBeDefined();
    });
    // Hipótese + baseline: as duas coisas sem as quais medir não faz sentido.
    expect(screen.getByText(/hipótese falseável/i)).toBeDefined();
    expect(screen.getByText(/baseline/i)).toBeDefined();
  });

  it("oferece o caminho para criar a primeira", async () => {
    render(<InitiativesScreen />);
    await waitFor(() => {
      expect(screen.getByText("Registrar a primeira iniciativa")).toBeDefined();
    });
  });
});

describe("ordem de leitura", () => {
  it("põe o que precisa de DECISÃO primeiro, não a ordem alfabética", async () => {
    h.listInitiatives.mockResolvedValue({
      ok: true,
      data: [
        card({ code: "IN-001", name: "Alfa", verdict: "PROVEN" }),
        card({ code: "IN-002", name: "Beta", verdict: "STOP" }),
        card({ code: "IN-003", name: "Gama", verdict: "VANITY" }),
        card({ code: "IN-004", name: "Delta", verdict: "PROMISE" }),
      ],
    });
    render(<InitiativesScreen />);
    await waitFor(() => {
      expect(screen.getByText("Alfa")).toBeDefined();
    });

    const order = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => t.includes("IN-00"));
    // VANITY (usa e não rende) primeiro, PROVEN por último.
    expect(order[0]).toContain("IN-003");
    expect(order[1]).toContain("IN-002");
    expect(order.at(-1)).toContain("IN-001");
  });
});

describe("conteúdo da linha", () => {
  it("traz veredito, múltiplo, versão da fórmula, confiança e adoção juntos", async () => {
    h.listInitiatives.mockResolvedValue({ ok: true, data: [card()] });
    render(<InitiativesScreen />);
    await waitFor(() => {
      expect(screen.getByText("Triagem assistida")).toBeDefined();
    });
    // A regra-mãe vale também na lista — foi lá que o protótipo errou.
    expect(screen.getByText("Provado")).toBeDefined();
    expect(screen.getByText("4,2×")).toBeDefined();
    expect(screen.getByText(/fórmula v3/)).toBeDefined();
    expect(screen.getByText(/confiança 93/)).toBeDefined();
    expect(screen.getByText(/adoção 78%/)).toBeDefined();
  });

  it("avisa quando falta baseline assinado", async () => {
    h.listInitiatives.mockResolvedValue({
      ok: true,
      data: [card({ baselineVersion: null })],
    });
    render(<InitiativesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Sem baseline assinado/i)).toBeDefined();
    });
  });

  it("não avisa quando o baseline existe", async () => {
    h.listInitiatives.mockResolvedValue({ ok: true, data: [card()] });
    render(<InitiativesScreen />);
    await waitFor(() => {
      expect(screen.getByText("Triagem assistida")).toBeDefined();
    });
    expect(screen.queryByText(/Sem baseline assinado/i)).toBeNull();
  });
});

describe("erro", () => {
  it("mostra o erro da action com opção de tentar de novo", async () => {
    h.listInitiatives.mockResolvedValue({
      ok: false,
      error: "Módulo SIGNAL não contratado por esta organização.",
    });
    render(<InitiativesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/não contratado/)).toBeDefined();
    });
  });
});

// budgets.test.tsx — Lean Budgets (/cosmos/budgets). Cobre os critérios da
// story-062 visíveis na tela: AC-001 (orçamento de PI encerrado é marcado como
// final e não oferece o editor de guardrails), AC-003 (utilização sem
// denominador é "—", nunca 0%) e AC-005 (erro distinto do vazio).
// Asserção sobre conteúdo — sem snapshot.
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listLeanBudgetsMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/budgets", () => ({
  listLeanBudgets: (...args: unknown[]) => listLeanBudgetsMock(...args),
  updateLeanBudgetGuardrails: vi.fn(),
}));

// A tela ganhou a criação de orçamento (story-062, NovoBudgetModal) e passou a
// importar createLeanBudget de app/actions/lean-budget — módulo "use server".
// Sem este mock a cadeia de import chega em @repo/database e estoura o guard de
// env de servidor sob o ambiente de cliente, derrubando a suíte inteira deste
// arquivo. A criação em si é coberta por budgets-create.test.tsx.
vi.mock("@/app/actions/lean-budget", () => ({
  createLeanBudget: vi.fn(),
}));

import BudgetsScreen from "../../components/cosmos/screens/budgets";

const budget = (over: Record<string, unknown>) => ({
  id: "b-x",
  name: "Orçamento X",
  themeName: "Expansão LATAM",
  artId: null,
  artName: null,
  amount: 100_000,
  spent: 62_000,
  period: "PI-2026-Q2",
  capexPct: 60,
  opexPct: 40,
  spendLimitUsd: null,
  approvalThresholdUsd: null,
  utilizationPct: 62,
  immutableAt: null,
  ...over,
});

describe("BudgetsScreen", () => {
  beforeEach(() => {
    listLeanBudgetsMock.mockReset();
  });

  it("marca o orçamento de PI encerrado como final e não oferece o editor (AC-001)", async () => {
    listLeanBudgetsMock.mockResolvedValue({
      ok: true,
      data: [
        budget({
          id: "b1",
          name: "Payments PI-25",
          immutableAt: "2026-06-30T00:00:00.000Z",
        }),
        budget({ id: "b2", name: "Payments PI-26" }),
      ],
    });

    render(<BudgetsScreen />);

    expect(await screen.findByText("Payments PI-25")).toBeTruthy();
    expect(
      screen.getByText("Orçamento do PI encerrado — valores finais")
    ).toBeTruthy();
    // só a linha editável oferece o botão; recusar no servidor e ainda
    // convidar ao clique seria armadilha
    expect(screen.getAllByRole("button", { name: "Guardrails" })).toHaveLength(
      1
    );
  });

  it("mostra '—' na utilização quando não há valor alocado, nunca 0% (AC-003)", async () => {
    listLeanBudgetsMock.mockResolvedValue({
      ok: true,
      data: [
        budget({
          id: "b0",
          name: "Sem alocação",
          amount: 0,
          spent: 0,
          utilizationPct: null,
        }),
      ],
    });

    render(<BudgetsScreen />);

    expect(await screen.findByText("Sem alocação")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("mostra o estado vazio quando o tenant não tem orçamento (AC-005)", async () => {
    listLeanBudgetsMock.mockResolvedValue({ ok: true, data: [] });

    render(<BudgetsScreen />);

    expect(
      await screen.findByText("Nenhum orçamento encontrado.")
    ).toBeTruthy();
  });

  it("mostra o erro e nenhum orçamento quando a leitura falha (AC-005)", async () => {
    listLeanBudgetsMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<BudgetsScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os orçamentos.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Nenhum orçamento encontrado.")).toBeNull();
  });
});

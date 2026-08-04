// budgets-create.test.tsx — story-062. Até aqui não havia caminho nenhum, em
// tela nenhuma do app, para criar um Lean Budget: (cosmos)/actions/budgets só
// lista e ajusta guardrails, e createLeanBudget existia sem chamador. Um
// orçamento só nascia por seed ou SQL.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listLeanBudgetsMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/budgets", () => ({
  listLeanBudgets: (...args: unknown[]) => listLeanBudgetsMock(...args),
  updateLeanBudgetGuardrails: vi.fn(),
}));

const createLeanBudgetMock = vi.fn();
vi.mock("@/app/actions/lean-budget", () => ({
  createLeanBudget: (...args: unknown[]) => createLeanBudgetMock(...args),
}));

import BudgetsScreen from "../../components/cosmos/screens/budgets";

const budget = (over: Record<string, unknown> = {}) => ({
  id: "lb-1",
  name: "Budget Pagamentos",
  themeName: null,
  amount: 1_000_000,
  spent: 250_000,
  utilizationPct: 25,
  period: "PI-2026-Q1",
  capexPct: null,
  opexPct: null,
  spendLimitUsd: null,
  approvalThresholdUsd: null,
  ...over,
});

describe("BudgetsScreen — criação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLeanBudgetsMock.mockResolvedValue({ ok: true, data: [budget()] });
  });

  it("cria o orçamento pela tela e recarrega a lista", async () => {
    listLeanBudgetsMock
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [budget()] });
    createLeanBudgetMock.mockResolvedValue({ ok: true, data: { id: "lb-9" } });

    render(<BudgetsScreen />);
    await screen.findByText("Lean Budgets");

    fireEvent.click(screen.getByRole("button", { name: "Novo orçamento" }));
    fireEvent.change(screen.getByLabelText("Nome do orçamento"), {
      target: { value: "Budget Checkout" },
    });
    fireEvent.change(screen.getByLabelText("Valor alocado"), {
      target: { value: "500000" },
    });
    fireEvent.change(screen.getByLabelText("Período"), {
      target: { value: "PI-2026-Q2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar orçamento" }));

    await waitFor(() =>
      expect(createLeanBudgetMock).toHaveBeenCalledWith({
        name: "Budget Checkout",
        amount: 500_000,
        period: "PI-2026-Q2",
      })
    );
    await waitFor(() => expect(listLeanBudgetsMock).toHaveBeenCalledTimes(2));
  });

  it("não chama a ação sem nome ou sem valor", async () => {
    render(<BudgetsScreen />);
    await screen.findByText("Lean Budgets");

    fireEvent.click(screen.getByRole("button", { name: "Novo orçamento" }));
    // Só o período preenchido: nome e valor vazios.
    fireEvent.change(screen.getByLabelText("Período"), {
      target: { value: "PI-2026-Q2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar orçamento" }));

    await waitFor(() => expect(createLeanBudgetMock).not.toHaveBeenCalled());
  });

  it("mantém o formulário aberto quando a criação falha", async () => {
    createLeanBudgetMock.mockResolvedValue({ ok: false, error: "FORBIDDEN" });

    render(<BudgetsScreen />);
    await screen.findByText("Lean Budgets");

    fireEvent.click(screen.getByRole("button", { name: "Novo orçamento" }));
    fireEvent.change(screen.getByLabelText("Nome do orçamento"), {
      target: { value: "Budget Checkout" },
    });
    fireEvent.change(screen.getByLabelText("Valor alocado"), {
      target: { value: "500000" },
    });
    fireEvent.change(screen.getByLabelText("Período"), {
      target: { value: "PI-2026-Q2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar orçamento" }));

    await waitFor(() => expect(createLeanBudgetMock).toHaveBeenCalled());
    // O erro não pode custar o que o usuário digitou.
    expect(screen.getByLabelText("Nome do orçamento")).toBeTruthy();
    expect(listLeanBudgetsMock).toHaveBeenCalledTimes(1);
  });
});

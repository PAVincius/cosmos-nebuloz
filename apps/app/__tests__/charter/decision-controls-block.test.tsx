import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DecisionModal } from "@/components/charter/modals/decision";

// CH-DEV-06 na tela: com controle sem evidência, ajuste pedido ou vencido, o
// botão de aprovar fica desabilitado COM o motivo escrito e os controles
// listados. Pedir ajustes e bloquear seguem livres.

const base = {
  caseCode: "UC-118",
  caseTitle: "Triagem de autorizações prévias",
  approvalPath: "Segurança",
  dataClass: "INTERNAL" as const,
  score: null,
  riskLabel: "Não pontuado",
  riskTone: "accent",
  vendorName: null,
  deciderName: "Ana",
  deciderRole: "Compliance",
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  pending: false,
};

const BLOCKERS = ["TR-2 · Rollback testado: sem evidência"];

function choose(label: string) {
  fireEvent.click(screen.getByText(label));
}

function fillRationale() {
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Justificativa com mais de doze caracteres." },
  });
}

describe("DecisionModal com controles pendentes", () => {
  it("aprovar: botão desabilitado, motivo e controles na tela", () => {
    render(<DecisionModal {...base} controlBlockers={BLOCKERS} />);
    choose("Aprovar");
    fillRationale();
    const btn = screen.getByRole("button", {
      name: "Aprovar",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getAllByText(/controle\(s\) impedem/).length).toBeGreaterThan(
      0
    );
    expect(screen.getByText(/TR-2 · Rollback testado/)).toBeDefined();
  });

  it("aprovar com restrições também bloqueia", () => {
    render(<DecisionModal {...base} controlBlockers={BLOCKERS} />);
    choose("Aprovar com restrições");
    expect(screen.getAllByText(/controle\(s\) impedem/).length).toBeGreaterThan(
      0
    );
  });

  it("bloquear segue livre com controle pendente", () => {
    render(<DecisionModal {...base} controlBlockers={BLOCKERS} />);
    choose("Bloquear");
    fillRationale();
    const btn = screen.getByRole("button", {
      name: "Bloquear",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("sem controle pendente, aprovar habilita normalmente", () => {
    render(<DecisionModal {...base} />);
    choose("Aprovar");
    fillRationale();
    const btn = screen.getByRole("button", {
      name: "Aprovar",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

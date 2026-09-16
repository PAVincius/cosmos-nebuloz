/** @vitest-environment jsdom */
// compliance-import.test.tsx — ImportQuickAddForm isolado do resto da tela.
// Duas observações menores da onda de conformidade:
//   1. o formulário nasce abaixo de todo o mapa — sem rolar até ele e focar
//      o primeiro campo, abrir "Importar exigências" não muda nada visível;
//   2. colar do Excel/Sheets separa colunas por tab, não por "|" — uma
//      citação como "§ 4 | 5" quebrava a linha quando o parser cortava no
//      primeiro pipe.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const importRequirementSetMock = vi.fn();
const publishSetVersionMock = vi.fn();

vi.mock("@/app/(charter)/actions/compliance", () => ({
  importRequirementSet: (...args: unknown[]) =>
    importRequirementSetMock(...args),
  publishSetVersion: (...args: unknown[]) => publishSetVersionMock(...args),
}));

import { ImportQuickAddForm } from "../../components/charter/screens/compliance-import";

describe("ImportQuickAddForm", () => {
  beforeEach(() => {
    importRequirementSetMock.mockReset();
    importRequirementSetMock.mockResolvedValue({
      ok: true,
      data: { id: "set-novo", total: 1 },
    });
    publishSetVersionMock.mockReset();
  });

  it("ao abrir, rola até si mesmo e foca o primeiro campo", () => {
    const scrollIntoViewMock = vi.fn();
    // jsdom não implementa scrollIntoView — sem o stub, o próprio efeito sob
    // teste lançaria e mascararia a asserção.
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <ImportQuickAddForm onCancel={() => {}} onDone={() => {}} sets={[]} />
    );

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "start" });
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("ex: RFP Banco Aurora 2026")
    );
  });

  it('cola do Excel (tab) sem quebrar citação com "|" dentro', async () => {
    render(
      <ImportQuickAddForm onCancel={() => {}} onDone={() => {}} sets={[]} />
    );

    fireEvent.change(screen.getByPlaceholderText("ex: RFP Banco Aurora 2026"), {
      target: { value: "Conjunto X" },
    });
    fireEvent.change(screen.getByPlaceholderText(/4\.2\.1/), {
      target: { value: "REQ-1\tTítulo\t§ 4 | 5" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));

    await waitFor(() =>
      expect(importRequirementSetMock).toHaveBeenCalledWith({
        nome: "Conjunto X",
        origem: "RFP",
        requisitos: [{ codigo: "REQ-1", citacao: "§ 4 | 5", resumo: "Título" }],
      })
    );
  });

  it('sem tab, "|" ainda funciona como separador (fallback)', async () => {
    render(
      <ImportQuickAddForm onCancel={() => {}} onDone={() => {}} sets={[]} />
    );

    fireEvent.change(screen.getByPlaceholderText("ex: RFP Banco Aurora 2026"), {
      target: { value: "Conjunto Y" },
    });
    fireEvent.change(screen.getByPlaceholderText(/4\.2\.1/), {
      target: { value: "A-1 | §1 | Resumo simples" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));

    await waitFor(() =>
      expect(importRequirementSetMock).toHaveBeenCalledWith({
        nome: "Conjunto Y",
        origem: "RFP",
        requisitos: [
          { codigo: "A-1", citacao: "§1", resumo: "Resumo simples" },
        ],
      })
    );
  });
});

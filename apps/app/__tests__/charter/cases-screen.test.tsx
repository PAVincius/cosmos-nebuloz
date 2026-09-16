/** @vitest-environment jsdom */
// cases-screen.test.tsx — tela de Casos de Uso de IA: o botão "Exportar
// fila" só fazia `router.push("/charter/audit")` — o verbo mentia, e a
// Auditoria já está a um clique na navegação lateral do Charter (shell.tsx,
// item "audit" na seção "Evidência"). Por isso o botão foi removido em vez de
// renomeado ou ligado a uma exportação inventada. Asserção sobre conteúdo,
// sem snapshot.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listCasesMock = vi.fn();
const submitCaseMock = vi.fn();
vi.mock("@/app/(charter)/actions/cases", () => ({
  listCases: (...args: unknown[]) => listCasesMock(...args),
  submitCase: (...args: unknown[]) => submitCaseMock(...args),
}));

const getPolicyMock = vi.fn();
vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicy: (...args: unknown[]) => getPolicyMock(...args),
}));

const listVendorsMock = vi.fn();
vi.mock("@/app/(charter)/actions/vendors", () => ({
  listVendors: (...args: unknown[]) => listVendorsMock(...args),
}));

import CasesScreen from "../../components/charter/screens/cases";

describe("CasesScreen", () => {
  beforeEach(() => {
    pushMock.mockReset();
    listCasesMock.mockReset();
    submitCaseMock.mockReset();
    getPolicyMock.mockReset();
    listVendorsMock.mockReset();

    listCasesMock.mockResolvedValue({
      ok: true,
      data: { rows: [], departments: [] },
    });
    getPolicyMock.mockResolvedValue({ ok: true, data: null });
    listVendorsMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("não mostra mais 'Exportar fila' — o botão só navegava para a auditoria, já a um clique na nav lateral", async () => {
    render(<CasesScreen />);

    await screen.findByText("Casos de Uso de IA");
    expect(screen.queryByRole("button", { name: /exportar fila/i })).toBeNull();
    // A remoção não deve levar o botão de novo caso junto (a lista vazia
    // também oferece "Novo caso de uso" no estado vazio, por isso o
    // registro aceita mais de uma ocorrência).
    expect(
      screen.getAllByRole("button", { name: /novo caso de uso/i }).length
    ).toBeGreaterThanOrEqual(1);
  });
});

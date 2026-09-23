/** @vitest-environment jsdom */
// vendor-detail-unsaved-guard.test.tsx — marcar/desmarcar cláusula muda
// `assigned` e acende `dirty`, mas o BackLink e as linhas de caso vinculado
// chamavam `router.push` direto: a revisão contratual em curso sumia sem
// pergunta, e cláusula presente no contrato é o que decide o teto de dado.
//
// Molde: vendor-detail-screen.test.tsx. Mutação de referência: tirar o
// `guardUnsaved(...)` do onClick do BackLink → o primeiro teste daqui falha.

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const getVendorMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/vendors", () => ({
  getVendor: (...a: unknown[]) => getVendorMock(...a),
  setVendorClauses: vi.fn(),
  setVendorTier: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import VendorDetailScreen from "../../components/charter/screens/vendor-detail";

function baseVendor() {
  return {
    ok: true as const,
    data: {
      id: "v1",
      code: "FOR-01",
      name: "Fornecedor Teste",
      category: "SaaS",
      tier: "APPROVED",
      region: "BR",
      dpa: true,
      retention: "Zero",
      subprocessors: 2,
      maxClass: "CONFIDENTIAL",
      cases: 1,
      renewalAt: null,
      notes: null,
      flags: [],
      criticalMissing: 0,
      // O servidor entregou só DPA marcada.
      clauseCodes: ["DPA"],
      reasoning: ["Motivo de exemplo"],
      library: [
        { code: "DPA", name: "Acordo de tratamento", critical: true },
        { code: "SUBPROC", name: "Sub-processadores", critical: false },
      ],
      linkedCases: [
        {
          code: "UC-001",
          title: "Caso um",
          dataClass: "INTERNAL" as const,
          exceedsMaxClass: false,
        },
      ],
    },
  };
}

async function renderTela() {
  render(<VendorDetailScreen param="FOR-01" />);
  await screen.findByText("Fornecedor Teste");
}

function clausula(nome: RegExp): HTMLElement {
  return screen.getByRole("checkbox", { name: nome });
}

describe("VendorDetailScreen — cláusulas em edição não somem na saída", () => {
  beforeEach(() => {
    getVendorMock.mockReset();
    pushMock.mockReset();
    getVendorMock.mockResolvedValue(baseVendor());
  });

  it("com cláusula alterada, o BackLink não navega e abre a confirmação", async () => {
    await renderTela();
    fireEvent.click(clausula(/Sub-processadores/));

    fireEvent.click(screen.getByRole("button", { name: "Fornecedores" }));

    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("confirmar o descarte navega", async () => {
    await renderTela();
    fireEvent.click(clausula(/Sub-processadores/));
    fireEvent.click(screen.getByRole("button", { name: "Fornecedores" }));
    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(within(dialogo).getByText("Descartar"));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/charter/vendors")
    );
  });

  it("cancelar mantém a tela e a seleção de cláusulas", async () => {
    await renderTela();
    fireEvent.click(clausula(/Sub-processadores/));
    fireEvent.click(screen.getByRole("button", { name: "Fornecedores" }));
    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(within(dialogo).getByText("Cancelar"));

    await waitFor(() =>
      expect(screen.queryByText("Descartar alterações?")).toBeNull()
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(clausula(/Sub-processadores/).getAttribute("aria-checked")).toBe(
      "true"
    );
  });

  it("abrir um caso vinculado com cláusula alterada também pergunta", async () => {
    await renderTela();
    fireEvent.click(clausula(/Sub-processadores/));

    fireEvent.click(screen.getByRole("button", { name: /Abrir UC-001/ }));

    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("marcar e desmarcar não pergunta — sujo é divergir do servidor", async () => {
    await renderTela();
    fireEvent.click(clausula(/Sub-processadores/));
    fireEvent.click(clausula(/Sub-processadores/));

    fireEvent.click(screen.getByRole("button", { name: "Fornecedores" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/charter/vendors")
    );
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });

  it("sem tocar nas cláusulas, o BackLink navega direto", async () => {
    await renderTela();

    fireEvent.click(screen.getByRole("button", { name: "Fornecedores" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/charter/vendors")
    );
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });
});

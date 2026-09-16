/** @vitest-environment jsdom */
// cases-screen-launch-target.test.tsx — o "Início pretendido" do intake chega
// ao banco. O IntakeModal emite `launchTarget` e `submitCase` já aceita e
// grava em `CharterUseCase.launchTarget`; o furo era a tela de casos, que
// monta o `submitCase` campo a campo e descartava o valor. Mutação que este
// arquivo pega: tirar `launchTarget: input.launchTarget` de cases.tsx.
// `sonner` mockado no padrão de case-detail-draft.test.tsx.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VendorRow } from "@/app/(charter)/actions/vendors";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listCasesMock = vi.hoisted(() => vi.fn());
const submitCaseMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/(charter)/actions/cases", () => ({
  listCases: (...args: unknown[]) => listCasesMock(...args),
  submitCase: (...args: unknown[]) => submitCaseMock(...args),
}));

const getPolicyMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicy: (...args: unknown[]) => getPolicyMock(...args),
}));

const listVendorsMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/(charter)/actions/vendors", () => ({
  listVendors: (...args: unknown[]) => listVendorsMock(...args),
}));

import CasesScreen from "../../components/charter/screens/cases";

const vendor: VendorRow = {
  id: "v-1",
  code: "V-001",
  name: "OpenAI",
  category: "LLM",
  tier: "APPROVED",
  region: "UE",
  dpa: true,
  retention: "Zero",
  subprocessors: 0,
  maxClass: "CONFIDENTIAL",
  score: 0,
  cases: 0,
  renewalAt: null,
  notes: null,
  flags: [],
  criticalMissing: 0,
};

const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });

describe("CasesScreen repassa o início pretendido do intake", () => {
  beforeEach(() => {
    listCasesMock.mockReset();
    submitCaseMock.mockReset();
    getPolicyMock.mockReset();
    listVendorsMock.mockReset();
    listCasesMock.mockResolvedValue({
      ok: true,
      data: { rows: [], departments: [] },
    });
    getPolicyMock.mockResolvedValue({ ok: true, data: null });
    listVendorsMock.mockResolvedValue({ ok: true, data: [vendor] });
    submitCaseMock.mockResolvedValue({ ok: true, data: { code: "UC-001" } });
  });

  it("submitCase recebe launchTarget com a data preenchida em 'Início pretendido'", async () => {
    render(<CasesScreen />);
    await screen.findByText("Casos de Uso de IA");
    fireEvent.click(
      screen.getAllByRole("button", { name: /novo caso de uso/i })[0]
    );
    await screen.findByRole("dialog", { name: "Novo caso de uso de IA" });

    type(
      screen.getByPlaceholderText(/Triagem assistida/),
      "Triagem de sinistros"
    );
    type(
      screen.getByPlaceholderText(/Reduzir o tempo médio/),
      "Reduzir o tempo de triagem de 6 para 2 dias."
    );
    type(screen.getByPlaceholderText("Nome de quem responde pelo caso"), "Bia");
    type(screen.getByLabelText(/Início pretendido/), "2026-11-01");
    fireEvent.click(
      screen.getByRole("button", { name: "Submeter para revisão" })
    );

    await waitFor(() => expect(submitCaseMock).toHaveBeenCalledTimes(1));
    expect(submitCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Triagem de sinistros",
        launchTarget: "2026-11-01",
        asDraft: false,
      })
    );
  });

  it("sem data, submitCase recebe launchTarget undefined (a action grava null)", async () => {
    render(<CasesScreen />);
    await screen.findByText("Casos de Uso de IA");
    fireEvent.click(
      screen.getAllByRole("button", { name: /novo caso de uso/i })[0]
    );
    await screen.findByRole("dialog", { name: "Novo caso de uso de IA" });

    type(
      screen.getByPlaceholderText(/Triagem assistida/),
      "Triagem de sinistros"
    );
    type(
      screen.getByPlaceholderText(/Reduzir o tempo médio/),
      "Reduzir o tempo de triagem de 6 para 2 dias."
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(submitCaseMock).toHaveBeenCalledTimes(1));
    expect(submitCaseMock.mock.calls[0][0].launchTarget).toBeUndefined();
  });
});

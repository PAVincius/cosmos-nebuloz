/** @vitest-environment jsdom */
// onboarding-screen.test.tsx — "Registrar" na lista de aceites pendentes é
// sempre em nome de outra pessoa (a lista não tem linha de aceite próprio):
// exige confirmação com justificativa antes de chamar acknowledge(), e o
// botão de confirmar fica realmente desabilitado (não <span
// opacity/pointerEvents>) até 10 caracteres. Molde de policy-scope.test.tsx.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const getOnboardingMock = vi.hoisted(() => vi.fn());
const acknowledgeMock = vi.hoisted(() => vi.fn());
const publishTrackMock = vi.hoisted(() => vi.fn());
const getPolicyMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/onboarding", () => ({
  getOnboarding: (...a: unknown[]) => getOnboardingMock(...a),
  acknowledge: (...a: unknown[]) => acknowledgeMock(...a),
  publishTrack: (...a: unknown[]) => publishTrackMock(...a),
}));
vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicy: (...a: unknown[]) => getPolicyMock(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import OnboardingScreen from "../../components/charter/screens/onboarding";

function baseOnboarding() {
  return {
    ok: true as const,
    data: {
      tracks: [
        {
          id: "tr-1",
          code: "TR-01",
          name: "Onboarding geral",
          audience: "Todos",
          modules: 3,
          minutes: 20,
          recert: "ANNUAL",
          policyVersion: "3.2",
          needsReassignment: false,
          assigned: 5,
          done: 3,
          overdue: 0,
          coverage: 60,
        },
      ],
      pending: [
        {
          id: "ack-1",
          personName: "Fulano de Tal",
          department: "Vendas",
          trackCode: "TR-01",
          trackName: "Onboarding geral",
          assignedAt: new Date().toISOString(),
          daysLate: 2,
        },
      ],
      coverage: { assigned: 5, done: 3, pct: 60 },
    },
  };
}

describe("OnboardingScreen — aceite em nome de terceiro", () => {
  beforeEach(() => {
    getOnboardingMock.mockReset();
    acknowledgeMock.mockReset();
    publishTrackMock.mockReset();
    getPolicyMock.mockReset();
    toastMocks.loading.mockReset();
    toastMocks.success.mockReset();
    toastMocks.error.mockReset();
    toastMocks.loading.mockReturnValue("toast-1");
    getOnboardingMock.mockResolvedValue(baseOnboarding());
    getPolicyMock.mockResolvedValue({ ok: true, data: null });
  });

  it("Registrar abre o modal e não chama acknowledge antes de confirmar", async () => {
    render(<OnboardingScreen />);

    fireEvent.click(await screen.findByText("Registrar"));

    expect(
      await screen.findByText("Registrar aceite em nome de Fulano de Tal?")
    ).toBeTruthy();
    expect(acknowledgeMock).not.toHaveBeenCalled();
  });

  it("botão de confirmar fica desabilitado com menos de 10 caracteres e não dispara a action", async () => {
    render(<OnboardingScreen />);
    fireEvent.click(await screen.findByText("Registrar"));
    await screen.findByText("Registrar aceite em nome de Fulano de Tal?");

    const textarea = screen.getByLabelText("Justificativa");
    fireEvent.change(textarea, { target: { value: "curta" } });

    const botao = screen.getByText("Registrar aceite").closest("button");
    expect(botao?.disabled).toBe(true);

    fireEvent.click(botao as HTMLButtonElement);
    fireEvent.keyDown(botao as HTMLButtonElement, { key: "Enter" });
    expect(acknowledgeMock).not.toHaveBeenCalled();
  });

  it("confirmar com justificativa válida chama acknowledge com { id, justificativa }", async () => {
    acknowledgeMock.mockResolvedValue({ ok: true, data: null });
    render(<OnboardingScreen />);
    fireEvent.click(await screen.findByText("Registrar"));
    await screen.findByText("Registrar aceite em nome de Fulano de Tal?");

    fireEvent.change(screen.getByLabelText("Justificativa"), {
      target: {
        value: "Fulano está de licença e me pediu para registrar por ele.",
      },
    });

    const botao = screen.getByText("Registrar aceite").closest("button");
    expect(botao?.disabled).toBe(false);
    fireEvent.click(botao as HTMLButtonElement);

    await waitFor(() =>
      expect(acknowledgeMock).toHaveBeenCalledWith({
        id: "ack-1",
        justificativa:
          "Fulano está de licença e me pediu para registrar por ele.",
      })
    );
  });
});

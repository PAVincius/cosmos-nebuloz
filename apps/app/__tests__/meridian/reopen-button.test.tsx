import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Botão "Reabrir assessment" (D-29, FR-029e): só aparece com o assessment
// FINALISED e a permissão assessment.manage; exige motivo de 20+ caracteres,
// que a tela diz quantos faltam; pede confirmação.

const h = vi.hoisted(() => ({ reopenAssessment: vi.fn() }));

vi.mock("@/app/(meridian)/actions/reopen", () => ({
  reopenAssessment: h.reopenAssessment,
}));
vi.mock("@/components/cosmos/use-action-toast", () => ({
  useActionToast: (fn: () => Promise<unknown>) => fn(),
}));

import { ModalProvider } from "@/components/meridian/base";
import { ReopenAssessmentButton } from "@/components/meridian/screens/reopen-button";

const detail = (status: string, manage = true) =>
  ({
    id: "as-1",
    code: "AS-104",
    status,
    permissions: { manage, override: true },
  }) as never;

const montar = (a: never, onChanged = vi.fn()) => {
  render(
    <ModalProvider>
      <ReopenAssessmentButton a={a} onChanged={onChanged} />
    </ModalProvider>
  );
  return onChanged;
};

const MOTIVO = "Pontuação de Dados lançada no eixo errado.";

beforeEach(() => {
  vi.clearAllMocks();
  h.reopenAssessment.mockResolvedValue({
    ok: true,
    data: { status: "REVIEW" },
  });
});
afterEach(cleanup);

describe("ReopenAssessmentButton", () => {
  it("finalizado + assessment.manage: o botão aparece", () => {
    montar(detail("FINALISED"));
    expect(
      screen.getByRole("button", { name: /Reabrir assessment/ })
    ).toBeTruthy();
  });

  it.each([
    "DRAFT",
    "COLLECTING",
    "REVIEW",
  ])("%s: não aparece (só se reabre o finalizado)", (status) => {
    montar(detail(status));
    expect(
      screen.queryByRole("button", { name: /Reabrir assessment/ })
    ).toBeNull();
  });

  it("sem assessment.manage o botão fica desabilitado, com o motivo escrito (finalizado)", () => {
    montar(detail("FINALISED", false));
    const botao = screen.getByRole("button", { name: /Reabrir assessment/ });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/Só a consultora reabre o assessment/)
    ).toBeTruthy();
  });

  it("sem assessment.manage, clicar não abre o diálogo", () => {
    montar(detail("FINALISED", false));
    fireEvent.click(screen.getByRole("button", { name: /Reabrir assessment/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.reopenAssessment).not.toHaveBeenCalled();
  });

  it.each([
    "DRAFT",
    "COLLECTING",
    "REVIEW",
  ])("%s sem assessment.manage: também não aparece (não há o que reabrir)", (status) => {
    montar(detail(status, false));
    expect(
      screen.queryByRole("button", { name: /Reabrir assessment/ })
    ).toBeNull();
  });

  it("clicar só abre o diálogo com o campo do motivo: nada é gravado", () => {
    montar(detail("FINALISED"));
    fireEvent.click(screen.getByRole("button", { name: /Reabrir assessment/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText(/Motivo/i)).toBeTruthy();
    expect(h.reopenAssessment).not.toHaveBeenCalled();
  });

  it("motivo curto: confirmar fica desabilitado e a tela diz quantos caracteres faltam", () => {
    montar(detail("FINALISED"));
    fireEvent.click(screen.getByRole("button", { name: /Reabrir assessment/ }));
    fireEvent.change(screen.getByLabelText(/Motivo/i), {
      target: { value: "curto" },
    });
    const confirmar = screen.getByRole("button", {
      name: /Confirmar reabertura/,
    }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    expect(screen.getByText(/faltam 15/)).toBeTruthy();
  });

  it("motivo suficiente: confirmar chama a action com id e motivo, e recarrega", async () => {
    const onChanged = montar(detail("FINALISED"));
    fireEvent.click(screen.getByRole("button", { name: /Reabrir assessment/ }));
    fireEvent.change(screen.getByLabelText(/Motivo/i), {
      target: { value: MOTIVO },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar reabertura/ })
    );
    await waitFor(() =>
      expect(h.reopenAssessment).toHaveBeenCalledExactlyOnceWith({
        assessmentId: "as-1",
        reason: MOTIVO,
      })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("recusa do servidor não recarrega como se tivesse dado certo", async () => {
    h.reopenAssessment.mockResolvedValue({
      ok: false,
      error: "Só se reabre um assessment finalizado.",
      code: "reopen.not-finalised",
    });
    const onChanged = montar(detail("FINALISED"));
    fireEvent.click(screen.getByRole("button", { name: /Reabrir assessment/ }));
    fireEvent.change(screen.getByLabelText(/Motivo/i), {
      target: { value: MOTIVO },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar reabertura/ })
    );
    await waitFor(() => expect(h.reopenAssessment).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("cancelar não grava nem recarrega", () => {
    const onChanged = montar(detail("FINALISED"));
    fireEvent.click(screen.getByRole("button", { name: /Reabrir assessment/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(h.reopenAssessment).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

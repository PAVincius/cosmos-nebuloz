import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Botão "Finalizar assessment" (decisão do Norte, 30/09). Ação irreversível:
// pede confirmação. Sem poder finalizar, fica `disabled` de verdade e o MOTIVO
// está escrito na tela (DESIGN.md do Meridian), não em title.

const h = vi.hoisted(() => ({ finalizeAssessment: vi.fn() }));

vi.mock("@/app/(meridian)/actions/finalize", () => ({
  finalizeAssessment: h.finalizeAssessment,
}));
vi.mock("@/components/cosmos/use-action-toast", () => ({
  useActionToast: (fn: () => Promise<unknown>) => fn(),
}));

import { ModalProvider } from "@/components/meridian/base";
import { FinalizeAssessmentButton } from "@/components/meridian/screens/finalize-button";

const AXES5 = ["DATA", "PROCESS", "PEOPLE", "GOVERNANCE", "INFRASTRUCTURE"];
const detail = (status: string, statuses: Record<string, string> = {}) =>
  ({
    id: "as-1",
    code: "AS-104",
    status,
    scores: AXES5.map((axis) => ({
      axis,
      status: statuses[axis] ?? "COMPUTED",
    })),
  }) as never;

const montar = (a: never, onChanged = vi.fn()) => {
  render(
    <ModalProvider>
      <FinalizeAssessmentButton a={a} onChanged={onChanged} />
    </ModalProvider>
  );
  return onChanged;
};

beforeEach(() => {
  vi.clearAllMocks();
  h.finalizeAssessment.mockResolvedValue({
    ok: true,
    data: { status: "FINALISED" },
  });
});
afterEach(cleanup);

describe("FinalizeAssessmentButton", () => {
  it("em revisão, sem contestado: habilitado", () => {
    montar(detail("REVIEW"));
    const botao = screen.getByRole("button", { name: /Finalizar assessment/ });
    expect((botao as HTMLButtonElement).disabled).toBe(false);
  });

  it("clicar só abre a confirmação: nada é gravado antes de confirmar", () => {
    montar(detail("REVIEW"));
    fireEvent.click(
      screen.getByRole("button", { name: /Finalizar assessment/ })
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/gaps ranqueados/i)).toBeTruthy();
    expect(h.finalizeAssessment).not.toHaveBeenCalled();
  });

  it("confirmar chama a action com o id e recarrega", async () => {
    const onChanged = montar(detail("REVIEW"));
    fireEvent.click(
      screen.getByRole("button", { name: /Finalizar assessment/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar finalização/ })
    );
    await waitFor(() =>
      expect(h.finalizeAssessment).toHaveBeenCalledExactlyOnceWith({
        assessmentId: "as-1",
      })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("cancelar não grava nem recarrega", () => {
    const onChanged = montar(detail("REVIEW"));
    fireEvent.click(
      screen.getByRole("button", { name: /Finalizar assessment/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(h.finalizeAssessment).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("recusa do servidor não recarrega como se tivesse dado certo", async () => {
    h.finalizeAssessment.mockResolvedValue({
      ok: false,
      error: "Há eixo contestado sem decisão (Data)",
      code: "finalize.contested-pending",
    });
    const onChanged = montar(detail("REVIEW"));
    fireEvent.click(
      screen.getByRole("button", { name: /Finalizar assessment/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar finalização/ })
    );
    await waitFor(() => expect(h.finalizeAssessment).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("eixo contestado: desabilitado, com o motivo escrito e os eixos nomeados", () => {
    montar(detail("REVIEW", { DATA: "CONTESTED", PEOPLE: "CONTESTED" }));
    const botao = screen.getByRole("button", { name: /Finalizar assessment/ });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/contestado/i).textContent).toMatch(/Data/);
    expect(screen.getByText(/contestado/i).textContent).toMatch(/People/);
  });

  it("eixo sobrescrito já foi decidido: não bloqueia", () => {
    montar(detail("REVIEW", { DATA: "OVERRIDDEN" }));
    const botao = screen.getByRole("button", { name: /Finalizar assessment/ });
    expect((botao as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    "DRAFT",
    "COLLECTING",
  ])("%s: desabilitado, com o motivo (fechar a coleta)", (status) => {
    montar(detail(status));
    const botao = screen.getByRole("button", { name: /Finalizar assessment/ });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/feche a coleta/i)).toBeTruthy();
  });

  it("já finalizado: não mostra o botão", () => {
    montar(detail("FINALISED"));
    expect(
      screen.queryByRole("button", { name: /Finalizar assessment/ })
    ).toBeNull();
  });

  it("scoring incompleto em revisão: desabilitado, com o motivo", () => {
    montar({
      id: "as-1",
      code: "AS-104",
      status: "REVIEW",
      scores: [{ axis: "DATA", status: "COMPUTED" }],
    } as never);
    const botao = screen.getByRole("button", { name: /Finalizar assessment/ });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/eixo sem score/i)).toBeTruthy();
  });
});

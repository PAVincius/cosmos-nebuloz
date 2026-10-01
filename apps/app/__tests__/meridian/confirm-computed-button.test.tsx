import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "Confirmar o computado" no modal do eixo (D-29, FR-029a): só faz sentido para
// eixo contestado; exige a mesma justificativa do override (20+); sem
// override.write o botão fica DESABILITADO com o motivo escrito (DESIGN.md do
// Meridian), e o servidor segue recusando.

const h = vi.hoisted(() => ({ confirmComputed: vi.fn() }));

vi.mock("@/app/(meridian)/actions/confirm", () => ({
  confirmComputed: h.confirmComputed,
}));
vi.mock("@/components/cosmos/use-action-toast", () => ({
  useActionToast: (fn: () => Promise<unknown>) => fn(),
}));

import {
  axisStatusMeta,
  ConfirmComputedButton,
} from "@/components/meridian/screens/confirm-computed";

const LONG = "O computado reflete a evidência; a discordância é de leitura.";

type Over = {
  status?: string;
  canConfirm?: boolean;
  rationale?: string;
};

const montar = (over: Over = {}) => {
  const onDone = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmComputedButton
      a={
        {
          id: "as-1",
          permissions: { manage: true, override: over.canConfirm ?? true },
        } as never
      }
      onClose={onClose}
      onDone={onDone}
      rationale={over.rationale ?? LONG}
      score={{ axis: "DATA", status: over.status ?? "CONTESTED" } as never}
    />
  );
  return { onDone, onClose };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.confirmComputed.mockResolvedValue({
    ok: true,
    data: { id: "ov1", code: "OV-11" },
  });
});
afterEach(cleanup);

describe("ConfirmComputedButton", () => {
  it("eixo contestado, com permissão e justificativa: habilitado", () => {
    montar();
    const b = screen.getByRole("button", { name: /Confirmar o computado/ });
    expect((b as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    "COMPUTED",
    "OVERRIDDEN",
  ])("eixo %s: o botão nem existe (só se confirma eixo contestado)", (status) => {
    montar({ status });
    expect(
      screen.queryByRole("button", { name: /Confirmar o computado/ })
    ).toBeNull();
  });

  it("justificativa curta: desabilitado", () => {
    montar({ rationale: "curta" });
    const b = screen.getByRole("button", { name: /Confirmar o computado/ });
    expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem override.write: desabilitado com o motivo escrito, e clicar não chama nada", () => {
    montar({ canConfirm: false });
    const b = screen.getByRole("button", { name: /Confirmar o computado/ });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/Só a consultora ou a revisora confirmam o computado/)
    ).toBeTruthy();
    fireEvent.click(b);
    expect(h.confirmComputed).not.toHaveBeenCalled();
  });

  it("clicar chama a action com assessment, eixo e justificativa, e recarrega e fecha", async () => {
    const { onDone, onClose } = montar();
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar o computado/ })
    );
    await waitFor(() =>
      expect(h.confirmComputed).toHaveBeenCalledExactlyOnceWith({
        assessmentId: "as-1",
        axis: "DATA",
        rationale: LONG,
      })
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("recusa do servidor não recarrega nem fecha como se tivesse dado certo", async () => {
    h.confirmComputed.mockResolvedValue({
      ok: false,
      error: "Só se confirma o computado de um eixo contestado.",
      code: "confirm.not-contested",
    });
    const { onDone, onClose } = montar();
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar o computado/ })
    );
    await waitFor(() => expect(h.confirmComputed).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("axisStatusMeta — como o eixo aparece no card", () => {
  const meta = (status: string, confirmed = false) =>
    axisStatusMeta({ status, confirmed } as never);

  it("confirmado pelo revisor: nunca 'Computado' nem 'Override'", () => {
    expect(meta("COMPUTED", true)[1]).toBe("Confirmado pelo revisor");
  });
  it("os demais estados seguem como eram", () => {
    expect(meta("COMPUTED")[1]).toBe("Computado");
    expect(meta("CONTESTED")[1]).toBe("Contestado");
    expect(meta("OVERRIDDEN")[1]).toBe("Override");
  });
  it("override vence a confirmação anterior", () => {
    expect(meta("OVERRIDDEN", true)[1]).toBe("Override");
  });
});

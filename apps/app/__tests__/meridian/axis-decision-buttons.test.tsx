import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Modal do eixo: "Registrar override" também obedece ao DESIGN.md do Meridian
// (mesma regra do achado do Crivo no #334). Sem override.write o botão fica
// DESABILITADO, com o motivo escrito; o servidor segue recusando. A tela não
// promete o que o servidor recusa e não esconde o controle.

vi.mock("@/app/(meridian)/actions/confirm", () => ({
  confirmComputed: vi.fn(),
}));
vi.mock("@/components/cosmos/use-action-toast", () => ({
  useActionToast: (fn: () => Promise<unknown>) => fn(),
}));

import { AxisDecisionButtons } from "@/components/meridian/screens/confirm-computed";

const montar = (
  over: {
    canDecide?: boolean;
    registerDisabled?: boolean;
    status?: string;
  } = {}
) => {
  const onRegister = vi.fn();
  render(
    <AxisDecisionButtons
      a={
        {
          id: "as-1",
          permissions: { manage: true, override: over.canDecide ?? true },
        } as never
      }
      onClose={vi.fn()}
      onDone={vi.fn()}
      onRegister={onRegister}
      rationale="Justificativa com mais de vinte caracteres."
      registerDisabled={over.registerDisabled ?? false}
      score={{ axis: "DATA", status: over.status ?? "CONTESTED" } as never}
    />
  );
  return { onRegister };
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("AxisDecisionButtons — Registrar override", () => {
  it("com override.write e formulário válido: habilitado, e clicar registra", () => {
    const { onRegister } = montar();
    const b = screen.getByRole("button", { name: /Registrar override/ });
    expect((b as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(b);
    expect(onRegister).toHaveBeenCalledOnce();
  });

  it("sem override.write: desabilitado, com o motivo escrito, e clicar não registra", () => {
    const { onRegister } = montar({ canDecide: false });
    const b = screen.getByRole("button", { name: /Registrar override/ });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/Só a consultora ou a revisora registram override/)
    ).toBeTruthy();
    fireEvent.click(b);
    expect(onRegister).not.toHaveBeenCalled();
  });

  it("formulário inválido (com permissão): desabilitado, sem motivo de papel", () => {
    montar({ registerDisabled: true });
    const b = screen.getByRole("button", { name: /Registrar override/ });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/Só a consultora ou a revisora/)).toBeNull();
  });

  it("o botão de registrar aparece em qualquer estado do eixo (override vale para eixo não contestado)", () => {
    montar({ status: "COMPUTED" });
    expect(
      screen.getByRole("button", { name: /Registrar override/ })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Confirmar o computado/ })
    ).toBeNull();
  });

  it("eixo contestado sem permissão: os dois botões desabilitados, cada um com o seu motivo", () => {
    montar({ canDecide: false });
    for (const nome of [/Registrar override/, /Confirmar o computado/]) {
      const b = screen.getByRole("button", { name: nome });
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByText(/confirmam o computado/)).toBeTruthy();
    expect(screen.getByText(/registram override/)).toBeTruthy();
  });
});

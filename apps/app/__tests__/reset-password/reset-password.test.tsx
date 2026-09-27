import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("../../../../packages/auth/client", () => ({
  authClient: { resetPassword: h.resetPassword },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => h.searchParams,
}));

import { ResetPassword } from "../../../../packages/auth/components/reset-password";

beforeEach(() => {
  vi.clearAllMocks();
  h.searchParams = new URLSearchParams({ token: "token-valido" });
});

describe("ResetPassword — token inválido/expirado (US4, FR-011)", () => {
  it("mostra tela de link inválido quando não há token", () => {
    h.searchParams = new URLSearchParams();
    render(<ResetPassword />);

    expect(screen.getByText(/link inválido ou expirado/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /solicitar novo link/i })
    ).toBeTruthy();
  });

  it("mostra tela de link inválido quando a URL vem com ?error=", () => {
    h.searchParams = new URLSearchParams({
      error: "INVALID_TOKEN",
      callbackURL: "/reset-password",
    });
    render(<ResetPassword />);

    expect(screen.getByText(/link inválido ou expirado/i)).toBeTruthy();
  });
});

describe("ResetPassword — define nova senha (US4, FR-010)", () => {
  // Achado do Vigia (info): UI anunciava "mínimo 8" enquanto o servidor
  // exigia 12 (server.ts, SOC2 CC6).
  it("exige o mesmo mínimo de senha do servidor (12, SOC2 CC6)", () => {
    render(<ResetPassword />);

    const novaSenha = screen.getByLabelText(/nova senha/i);
    expect(novaSenha.getAttribute("minlength")).toBe("12");
    expect(novaSenha.getAttribute("placeholder")).toBe("Mínimo 12 caracteres");
  });

  it("chama authClient.resetPassword com a nova senha e o token da URL", async () => {
    h.resetPassword.mockResolvedValue({ data: {}, error: null });
    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/nova senha/i), {
      target: { value: "senha-nova-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByText(/senha redefinida/i)).toBeTruthy();
    });
    expect(h.resetPassword).toHaveBeenCalledWith({
      newPassword: "senha-nova-1234",
      token: "token-valido",
    });
    expect(screen.getByRole("link", { name: /ir para o login/i })).toBeTruthy();
  });

  it("mostra erro claro quando o backend rejeita (token expirado no meio do caminho)", async () => {
    h.resetPassword.mockResolvedValue({
      data: null,
      error: { message: "Token expirado" },
    });
    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/nova senha/i), {
      target: { value: "senha-nova-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByText(/token expirado/i)).toBeTruthy();
    });
    expect(screen.queryByText(/senha redefinida/i)).toBeNull();
  });
});

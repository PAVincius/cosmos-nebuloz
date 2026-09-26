import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

vi.mock("@repo/auth/client", () => ({
  authClient: { changePassword: authMocks.changePassword },
}));

import { SecurityForm } from "../../app/(authenticated)/settings/security/security-form";

beforeEach(() => {
  vi.clearAllMocks();
});

function preencher(atual: string, nova: string) {
  fireEvent.change(screen.getByLabelText(/senha atual/i), {
    target: { value: atual },
  });
  fireEvent.change(screen.getByLabelText(/^nova senha/i), {
    target: { value: nova },
  });
}

describe("SecurityForm — trocar senha logado (US3, FR-007/FR-008)", () => {
  // Achado do Vigia (info): UI anunciava "mínimo 8" enquanto o servidor
  // exigia 12 (server.ts, SOC2 CC6) — a pessoa digitava 8-11 caracteres,
  // via passava, e só descobria a regra de verdade no erro do servidor.
  it("exige o mesmo mínimo de senha do servidor (12, SOC2 CC6)", () => {
    render(<SecurityForm />);

    const novaSenha = screen.getByLabelText(/^nova senha/i);
    expect(novaSenha.getAttribute("minlength")).toBe("12");
    expect(novaSenha.getAttribute("placeholder")).toBe("Mínimo 12 caracteres");
  });

  it("troca a senha com sucesso e avisa o usuário", async () => {
    authMocks.changePassword.mockResolvedValue({ data: {}, error: null });
    render(<SecurityForm />);

    preencher("senha-atual-123", "senha-nova-1234");
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/senha alterada/i)).not.toBeNull();
    });
    // revokeOtherSessions:true — sessão roubada (ou de outro dispositivo)
    // não sobrevive à troca de senha (achado do Vigia na revisão de
    // segurança da spec 004). A sessão atual é preservada pelo próprio
    // better-auth (recria com token novo e seta o cookie), só as outras
    // caem.
    expect(authMocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "senha-atual-123",
      newPassword: "senha-nova-1234",
      revokeOtherSessions: true,
    });
  });

  it("rejeita com mensagem clara quando a senha atual está incorreta, sem alterar nada", async () => {
    authMocks.changePassword.mockResolvedValue({
      data: null,
      error: { message: "Senha atual incorreta" },
    });
    render(<SecurityForm />);

    preencher("senha-errada", "senha-nova-1234");
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/senha atual incorreta/i)).not.toBeNull();
    });
    expect(screen.queryByText(/senha alterada/i)).toBeNull();
  });
});

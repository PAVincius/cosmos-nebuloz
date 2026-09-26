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
  it("troca a senha com sucesso e avisa o usuário", async () => {
    authMocks.changePassword.mockResolvedValue({ data: {}, error: null });
    render(<SecurityForm />);

    preencher("senha-atual-123", "senha-nova-1234");
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/senha alterada/i)).not.toBeNull();
    });
    expect(authMocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "senha-atual-123",
      newPassword: "senha-nova-1234",
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

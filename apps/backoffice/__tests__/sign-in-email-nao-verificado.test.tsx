/** @vitest-environment jsdom */
// sign-in-email-nao-verificado.test.tsx — o login do back-office com
// `requireEmailVerification`: conta sem e-mail confirmado volta 403
// EMAIL_NOT_VERIFIED, e o formulário acusava "E-mail ou senha incorretos".
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ signInEmail: vi.fn() }));

vi.mock("@repo/auth/client", () => ({
  authClient: {
    signIn: { email: h.signInEmail },
    twoFactor: { verifyTotp: vi.fn() },
  },
}));

import { SignInForm } from "@/app/sign-in/form";

function entrar() {
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: "staff@nebuloz.ai" },
  });
  fireEvent.change(screen.getByLabelText(/senha/i), {
    target: { value: "senha-super-segura" },
  });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignInForm — e-mail não verificado", () => {
  it("diz que falta confirmar o e-mail, não que a senha está errada", async () => {
    h.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", status: 403 },
    });
    render(<SignInForm />);

    entrar();

    await waitFor(() =>
      expect(screen.getByText(/confirme seu e-mail/i)).toBeTruthy()
    );
    expect(screen.queryByText(/e-mail ou senha incorretos/i)).toBeNull();
  });

  it("senha errada segue genérica", async () => {
    h.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    });
    render(<SignInForm />);

    entrar();

    await waitFor(() =>
      expect(screen.getByText(/e-mail ou senha incorretos/i)).toBeTruthy()
    );
  });
});

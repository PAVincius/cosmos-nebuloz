// verificacao-de-email.test.tsx — as telas depois de `requireEmailVerification`.
//
// Antes, o cadastro abria a sessão na hora e as telas só tratavam o erro: no
// sucesso o `loading` ficava ligado esperando o redirecionamento do
// better-auth. Agora o cadastro responde com `token: null` e nenhuma sessão —
// o redirecionamento nunca vem, e o formulário parava num "Criando conta…"
// eterno. E o login de conta sem verificação (403 EMAIL_NOT_VERIFIED) caía no
// "Email ou senha incorretos", que manda a pessoa trocar uma senha que está certa.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  logLoginFailure: vi.fn(),
}));

vi.mock("../../../../packages/auth/client", () => ({
  authClient: {
    signIn: { email: h.signInEmail },
    signUp: { email: h.signUpEmail },
    twoFactor: { verifyTotp: vi.fn() },
  },
}));
vi.mock("../../../../packages/auth/auth-events", () => ({
  logLoginSuccess: vi.fn().mockResolvedValue(undefined),
  logLoginFailure: h.logLoginFailure,
  logMfaVerified: vi.fn().mockResolvedValue(undefined),
  logMfaFailed: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "convite-1" }),
}));

import { SignIn } from "../../../../packages/auth/components/sign-in";
import { SignUp } from "../../../../packages/auth/components/sign-up";
import { AcceptInviteForm } from "../../app/(unauthenticated)/invite/[token]/components/accept-invite-form";

const SENHA = "Senha-bem-forte-123";

beforeEach(() => {
  vi.clearAllMocks();
  h.logLoginFailure.mockResolvedValue(undefined);
});

describe("SignUp — cadastro sem sessão", () => {
  it("depois de enviar, pede para abrir o e-mail e não fica em 'Criando conta…'", async () => {
    h.signUpEmail.mockResolvedValue({
      data: { token: null, user: { id: "u1" } },
      error: null,
    });
    render(<SignUp />);

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: "Ana Lima" },
    });
    fireEvent.change(screen.getByLabelText(/email corporativo/i), {
      target: { value: "Ana@Empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/^senha$/i), {
      target: { value: SENHA },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: SENHA },
    });
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    expect(
      await screen.findByRole("heading", { name: /verifique seu e-mail/i })
    ).toBeTruthy();
    expect(screen.getByText(/ana@empresa\.com/i)).toBeTruthy();
    expect(screen.queryByText(/criando conta/i)).toBeNull();
    expect(h.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/onboarding" })
    );
  });

  it("erro do servidor continua aparecendo no formulário", async () => {
    h.signUpEmail.mockResolvedValue({
      data: null,
      error: { message: "Senha muito curta" },
    });
    render(<SignUp />);

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: "Ana Lima" },
    });
    fireEvent.change(screen.getByLabelText(/email corporativo/i), {
      target: { value: "ana@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/^senha$/i), {
      target: { value: SENHA },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: SENHA },
    });
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    expect(await screen.findByText(/senha muito curta/i)).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: /verifique seu e-mail/i })
    ).toBeNull();
  });
});

describe("AcceptInviteForm — convite sem sessão imediata", () => {
  it("depois de criar a conta, pede para confirmar o e-mail para concluir o convite", async () => {
    h.signUpEmail.mockResolvedValue({
      data: { token: null, user: { id: "u1" } },
      error: null,
    });
    render(
      <AcceptInviteForm
        email="convidada@empresa.com"
        invitationId="convite-1"
        workspaceName="Atlas Energia"
      />
    );

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: "Convidada Silva" },
    });
    fireEvent.change(screen.getByLabelText(/criar senha/i), {
      target: { value: SENHA },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: SENHA },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /criar conta e aceitar convite/i })
    );

    expect(
      await screen.findByRole("heading", { name: /verifique seu e-mail/i })
    ).toBeTruthy();
    expect(screen.getByText(/convidada@empresa\.com/i)).toBeTruthy();
    expect(screen.getByText(/atlas energia/i)).toBeTruthy();
    // Com `requireEmailVerification` o cadastro de e-mail já existente também
    // responde sucesso (anti-enumeração): quem já tem conta precisa saber o que fazer.
    expect(screen.getByText(/já tem conta/i)).toBeTruthy();
    expect(h.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/invite/convite-1/complete" })
    );
  });
});

describe("SignIn — conta com e-mail não verificado", () => {
  it("explica que falta confirmar o e-mail em vez de acusar senha incorreta", async () => {
    h.signInEmail.mockResolvedValue({
      data: null,
      error: {
        code: "EMAIL_NOT_VERIFIED",
        message: "Email not verified",
        status: 403,
      },
    });
    render(<SignIn />);

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: "ana@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: SENHA },
    });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() =>
      expect(screen.getByText(/confirme seu e-mail/i)).toBeTruthy()
    );
    expect(screen.queryByText(/email ou senha incorretos/i)).toBeNull();
  });

  it("senha errada segue com a mensagem genérica", async () => {
    h.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    });
    render(<SignIn />);

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: "ana@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: SENHA },
    });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() =>
      expect(screen.getByText(/email ou senha incorretos/i)).toBeTruthy()
    );
  });
});

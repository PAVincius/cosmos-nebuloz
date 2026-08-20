// sign-in-2fa.test.tsx — o caminho de 2FA do formulário de entrada.
//
// Com 2FA ativo, o better-auth responde o sign-in com HTTP 200 e
// `data.twoFactorRedirect: true` — `error` vem nulo (confirmado em
// dist/plugins/two-factor do pacote instalado). O formulário só trocava para
// o passo TOTP quando `result.error` mencionava "two/otp/2fa", coisa que a
// lib não manda; quem tinha autenticador cadastrado via a tela de senha
// congelar com 200 no network e nenhuma navegação.
//
// O segundo teste fixa a pegadinha já documentada em packages/auth/client.ts:
// `verifyTotp` NÃO lança em código errado — devolve `{ error }`. O handler
// com try/catch registrava sucesso de MFA para código inválido.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  verifyTotp: vi.fn(),
  logLoginSuccess: vi.fn(),
  logLoginFailure: vi.fn(),
  logMfaVerified: vi.fn(),
  logMfaFailed: vi.fn(),
}));

vi.mock("../../../../packages/auth/client", () => ({
  authClient: {
    signIn: { email: h.signInEmail },
    twoFactor: { verifyTotp: h.verifyTotp },
  },
}));
vi.mock("../../../../packages/auth/auth-events", () => ({
  logLoginSuccess: h.logLoginSuccess,
  logLoginFailure: h.logLoginFailure,
  logMfaVerified: h.logMfaVerified,
  logMfaFailed: h.logMfaFailed,
}));

import { SignIn } from "../../../../packages/auth/components/sign-in";

async function preencherESubmeter() {
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: "vinicius@nebuloz.com" },
  });
  fireEvent.change(screen.getByLabelText(/senha/i), {
    target: { value: "senha-super-segura" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.logLoginSuccess.mockResolvedValue(undefined);
  h.logLoginFailure.mockResolvedValue(undefined);
  h.logMfaVerified.mockResolvedValue(undefined);
  h.logMfaFailed.mockResolvedValue(undefined);
});

describe("SignIn — conta com 2FA", () => {
  it("vai para o passo TOTP quando o servidor responde twoFactorRedirect", async () => {
    h.signInEmail.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ["totp"] },
      error: null,
    });

    render(<SignIn />);
    await preencherESubmeter();

    expect(await screen.findByText("Verificação em duas etapas")).toBeTruthy();
    // 2FA pendente não é login concluído: o evento de sucesso só depois do TOTP.
    expect(h.logLoginSuccess).not.toHaveBeenCalled();
  });

  it("mostra erro quando o código TOTP é recusado — verifyTotp devolve error, não lança", async () => {
    h.signInEmail.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });
    h.verifyTotp.mockResolvedValue({
      data: null,
      error: { message: "Invalid code", status: 401 },
    });

    render(<SignIn />);
    await preencherESubmeter();
    await screen.findByText("Verificação em duas etapas");

    fireEvent.change(screen.getByLabelText(/código do autenticador/i), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verificar/i }));

    expect(await screen.findByText(/código inválido/i)).toBeTruthy();
    expect(h.logMfaFailed).toHaveBeenCalled();
    expect(h.logMfaVerified).not.toHaveBeenCalled();
  });

  it("registra MFA verificado quando o código é aceito", async () => {
    h.signInEmail.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });
    h.verifyTotp.mockResolvedValue({ data: { token: "ok" }, error: null });

    render(<SignIn />);
    await preencherESubmeter();
    await screen.findByText("Verificação em duas etapas");

    fireEvent.change(screen.getByLabelText(/código do autenticador/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(h.logMfaVerified).toHaveBeenCalled());
    expect(h.logMfaFailed).not.toHaveBeenCalled();
  });
});

describe("SignIn — sem 2FA", () => {
  it("segue registrando o sucesso direto", async () => {
    h.signInEmail.mockResolvedValue({ data: { token: "ok" }, error: null });

    render(<SignIn />);
    await preencherESubmeter();

    await waitFor(() => expect(h.logLoginSuccess).toHaveBeenCalled());
    expect(screen.queryByText("Verificação em duas etapas")).toBeNull();
  });
});

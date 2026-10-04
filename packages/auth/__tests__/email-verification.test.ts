import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesma razão do server.test.ts: BETTER_AUTH_SECRET vem de `test.env` no
// vitest.config.mts, e os mocks abaixo são içados antes do import de server.ts.

const mocks = vi.hoisted(() => ({
  authConfig: undefined as Record<string, unknown> | undefined,
  renderVerificationEmail: vi.fn(),
  sendEmail: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("better-auth", () => ({
  betterAuth: (config: Record<string, unknown>) => {
    mocks.authConfig = config;
    return { api: {} };
  },
}));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => ({}) }));
vi.mock("better-auth/plugins", () => ({ twoFactor: () => ({}) }));
vi.mock("@repo/database", () => ({ database: {} }));
vi.mock("@repo/observability/log", () => ({
  log: { info: vi.fn(), error: mocks.logError },
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@repo/email", () => ({
  keys: () => ({ RESEND_FROM: "noreply@nebuloz.ai" }),
  resend: { emails: { send: mocks.sendEmail } },
  renderResetPasswordEmail: vi.fn(),
  renderVerificationEmail: mocks.renderVerificationEmail,
}));

import "../server";

type VerificationCfg = {
  sendVerificationEmail: (args: {
    user: { id: string; email: string; name?: string };
    url: string;
  }) => Promise<void>;
  sendOnSignUp?: boolean;
  sendOnSignIn?: boolean;
  autoSignInAfterVerification?: boolean;
};

function verificationCfg() {
  return mocks.authConfig?.emailVerification as VerificationCfg;
}

const USER = { id: "user-1", email: "quem@exemplo.com", name: "Quem" };
const VERIFY_URL =
  "https://app.nebuloz.ai/api/auth/verify-email?token=abc&callbackURL=%2Fonboarding";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.renderVerificationEmail.mockResolvedValue("<html>verify</html>");
  mocks.sendEmail.mockResolvedValue({ data: {}, error: null });
});

// Achado do Vigia (9, MÉDIO): o sign-up aberto criava sessão sem provar a
// posse do e-mail. Quem cadastrasse o e-mail de outra pessoa primeiro ficava
// dono da conta — e o convite confia no e-mail da sessão.
describe("configuração — e-mail verificado antes da sessão", () => {
  it("exige verificação de e-mail para entrar", () => {
    const emailCfg = mocks.authConfig?.emailAndPassword as {
      requireEmailVerification?: boolean;
    };
    expect(emailCfg.requireEmailVerification).toBe(true);
  });

  it("manda o link ao cadastrar e ao tentar entrar sem verificar", () => {
    expect(verificationCfg().sendOnSignUp).toBe(true);
    expect(verificationCfg().sendOnSignIn).toBe(true);
  });

  it("abre a sessão ao clicar no link (o callbackURL do convite e do onboarding continua valendo)", () => {
    expect(verificationCfg().autoSignInAfterVerification).toBe(true);
  });
});

describe("sendVerificationEmail", () => {
  it("renderiza o template com a URL de verificação e o nome do usuário", async () => {
    await verificationCfg().sendVerificationEmail({
      user: USER,
      url: VERIFY_URL,
    });

    expect(mocks.renderVerificationEmail).toHaveBeenCalledWith({
      userName: "Quem",
      verifyUrl: VERIFY_URL,
    });
  });

  it("envia pelo @repo/email pro endereço do usuário, com RESEND_FROM como remetente", async () => {
    await verificationCfg().sendVerificationEmail({
      user: USER,
      url: VERIFY_URL,
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining("noreply@nebuloz.ai"),
        to: USER.email,
        subject: expect.stringContaining("Confirme"),
        html: "<html>verify</html>",
      })
    );
  });

  it("não lança quando o envio falha — registra e segue", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("Resend indisponível"));

    await expect(
      verificationCfg().sendVerificationEmail({ user: USER, url: VERIFY_URL })
    ).resolves.toBeUndefined();
    expect(mocks.logError).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesma razão do server.test.ts: BETTER_AUTH_SECRET vem de `test.env` no
// vitest.config.mts, e os mocks abaixo são içados antes do import de server.ts.

const mocks = vi.hoisted(() => ({
  authConfig: undefined as Record<string, unknown> | undefined,
  renderResetPasswordEmail: vi.fn(),
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
  keys: () => ({ RESEND_FROM: "noreply@nebuloz.com" }),
  resend: { emails: { send: mocks.sendEmail } },
  renderResetPasswordEmail: mocks.renderResetPasswordEmail,
}));

import "../server";

function sendResetPassword() {
  const emailCfg = mocks.authConfig?.emailAndPassword as {
    sendResetPassword: (args: {
      user: { id: string; email: string; name?: string };
      url: string;
    }) => Promise<void>;
  };
  return emailCfg.sendResetPassword;
}

const USER = { id: "user-1", email: "quem@exemplo.com", name: "Quem" };
const RESET_URL = "https://app.nebuloz.ai/api/auth/reset-password/token123";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.renderResetPasswordEmail.mockResolvedValue("<html>reset</html>");
  mocks.sendEmail.mockResolvedValue({ data: {}, error: null });
});

describe("sendResetPassword (US4, FR-009)", () => {
  it("renderiza o template de redefinição com a URL e o nome do usuário", async () => {
    await sendResetPassword()({ user: USER, url: RESET_URL });

    expect(mocks.renderResetPasswordEmail).toHaveBeenCalledWith({
      userName: "Quem",
      resetUrl: RESET_URL,
    });
  });

  it("envia pelo @repo/email pro endereço do usuário, com RESEND_FROM como remetente", async () => {
    await sendResetPassword()({ user: USER, url: RESET_URL });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining("noreply@nebuloz.com"),
        to: USER.email,
        html: "<html>reset</html>",
      })
    );
  });

  it("não lança quando o envio falha — registra e segue (mesmo padrão do convite)", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("Resend indisponível"));

    await expect(
      sendResetPassword()({ user: USER, url: RESET_URL })
    ).resolves.toBeUndefined();
    expect(mocks.logError).toHaveBeenCalled();
  });
});

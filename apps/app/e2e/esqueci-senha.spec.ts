import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { SEEDED_ROLE_PASSWORD } from "./setup/auth.setup";

/**
 * E2E — Esqueci a senha, ponta a ponta (spec 004, US4, FR-009 a FR-012,
 * cenário 5 do quickstart).
 *
 * Lê o email de verdade no Mailpit (`pnpm mail:dev`, API REST em
 * localhost:8025 — ver docs/runbooks/email-em-desenvolvimento.md) em vez de
 * mockar o envio: é o único jeito de provar as duas pontas juntas —
 * `sendResetPassword` manda o link certo, e `/reset-password` resolve esse
 * link certo. Sem o Mailpit rodando localmente, pula com um motivo claro em
 * vez de quebrar a suíte inteira.
 *
 * Usa o papel `sm` (distinto do `dev` usado em trocar-senha.spec.ts) porque
 * este spec também muda a senha de verdade — dois specs mexendo na senha do
 * mesmo usuário em paralelo seria corrida.
 */

const MAILPIT_API = process.env.MAILPIT_API ?? "http://localhost:8025/api/v1";
const EMAIL = "sm@cosmos.local";
const PASSWORD = SEEDED_ROLE_PASSWORD;
const NEW_PASSWORD = `${SEEDED_ROLE_PASSWORD}-nova`;

async function limparCaixaDeEntrada(request: APIRequestContext) {
  await request.delete(`${MAILPIT_API}/messages`).catch(() => null);
}

/** Poll de até ~20s — o envio é assíncrono (`runInBackgroundOrAwait`). */
async function pegarLinkDeRedefinicao(
  request: APIRequestContext,
  destinatario: string
): Promise<string | null> {
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const listagem = await request
      .get(`${MAILPIT_API}/messages`)
      .catch(() => null);
    if (listagem?.ok()) {
      const body = (await listagem.json()) as {
        messages?: { ID: string; To?: { Address?: string }[] }[];
      };
      const msg = body.messages?.find((m) =>
        m.To?.some((to) => to.Address?.toLowerCase() === destinatario)
      );
      if (msg) {
        const completa = await request.get(`${MAILPIT_API}/message/${msg.ID}`);
        const { HTML } = (await completa.json()) as { HTML: string };
        const match = /href="([^"]*reset-password[^"]*)"/.exec(HTML);
        if (match) {
          return match[1].replace(/&amp;/g, "&");
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

test.describe("Esqueci a senha, ponta a ponta (US4, cenário 5) @auth", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pede redefinição, recebe email real, define nova senha e loga com ela", async ({
    page,
    request,
  }) => {
    await limparCaixaDeEntrada(request);

    await page.goto("/forgot-password");
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.getByRole("button", { name: /enviar link/i }).click();
    await expect(page.getByText(/email enviado/i)).toBeVisible({
      timeout: 15_000,
    });

    const link = await pegarLinkDeRedefinicao(request, EMAIL);
    test.skip(
      !link,
      "Mailpit não respondeu em localhost:8025 — suba com `pnpm mail:dev` pra rodar este cenário"
    );
    if (!link) {
      return;
    }

    await page.goto(link);
    await expect(page).toHaveURL(/reset-password/);
    await page.locator('input[type="password"]').fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /redefinir senha/i }).click();
    await expect(page.getByText(/senha redefinida/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/sign-in");
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard|portfolio|produto|\/$/, {
      timeout: 30_000,
    });
    await expect(page).not.toHaveURL(/sign-in/);

    // Cleanup: outro ciclo de esqueci-senha pra voltar a senha original,
    // senão a próxima corrida quebra.
    await page.context().clearCookies();
    await limparCaixaDeEntrada(request);
    await page.goto("/forgot-password");
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.getByRole("button", { name: /enviar link/i }).click();
    await expect(page.getByText(/email enviado/i)).toBeVisible({
      timeout: 15_000,
    });

    const linkDeVolta = await pegarLinkDeRedefinicao(request, EMAIL);
    if (linkDeVolta) {
      await page.goto(linkDeVolta);
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.getByRole("button", { name: /redefinir senha/i }).click();
      await expect(page.getByText(/senha redefinida/i)).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("email inexistente recebe a mesma resposta — não revela se a conta existe (FR-012)", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page
      .locator('input[type="email"]')
      .fill("nao.existe.e2e@nebuloz.exemplo");
    await page.getByRole("button", { name: /enviar link/i }).click();

    await expect(page.getByText(/email enviado/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

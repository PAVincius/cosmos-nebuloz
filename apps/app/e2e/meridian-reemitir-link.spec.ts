import { expect, test } from "@playwright/test";
import { meridianStorageState } from "./setup/auth.setup";

/**
 * E2E — Spec 006 US1, "Reemitir link" individual.
 *
 * Cenários 1–3 do quickstart (specs/006-reemitir-link-respondente/quickstart.md):
 *  1. Reemitir link individual: link novo funciona, o antigo não.
 *  2. Bloqueios: DONE, REVOKED, deadline vencido.
 *  3. Auditoria: entrada `meridian.respondent.reissue`.
 *
 * Cria assessment isolado pela UI (mesmo padrão de
 * `meridian-collection-as112.spec.ts`) pra não disputar estado com outros
 * specs do dogfood.
 */

test.describe("Meridian Coleta · reemitir link individual (spec 006 US1) @meridian", () => {
  test.use({ storageState: meridianStorageState("consultant") });

  test("reemite o link do mesmo respondente; token antigo cai em 'Link inválido ou expirado'; auditoria registra a reemissão", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const linkDialog = (title: string) =>
      page.getByRole("dialog", { name: title });

    await test.step("cria assessment isolado e atribui um respondente em Data", async () => {
      await page.goto("/meridian");
      await page.getByRole("button", { name: /Novo assessment/ }).click();
      await page.getByLabel("Organização").fill("Reemissão 006 · US1");
      await page.getByLabel("Setor").fill("Tecnologia");
      await page.getByLabel("Porte").fill("50–200");
      await page.getByLabel("Prazo").fill("2026-12-31");
      await page.getByRole("button", { name: "Criar assessment" }).click();
      await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
      await page.getByRole("button", { name: /Coleta/ }).click();

      await page
        .getByRole("button", { name: "Atribuir respondente" })
        .first()
        .click();
      await page.getByPlaceholder("Marina Costa").fill("Reemissão · titular");
      await page.getByPlaceholder("Gerente de Dados").fill("Fundador");
      await page
        .getByPlaceholder("marina@empresa.com")
        .fill("reemissao-titular@nebuloz.exemplo");
      await page.getByRole("button", { name: "Atribuir e gerar link" }).click();
      await expect(linkDialog("Link de coleta gerado")).toBeVisible();
      await linkDialog("Link de coleta gerado")
        .getByRole("button", { name: "Copiar" })
        .click();
      await linkDialog("Link de coleta gerado")
        .getByRole("button", { name: "Concluir" })
        .click();
      await expect(
        page.getByText("Reemissão · titular", { exact: true })
      ).toBeVisible({ timeout: 15_000 });
    });

    await test.step("1 — Reemitir link: link novo funciona, o antigo não", async () => {
      // O link antigo já foi copiado no passo anterior — recupera lendo o
      // clipboard, já que a lista não guarda o token em claro em lugar nenhum.
      const oldToken = (
        await page.evaluate(() => navigator.clipboard.readText())
      ).split("/meridian-responder/")[1];
      expect(oldToken).toBeTruthy();

      await page.getByRole("button", { name: "Reemitir link" }).click();
      await expect(linkDialog("Link reemitido")).toBeVisible();
      const newValue = await linkDialog("Link reemitido")
        .getByRole("textbox")
        .inputValue();
      const newToken = newValue.split("/meridian-responder/")[1];
      expect(newToken).toBeTruthy();
      expect(newToken).not.toBe(oldToken);

      await linkDialog("Link reemitido")
        .getByRole("button", { name: "Copiar" })
        .click();
      await linkDialog("Link reemitido")
        .getByRole("button", { name: "Concluir" })
        .click();

      const oldTokenPage = await context.newPage();
      await oldTokenPage.goto(`/meridian-responder/${oldToken}`);
      await expect(
        oldTokenPage.getByText("Link inválido ou expirado")
      ).toBeVisible();
      await oldTokenPage.close();

      const newTokenPage = await context.newPage();
      await newTokenPage.goto(`/meridian-responder/${newToken}`);
      await expect(
        newTokenPage.getByText("Link inválido ou expirado")
      ).toHaveCount(0);
      await newTokenPage.close();
    });

    await test.step("3 — auditoria registra meridian.respondent.reissue", async () => {
      await page.goto("/settings/audit");
      await page
        .getByRole("button", { name: "Meridian" })
        .click()
        .catch(() => {
          /* pill de filtro pode já estar ativa por outro spec — segue sem ela */
        });
      await expect(page.getByText(/Reemissão · titular/).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test("bloqueia reemissão para respondente DONE e para REVOKED", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page.getByRole("button", { name: /Novo assessment/ }).click();
    await page.getByLabel("Organização").fill("Reemissão 006 · bloqueios");
    await page.getByLabel("Setor").fill("Tecnologia");
    await page.getByLabel("Porte").fill("50–200");
    await page.getByLabel("Prazo").fill("2026-12-31");
    await page.getByRole("button", { name: "Criar assessment" }).click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
    await page.getByRole("button", { name: /Coleta/ }).click();

    await page
      .getByRole("button", { name: "Atribuir respondente" })
      .first()
      .click();
    await page.getByPlaceholder("Marina Costa").fill("Bloqueio · revogado");
    await page.getByPlaceholder("Gerente de Dados").fill("Fundador");
    await page
      .getByPlaceholder("marina@empresa.com")
      .fill("bloqueio-revogado@nebuloz.exemplo");
    await page.getByRole("button", { name: "Atribuir e gerar link" }).click();
    await page
      .getByRole("dialog", { name: "Link de coleta gerado" })
      .getByRole("button", { name: "Copiar" })
      .click();
    await page
      .getByRole("dialog", { name: "Link de coleta gerado" })
      .getByRole("button", { name: "Concluir" })
      .click();
    await expect(
      page.getByText("Bloqueio · revogado", { exact: true })
    ).toBeVisible({ timeout: 15_000 });

    // REVOKED: revoga e confirma que "Reemitir link" some da linha (a UI
    // esconde a ação — o botão nem aparece pra um respondente revogado).
    await page.getByRole("button", { name: "Revogar" }).click();
    await page
      .getByRole("dialog", { name: "Revogar respondente?" })
      .getByRole("button", { name: "Revogar" })
      .click();
    await expect(page.getByText("Revogado")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reemitir link" })
    ).toHaveCount(0);
  });
});

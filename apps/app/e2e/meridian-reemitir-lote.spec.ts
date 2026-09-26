import { expect, test } from "@playwright/test";
import { meridianStorageState } from "./setup/auth.setup";

/**
 * E2E — Spec 006 US2, "Reemitir e copiar todos os pendentes".
 *
 * Cenários 4–5 do quickstart (specs/006-reemitir-link-respondente/quickstart.md):
 *  4. Lote com pendentes: lista completa, copiar tudo, baixar arquivo.
 *  5. Lote sem pendentes: mensagem informativa, sem lista vazia como sucesso.
 */

test.describe("Meridian Coleta · reemitir em lote (spec 006 US2) @meridian", () => {
  test.use({ storageState: meridianStorageState("consultant") });

  test("reemite os pendentes de uma vez; lista completa; copiar tudo; baixar .txt", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const oldTokenByLabel: Record<string, string> = {};

    await test.step("cria assessment e atribui dois respondentes pendentes", async () => {
      await page.goto("/meridian");
      await page.getByRole("button", { name: /Novo assessment/ }).click();
      await page.getByLabel("Organização").fill("Reemissão 006 · lote");
      await page.getByLabel("Setor").fill("Tecnologia");
      await page.getByLabel("Porte").fill("50–200");
      await page.getByLabel("Prazo").fill("2026-12-31");
      await page.getByRole("button", { name: "Criar assessment" }).click();
      await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
      await page.getByRole("button", { name: /Coleta/ }).click();

      for (const [i, label] of ["Data", "Process"].entries()) {
        await page
          .getByRole("button", { name: "Atribuir respondente" })
          .nth(i)
          .click();
        await page.getByPlaceholder("Marina Costa").fill(`Lote · ${label}`);
        await page.getByPlaceholder("Gerente de Dados").fill("Fundador");
        await page
          .getByPlaceholder("marina@empresa.com")
          .fill(`lote-${label.toLowerCase()}@nebuloz.exemplo`);
        await page
          .getByRole("button", { name: "Atribuir e gerar link" })
          .click();
        const dialog = page.getByRole("dialog", {
          name: "Link de coleta gerado",
        });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Copiar" }).click();
        // Lê o clipboard AGORA, antes do próximo respondente do loop
        // sobrescrever — é o único jeito de saber qual token era de qual
        // respondente depois que os dois modais já fecharam.
        oldTokenByLabel[label] = (
          await page.evaluate(() => navigator.clipboard.readText())
        ).split("/meridian-responder/")[1];
        await dialog.getByRole("button", { name: "Concluir" }).click();
        await expect(
          page.getByText(`Lote · ${label}`, { exact: true })
        ).toBeVisible({ timeout: 15_000 });
      }
    });

    await test.step("4 — reemitir em lote: lista completa, copiar tudo, baixar .txt", async () => {
      await page
        .getByRole("button", { name: "Reemitir e copiar todos os pendentes" })
        .click();

      const listDialog = page.getByRole("dialog", { name: "Links reemitidos" });
      await expect(listDialog).toBeVisible();
      await expect(listDialog.getByText("Lote · Data")).toBeVisible();
      await expect(listDialog.getByText("Lote · Process")).toBeVisible();

      const concluirButton = listDialog.getByRole("button", {
        name: "Concluir",
      });
      await expect(concluirButton).toBeDisabled();

      await listDialog.getByRole("button", { name: "Copiar tudo" }).click();
      await expect(concluirButton).toBeEnabled();
      const clipboard = await page.evaluate(() =>
        navigator.clipboard.readText()
      );
      expect(clipboard).toContain("Lote · Data");
      expect(clipboard).toContain("Lote · Process");
      expect(clipboard.split("\n")).toHaveLength(2);

      const downloadPromise = page.waitForEvent("download");
      await listDialog.getByRole("button", { name: "Baixar .txt" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.txt$/);

      await concluirButton.click();
    });

    await test.step("token antigo de Data cai em 'Link inválido ou expirado' após a reemissão em lote", async () => {
      expect(oldTokenByLabel.Data).toBeTruthy();
      const oldTokenPage = await context.newPage();
      await oldTokenPage.goto(`/meridian-responder/${oldTokenByLabel.Data}`);
      await expect(
        oldTokenPage.getByText("Link inválido ou expirado")
      ).toBeVisible();
      await oldTokenPage.close();
    });
  });

  test("5 — sem nenhum pendente, informa e não abre lista vazia como sucesso", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page.getByRole("button", { name: /Novo assessment/ }).click();
    await page.getByLabel("Organização").fill("Reemissão 006 · sem pendente");
    await page.getByLabel("Setor").fill("Tecnologia");
    await page.getByLabel("Porte").fill("50–200");
    await page.getByLabel("Prazo").fill("2026-12-31");
    await page.getByRole("button", { name: "Criar assessment" }).click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
    await page.getByRole("button", { name: /Coleta/ }).click();

    // Assessment recém-criado, sem nenhum respondente atribuído ainda —
    // não há INVITED/PENDING/OVERDUE nenhum.
    await page
      .getByRole("button", { name: "Reemitir e copiar todos os pendentes" })
      .click();
    await expect(
      page.getByText(/Nenhum respondente pendente pra reemitir/)
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("dialog", { name: "Links reemitidos" })
    ).toHaveCount(0);
  });
});

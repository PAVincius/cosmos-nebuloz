import { expect, test } from "@playwright/test";
import { meridianStorageState } from "./setup/auth.setup";

/**
 * E2E — Spec 006 US2, "Reemitir e copiar todos os pendentes".
 *
 * Cenários 4–5 do quickstart (specs/006-reemitir-link-respondente/quickstart.md):
 *  4. Lote com pendentes: lista completa, copiar tudo, baixar arquivo.
 *  5. Lote sem pendentes: mensagem informativa, sem lista vazia como sucesso.
 *
 * Cenários 6–7, achados do Vigia (9df4937b, 0a288459) — gate de segurança
 * antes do PR, não fazem parte do quickstart original:
 *  6. Nome com fórmula CSV (item 1 ALTO): célula do .csv baixado sai com
 *     apóstrofo na frente, não vira fórmula no Excel/Sheets.
 *  7. Nome com quebra de linha (item 2 MÉDIO): NÃO dá pra provar via UI —
 *     `<input>` nativo sanitiza \r/\n em qualquer escrita do value (digitada
 *     ou por script), então nunca chega quebra de linha no servidor por essa
 *     via. O teste 7 documenta/prova essa sanitização; a rejeição do
 *     AssignSchema (0a288459) é coberta no nível certo por
 *     `__tests__/meridian/collection.test.ts`.
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

  test("6 — nome com fórmula CSV: célula do .csv baixado sai com apóstrofo na frente (Vigia item 1)", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/meridian");
    await page.getByRole("button", { name: /Novo assessment/ }).click();
    await page.getByLabel("Organização").fill("Reemissão 006 · CSV injection");
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
    await page.getByPlaceholder("Marina Costa").fill('=HYPERLINK("x")');
    await page.getByPlaceholder("Gerente de Dados").fill("Fundador");
    await page
      .getByPlaceholder("marina@empresa.com")
      .fill("csv-injection@nebuloz.exemplo");
    await page.getByRole("button", { name: "Atribuir e gerar link" }).click();
    const assignDialog = page.getByRole("dialog", {
      name: "Link de coleta gerado",
    });
    await expect(assignDialog).toBeVisible();
    await assignDialog.getByRole("button", { name: "Copiar" }).click();
    await assignDialog.getByRole("button", { name: "Concluir" }).click();

    await page
      .getByRole("button", { name: "Reemitir e copiar todos os pendentes" })
      .click();
    const listDialog = page.getByRole("dialog", { name: "Links reemitidos" });
    await expect(listDialog).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await listDialog.getByRole("button", { name: "Baixar .csv" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const csv = Buffer.concat(chunks).toString("utf-8");

    // csvTextField (tab-coleta.tsx) prefixa apóstrofo em campo que
    // começaria com =/+/-/@/TAB — sem isso o Excel/Sheets abre a célula
    // como fórmula (Vigia, item 1 ALTO; fix 9df4937b).
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
  });

  test("7 — nota: input nativo já barra quebra de linha antes do servidor entrar em jogo (Vigia item 2)", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page.getByRole("button", { name: /Novo assessment/ }).click();
    await page
      .getByLabel("Organização")
      .fill("Reemissão 006 · quebra de linha");
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

    // Tentativa deliberada de forçar \n no value via setter nativo (o mesmo
    // usado por .fill() e por um paste real) — não é `.fill()` porque
    // queremos provar que NEM o script consegue, não só o teclado.
    const nameInput = page.getByPlaceholder("Marina Costa");
    await nameInput.click();
    await nameInput.evaluate((el, val) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, "Fulano\nInjetado");

    // O "value sanitization algorithm" do HTML tira \r/\n de todo
    // <input type="text"> em QUALQUER escrita do value — digitada, colada
    // ou por script (mesmo setter nativo usado acima) — antes que o React
    // veja o valor. Não existe caminho de UI real pra fazer \n chegar no
    // AssignSchema; singleLineStr (0a288459) é defesa pra quem manda a
    // mutação direto pro server action (curl, script), não pra este modal.
    // Coberto no nível certo por `__tests__/meridian/collection.test.ts`
    // (mesma razão do bloqueio DONE documentado no topo de
    // meridian-reemitir-link.spec.ts: não dá pra chegar por interação real).
    await expect(nameInput).toHaveValue("FulanoInjetado");
  });
});

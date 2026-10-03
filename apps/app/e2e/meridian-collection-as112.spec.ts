import { expect, test } from "@playwright/test";
import { meridianStorageState } from "./setup/auth.setup";

/**
 * E2E — Meridian Coleta, atrito AS-112 (docs/qualidade/, achado da Morgana
 * no M2 do dogfood em produção: CEO atribuiu 10 respondentes e não copiou
 * nenhum link — coleta travou, sem forma de revogar).
 *
 * Cobre os quatro itens do fix (28d72cfd + 5fad9132) que
 * `meridian-dogfood.spec.ts` não exercita (aquele spec só atribui e clica
 * "Concluir" depois de copiar — nunca sai sem copiar, nunca revoga):
 *
 *  1. Esc / X / backdrop sem copiar pedem confirmação — nada fecha direto.
 *  2. Copiar libera "Concluir"; o link no clipboard é o mesmo do input.
 *  3. Revogar respondente: confirmação, riscado, eixo volta a "sem dono",
 *     reatribuir gera link novo, o link antigo abre como inválido.
 *  4. `closeCollection` ignora respondente REVOKED — atribui os cinco eixos,
 *     revoga só o de Data (os outros quatro seguem cobertos) e confere que
 *     o fechamento ainda bloqueia por causa dele; reatribuir libera o
 *     fechamento.
 *
 * Cria um assessment próprio pela UI (não usa o AS-200 do seed) para não
 * disputar estado com `meridian-dogfood.spec.ts` — mesmo padrão de
 * isolamento que M1 do dogfood já usa (organização nova por rodada).
 */

const AXIS_LABELS = [
  "Data",
  "Process",
  "People",
  "Governance",
  "Infrastructure",
] as const;

test.describe("Meridian Coleta · atrito AS-112 (X/Esc/backdrop, revogar, closeCollection) @meridian", () => {
  test.use({ storageState: meridianStorageState("consultant") });

  test("saídas do modal sem copiar pedem confirmação; copiar libera Concluir; revogar/reatribuir/link antigo inválido; closeCollection ignora REVOKED", async ({
    page,
    context,
  }) => {
    let dataToken = "";

    const linkDialog = () =>
      page.getByRole("dialog", { name: "Link de coleta gerado" });

    /** Abre "Atribuir respondente" no eixo de índice `i` (ordem de
     *  AXIS_LABELS) e preenche o formulário — não copia nem conclui. */
    const openAssignForm = async (i: number, name: string, email: string) => {
      await page
        .getByRole("button", { name: "Atribuir respondente" })
        .nth(i)
        .click();
      await page.getByPlaceholder("Marina Costa").fill(name);
      await page.getByPlaceholder("Gerente de Dados").fill("Fundador");
      await page.getByPlaceholder("marina@empresa.com").fill(email);
      await page.getByRole("button", { name: "Atribuir e gerar link" }).click();
      await expect(linkDialog()).toBeVisible();
    };

    /** Copia o link visível e fecha via "Concluir". Devolve o token. */
    const copyAndFinish = async () => {
      const value = await linkDialog().getByRole("textbox").inputValue();
      const token = value.split("#t=")[1];
      expect(token).toBeTruthy();
      await linkDialog().getByRole("button", { name: "Copiar" }).click();
      await linkDialog().getByRole("button", { name: "Concluir" }).click();
      return token;
    };

    await test.step("cria assessment isolado pela carteira", async () => {
      await page.goto("/meridian");
      await page.getByRole("button", { name: /Novo assessment/ }).click();
      await page.getByLabel("Organização").fill("AS-112 Regressão");
      await page.getByLabel("Setor").fill("Tecnologia");
      await page.getByLabel("Porte").fill("50–200");
      await page.getByLabel("Prazo").fill("2026-12-31");
      await page.getByRole("button", { name: "Criar assessment" }).click();
      await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
      await page.getByRole("button", { name: /Coleta/ }).click();
    });

    await test.step("1 — Esc / X / backdrop sem copiar pedem confirmação; nada fecha direto", async () => {
      await openAssignForm(
        0,
        "Regressão AS-112 · titular",
        "as112-titular@nebuloz.exemplo"
      );

      await page.keyboard.press("Escape");
      await expect(page.getByText("Fechar sem copiar o link?")).toBeVisible();
      await expect(linkDialog()).toBeVisible();
      await page.getByRole("button", { name: "Voltar e copiar" }).click();
      await expect(page.getByText("Fechar sem copiar o link?")).toHaveCount(0);
      await expect(linkDialog()).toBeVisible();

      await linkDialog().getByRole("button", { name: "Fechar" }).click();
      await expect(page.getByText("Fechar sem copiar o link?")).toBeVisible();
      await page.getByRole("button", { name: "Voltar e copiar" }).click();
      await expect(linkDialog()).toBeVisible();

      // Backdrop passa pelo `dirty` genérico do ModalHost, não pelo texto
      // próprio deste modal — o alerta é "Descartar alterações?". O botão de
      // backdrop cobre a viewport inteira (position:fixed, inset:0) atrás do
      // card centralizado — o ponto padrão de clique do Playwright (centro
      // do elemento) cai exatamente sobre o card, que intercepta; um clique
      // real do consultor mira fora do card, então miramos um canto.
      // Canto inferior esquerdo: o superior fica sob a faixa "AMBIENTE LOCAL"
      // (fixed, z 9999), que interceptaria o clique.
      const backdrop = page.getByRole("button", { name: "Fechar modal" });
      const backdropBox = await backdrop.boundingBox();
      await backdrop.click({
        position: { x: 10, y: (backdropBox?.height ?? 100) - 10 },
      });
      await expect(page.getByText("Descartar alterações?")).toBeVisible();
      await page.getByRole("button", { name: "Continuar editando" }).click();
      await expect(linkDialog()).toBeVisible();
    });

    await test.step("2 — copiar libera Concluir; clipboard tem o mesmo link do input", async () => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const value = await linkDialog().getByRole("textbox").inputValue();
      dataToken = value.split("#t=")[1];
      expect(dataToken).toBeTruthy();

      const concluirButton = linkDialog().getByRole("button", {
        name: "Concluir",
      });
      await expect(concluirButton).toBeDisabled();
      await linkDialog().getByRole("button", { name: "Copiar" }).click();
      await expect(concluirButton).toBeEnabled();
      const clipboard = await page.evaluate(() =>
        navigator.clipboard.readText()
      );
      expect(clipboard).toContain(`/meridian-responder#t=${dataToken}`);
      await concluirButton.click();
      await expect(
        page.getByText("Regressão AS-112 · titular", { exact: true })
      ).toBeVisible({ timeout: 15_000 });
    });

    await test.step("atribui os quatro eixos restantes (Process/People/Governance/Infrastructure)", async () => {
      for (let i = 1; i < AXIS_LABELS.length; i++) {
        const label = AXIS_LABELS[i];
        await openAssignForm(
          i,
          `Regressão AS-112 · ${label}`,
          `as112-${label.toLowerCase()}@nebuloz.exemplo`
        );
        await copyAndFinish();
        await expect(
          page.getByText(`Regressão AS-112 · ${label}`, { exact: true })
        ).toBeVisible({ timeout: 15_000 });
      }
      await expect(page.getByText("sem dono")).toHaveCount(0);
    });

    await test.step("3 — revogar pede confirmação, risca o nome, eixo Data volta a 'sem dono'", async () => {
      // Todos os cinco eixos têm dono ativo até aqui — só o de Data (o
      // primeiro atribuído) tem o botão "Revogar" que nos interessa; como é
      // o único ainda sem revogado nenhum na tela, `first()` é o de Data.
      await page.getByRole("button", { name: "Revogar" }).first().click();

      const revokeDialog = page.getByRole("dialog", {
        name: "Revogar respondente?",
      });
      await expect(revokeDialog).toBeVisible();
      await revokeDialog.getByRole("button", { name: "Revogar" }).click();

      await expect(page.getByText("Revogado")).toBeVisible();
      await expect(
        page.getByText("Regressão AS-112 · titular", { exact: true })
      ).toHaveCSS("text-decoration-line", "line-through");
      // Único eixo sem dono agora é o de Data — os outros quatro seguem
      // cobertos. Duas ocorrências de "sem dono" pra esse único eixo: a
      // etiqueta ao lado do nome do eixo e o banner de progresso
      // ("Data sem dono — atribua antes de fechar a coleta.").
      await expect(page.getByText("sem dono")).toHaveCount(2);
      await expect(
        page.getByText(/Data sem dono — atribua antes de fechar a coleta\./)
      ).toBeVisible();
    });

    await test.step("4 — closeCollection ignora REVOKED: eixo revogado ainda bloqueia mesmo com os outros quatro cobertos", async () => {
      await page
        .getByRole("button", { name: "Fechar coleta e rodar scoring" })
        .click();
      // `toActionError` (app/actions/_base.ts:65-75) só devolve `error.message`
      // — os `blockers` (eixos específicos) do StateConflictError não chegam
      // ao toast. A prova de que o REVOKED não conta como cobertura está em o
      // fechamento falhar mesmo com Process/People/Governance/Infrastructure
      // cobertos — só sobra Data, e Data só tem um respondente REVOKED.
      await expect(
        page.getByText(
          "Há eixo sem respondente — o assessment não fecha coleta assim."
        )
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/scoring executado/)).toHaveCount(0);
    });

    await test.step("3 — reatribuir Data gera link novo; token antigo cai em 'Link inválido ou expirado'; fechamento libera", async () => {
      await openAssignForm(
        0,
        "Regressão AS-112 · titular 2",
        "as112-titular-2@nebuloz.exemplo"
      );
      const secondToken = await copyAndFinish();
      expect(secondToken).not.toBe(dataToken);
      await expect(page.getByText("sem dono")).toHaveCount(0);

      const oldTokenPage = await context.newPage();
      await oldTokenPage.goto(`/meridian-responder#t=${dataToken}`);
      await expect(
        oldTokenPage.getByText("Link inválido ou expirado")
      ).toBeVisible();
      await oldTokenPage.close();

      await page
        .getByRole("button", { name: "Fechar coleta e rodar scoring" })
        .click();
      // Ninguém respondeu bateria nenhuma neste assessment novo — todas as
      // respostas ficam pendentes (FR-012 aceita isso), então a mensagem de
      // sucesso é a de "resposta(s) pendente(s)", não a de "scoring
      // executado" (essa só aparece com `pendingResponses === 0`).
      await expect(
        page.getByText(/Coleta fechada com \d+ resposta\(s\) pendente\(s\)/)
      ).toBeVisible({
        timeout: 30_000,
      });
    });
  });
});

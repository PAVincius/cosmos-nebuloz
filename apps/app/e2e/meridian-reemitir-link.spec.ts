import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { meridianStorageState } from "./setup/auth.setup";

dotenv.config({ path: ".env.local" });

/**
 * E2E — Spec 006 US1, "Reemitir link" individual.
 *
 * Cenários 1–3 do quickstart (specs/006-reemitir-link-respondente/quickstart.md):
 *  1. Reemitir link individual: link novo funciona, o antigo não, rascunho
 *     preservado (mesmo respondentId, só o tokenHash gira).
 *  2. Bloqueios: DONE (server-side, `__tests__/meridian/collection.test.ts` —
 *     a UI esconde "Reemitir link" pra DONE por desenho, então não há como
 *     chegar nesse bloqueio por interação real; ver nota no teste de
 *     bloqueios abaixo), REVOKED (E2E, botão some da linha).
 *  3. Auditoria: entrada `meridian.respondent.reissue`.
 *  4. `tokenExpiresAt` = min(agora + 14d, deadline), conferido direto no
 *     Postgres local — não só no mock do unitário.
 *  5. Saídas do modal "Link reemitido" sem copiar pedem confirmação — mesma
 *     guarda X/Esc/backdrop de `5fad9132`/`meridian-collection-as112.spec.ts`,
 *     reusada via `useCloseGuard` (f771b865).
 *
 * Cria assessment isolado pela UI (mesmo padrão de
 * `meridian-collection-as112.spec.ts`) pra não disputar estado com outros
 * specs do dogfood.
 */

/** Lê `tokenExpiresAt` e o `deadline` do assessment direto no Postgres local
 *  — mesmo padrão de acesso direto ao banco de `meridian-dogfood.spec.ts`
 *  (`attachEvidenceToContestedAxis`), evitando expor o campo na UI só pra
 *  este teste. */
async function readTokenExpiryFromDb(respondentName: string): Promise<{
  tokenExpiresAt: Date;
  deadline: Date;
}> {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const { PrismaClient } = await import(
    "../../../packages/database/generated/index.js"
  );

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const respondent = await db.meridianRespondent.findFirst({
    where: { name: respondentName },
    select: {
      tokenExpiresAt: true,
      assessment: { select: { deadline: true } },
    },
  });
  await db.$disconnect();
  if (!respondent) {
    throw new Error(
      `readTokenExpiryFromDb: respondente "${respondentName}" não encontrado.`
    );
  }
  return {
    tokenExpiresAt: respondent.tokenExpiresAt,
    deadline: respondent.assessment.deadline,
  };
}

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

    let oldToken = "";

    await test.step("rascunho: responde 1 pergunta no link original e salva pra continuar depois", async () => {
      oldToken = (
        await page.evaluate(() => navigator.clipboard.readText())
      ).split("#t=")[1];
      expect(oldToken).toBeTruthy();

      const respondentPage = await context.newPage();
      await respondentPage.goto(`/meridian-responder#t=${oldToken}`);
      await respondentPage
        .getByRole("button", { name: "Discordo forte", exact: true })
        .first()
        .click();
      await respondentPage
        .getByRole("button", { name: "Salvar e continuar depois" })
        .click();
      await expect(respondentPage.getByText(/Rascunho salvo/)).toBeVisible();
      await respondentPage.close();
    });

    let antesDoClique = 0;
    let depoisDoClique = 0;

    await test.step("1 — Reemitir link: saídas do modal sem copiar pedem confirmação; link novo funciona com o rascunho preservado, o antigo não", async () => {
      antesDoClique = Date.now();
      await page.getByRole("button", { name: "Reemitir link" }).click();
      await expect(linkDialog("Link reemitido")).toBeVisible();
      depoisDoClique = Date.now();

      // Mesma guarda X/Esc/backdrop de 5fad9132/AS-112 (useCloseGuard,
      // f771b865) — Esc e X abrem a confirmação PRÓPRIA deste modal
      // ("Fechar sem copiar o link?"); o backdrop passa pelo dirty genérico
      // do ModalHost ("Descartar alterações?").
      await page.keyboard.press("Escape");
      await expect(page.getByText("Fechar sem copiar o link?")).toBeVisible();
      await expect(linkDialog("Link reemitido")).toBeVisible();
      await page.getByRole("button", { name: "Voltar e copiar" }).click();
      await expect(page.getByText("Fechar sem copiar o link?")).toHaveCount(0);

      await linkDialog("Link reemitido")
        .getByRole("button", { name: "Fechar" })
        .click();
      await expect(page.getByText("Fechar sem copiar o link?")).toBeVisible();
      await page.getByRole("button", { name: "Voltar e copiar" }).click();
      await expect(linkDialog("Link reemitido")).toBeVisible();

      // Canto inferior esquerdo: o superior fica sob a faixa "AMBIENTE LOCAL"
      // (fixed, z 9999), que interceptaria o clique.
      const backdrop = page.getByRole("button", { name: "Fechar modal" });
      const backdropBox = await backdrop.boundingBox();
      await backdrop.click({
        position: { x: 10, y: (backdropBox?.height ?? 100) - 10 },
      });
      await expect(page.getByText("Descartar alterações?")).toBeVisible();
      await page.getByRole("button", { name: "Continuar editando" }).click();
      await expect(linkDialog("Link reemitido")).toBeVisible();

      const newValue = await linkDialog("Link reemitido")
        .getByRole("textbox")
        .inputValue();
      const newToken = newValue.split("#t=")[1];
      expect(newToken).toBeTruthy();
      expect(newToken).not.toBe(oldToken);

      await linkDialog("Link reemitido")
        .getByRole("button", { name: "Copiar" })
        .click();
      await linkDialog("Link reemitido")
        .getByRole("button", { name: "Concluir" })
        .click();

      const oldTokenPage = await context.newPage();
      await oldTokenPage.goto(`/meridian-responder#t=${oldToken}`);
      await expect(
        oldTokenPage.getByText("Link inválido ou expirado")
      ).toBeVisible();
      await oldTokenPage.close();

      const newTokenPage = await context.newPage();
      await newTokenPage.goto(`/meridian-responder#t=${newToken}`);
      await expect(
        newTokenPage.getByText("Link inválido ou expirado")
      ).toHaveCount(0);
      // Rascunho preservado: reemitir gira só o tokenHash, o respondentId (e
      // as respostas já salvas) continuam os mesmos — `getBattery` carrega
      // por respondentId, não por token (actions/respondent.ts:128-129).
      await expect(
        newTokenPage
          .getByRole("button", {
            name: "Discordo forte",
            exact: true,
          })
          .first()
      ).toHaveAttribute("aria-pressed", "true");
      await newTokenPage.close();
    });

    await test.step("4 — tokenExpiresAt = min(agora + 14d, deadline), conferido no Postgres local", async () => {
      const { tokenExpiresAt, deadline } = await readTokenExpiryFromDb(
        "Reemissão · titular"
      );
      const REEMISSAO_TTL_MS = 14 * 24 * 60 * 60 * 1000;
      // Janela [antes+14d, depois+14d] em vez de um alvo fixo com tolerância
      // de relógio: "antes"/"depois" cercam só a chamada de servidor do
      // clique (linha ~135), não os passos de X/Esc/backdrop, cópia e as
      // duas abas do respondente que vêm depois — e não estoura com
      // cold-compile do dev server numa rota ainda não visitada.
      const tetoMin = antesDoClique + REEMISSAO_TTL_MS;
      const tetoMax = depoisDoClique + REEMISSAO_TTL_MS;
      expect(deadline.getTime()).toBeGreaterThan(tetoMax);
      expect(tokenExpiresAt.getTime()).toBeGreaterThanOrEqual(tetoMin);
      expect(tokenExpiresAt.getTime()).toBeLessThanOrEqual(tetoMax);
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

  test("bloqueia reemissão para respondente REVOKED (botão some da linha)", async ({
    page,
    context,
  }) => {
    // DONE não dá pra exercitar por interação real: a UI esconde "Reemitir
    // link" pra DONE por desenho (tab-coleta.tsx, mesma condição de
    // "Lembrar"), então não existe caminho de clique que chegue no bloqueio
    // server-side. Coberto em __tests__/meridian/collection.test.ts
    // ("bloqueia reemissão para respondente DONE").
    //
    // Sem `grantPermissions`, `navigator.clipboard.writeText` rejeita, e
    // "Concluir" fica desabilitado pra sempre (só libera com `copied`) —
    // travava o teste antes mesmo de chegar no que importa aqui (revogar).
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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
    // Nome sem a palavra "revogado" de propósito — getByText é
    // case-insensitive por padrão, e um nome que contivesse "revogado"
    // faria a asserção do StatusDot mais abaixo casar com o próprio nome
    // e com os toasts, não só com o rótulo de status.
    await page.getByPlaceholder("Marina Costa").fill("Bloqueio · alvo");
    await page.getByPlaceholder("Gerente de Dados").fill("Fundador");
    await page
      .getByPlaceholder("marina@empresa.com")
      .fill("bloqueio-alvo@nebuloz.exemplo");
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
      page.getByText("Bloqueio · alvo", { exact: true })
    ).toBeVisible({ timeout: 15_000 });

    // REVOKED: revoga e confirma que "Reemitir link" some da linha (a UI
    // esconde a ação — o botão nem aparece pra um respondente revogado).
    await page.getByRole("button", { name: "Revogar" }).click();
    await page
      .getByRole("dialog", { name: "Revogar respondente?" })
      .getByRole("button", { name: "Revogar" })
      .click();
    await expect(page.getByText("Revogado", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reemitir link" })
    ).toHaveCount(0);
  });
});

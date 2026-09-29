import { type Browser, expect, type Page, test } from "@playwright/test";
import { roleStorageState } from "./setup/auth.setup";

/**
 * E2E — Scaffold: ciclo de vida da trilha pela tela (T124, S7).
 *
 * Uma trilha do catálogo, criada aqui, percorre a Fase 1 e a Fase 2 sem atalho
 * por SQL: entregáveis até Aprovado (com arquivo), caso de negócio escrito,
 * enviado e assinado, passos concluídos e "Revisar e assinar" fechando cada gate.
 *
 * Duas pessoas, de propósito. "Ninguém aprova o que é seu": o que o cliente
 * produz é do dono do processo e a consultoria aprova; o resto é da consultoria
 * e o dono aprova. Uma sessão só não chegaria a Aprovado em nenhum entregável.
 *
 *   - `admin@cosmos.local`  → CONSULTANT
 *   - `po@cosmos.local`     → PROCESS_OWNER
 *
 * Pré-requisito: o globalSetup roda `seed:scaffold-e2e` (catálogo, módulo e os
 * dois papéis) e precisa de storage: anexar arquivo faz PUT na URL assinada, e
 * enviar para revisão confere que o arquivo chegou.
 *
 * Para na Fase 2 fechada (a Fase 3 abre). As fases 3 e 4 repetem o mesmo
 * movimento, e a janela de observação de 30 dias não cabe num e2e.
 */

const consultant = roleStorageState("admin");
const owner = roleStorageState("po");

type Who = "consultant" | "owner";
type Item = { code: string; producer: "OWNER" | "OTHER" };

/** Quem elabora e quem aprova, pela regra do produto. */
const workerOf = (i: Item): Who =>
  i.producer === "OWNER" ? "owner" : "consultant";
const reviewerOf = (i: Item): Who =>
  i.producer === "OWNER" ? "consultant" : "owner";

// Triagem v5. O A3.2 (caso de negócio) não é aprovado à mão: deriva da assinatura.
const ASSESS: Item[] = [
  { code: "A1.1", producer: "OWNER" },
  { code: "A2.1", producer: "OTHER" },
  { code: "A3.1", producer: "OTHER" },
];
const ASSESS_STEPS = [
  "Mapear o processo",
  "Mapear a fonte",
  "Medir e prometer",
];

const PILOT: Item[] = [
  { code: "B1.1", producer: "OTHER" },
  { code: "B1.2", producer: "OTHER" },
  { code: "B2.1", producer: "OTHER" },
  { code: "B3.1", producer: "OTHER" },
  { code: "B1.3", producer: "OWNER" },
];
const PILOT_STEPS = [
  "Preparar o piloto",
  "Garantir reversão",
  "Rodar e comparar",
];

const FILE = {
  name: "evidencia.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("evidência do e2e"),
};

/** A linha de um entregável na lista da fase, achada pelo código. */
const row = (page: Page, code: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByText(code, { exact: true }) });

/** Escolhe num <select> a opção cujo texto casa com o padrão. */
async function pick(page: Page, select: string, pattern: RegExp) {
  const value = await page
    .locator(`${select} option`, { hasText: pattern })
    .first()
    .getAttribute("value");
  expect(value, `opção ${pattern} em ${select}`).toBeTruthy();
  await page.locator(select).selectOption(value as string);
}

/** Clica uma ação do entregável e espera o estado novo aparecer por extenso. */
async function act(page: Page, code: string, action: string, becomes: string) {
  const item = row(page, code);
  await item.getByRole("button", { name: action, exact: true }).click();
  await expect(item.getByText(becomes, { exact: true })).toBeVisible();
}

/** Abre a mesma URL numa sessão de outra pessoa. */
async function as(browser: Browser, who: Who, url: string) {
  const context = await browser.newContext({
    storageState: who === "owner" ? owner : consultant,
  });
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByText("Gate da fase")).toBeVisible();
  return { page, close: () => context.close() };
}

/** Elabora (iniciar, anexar arquivo, enviar) tudo o que `who` produz. */
async function work(browser: Browser, url: string, items: Item[], who: Who) {
  const mine = items.filter((i) => workerOf(i) === who);
  const s = await as(browser, who, url);
  for (const { code } of mine) {
    await act(s.page, code, "Iniciar", "Em elaboração");
    // Enviar sem arquivo não deixa: o botão só habilita depois do anexo.
    await expect(
      row(s.page, code).getByRole("button", {
        name: "Enviar para revisão",
        exact: true,
      })
    ).toBeDisabled();
    await s.page.getByLabel(`Anexar arquivo: ${code}`).setInputFiles(FILE);
    await expect(
      row(s.page, code).getByText(/v1 · evidencia\.pdf/)
    ).toBeVisible();
    await act(s.page, code, "Enviar para revisão", "Em revisão");
  }
  await s.close();
}

/** Aprova tudo o que `who` revisa. */
async function review(browser: Browser, url: string, items: Item[], who: Who) {
  const mine = items.filter((i) => reviewerOf(i) === who);
  const s = await as(browser, who, url);
  for (const { code } of mine) {
    await act(s.page, code, "Aprovar", "Aprovado");
  }
  await s.close();
}

/** Percorre os entregáveis de uma fase até todos Aprovados. */
async function deliver(browser: Browser, url: string, items: Item[]) {
  await work(browser, url, items, "owner");
  await work(browser, url, items, "consultant");
  await review(browser, url, items, "consultant");
  await review(browser, url, items, "owner");
}

/** Conclui os passos e fecha o gate: "Revisar e assinar". */
async function closeGate(browser: Browser, url: string, steps: string[]) {
  const s = await as(browser, "consultant", url);
  for (const statement of steps) {
    await s.page.getByLabel(`Concluir: ${statement}`).click();
    await expect(s.page.getByLabel(`Desmarcar: ${statement}`)).toBeVisible();
  }
  const gate = s.page.getByRole("button", { name: "Revisar e assinar" });
  await expect(gate).toBeEnabled();
  const boxes = s.page.getByRole("checkbox");
  const n = await boxes.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).check();
  }
  await gate.click();
  await expect(s.page.getByText("fechado", { exact: true })).toBeVisible();
  await s.close();
}

test.describe
  .serial("Scaffold · ciclo pela tela @auth @scaffold", () => {
    let trackUrl = "";
    let caseUrl = "";

    test("cria a trilha do catálogo, com entregáveis e caso de negócio", async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: consultant });
      const page = await context.newPage();
      await page.goto("/scaffold");
      await page.getByRole("button", { name: "Nova trilha" }).click();

      await page.locator("#nt-name").fill("Triagem de demanda (e2e)");
      // A versão mais nova do template é a pinada: a que tem entregáveis.
      await pick(page, "#nt-template", /Triagem de suporte/);
      await pick(page, "#nt-owner", /Paula Oliveira/);
      await page.locator("#nt-consultant").selectOption({ index: 1 });
      await page.getByRole("button", { name: "Criar trilha" }).click();

      await page.waitForURL(/\/scaffold\/track\//, { timeout: 30_000 });
      trackUrl = page.url();

      for (const code of ["A1.1", "A2.1", "A3.1", "A3.2"]) {
        await expect(row(page, code)).toBeVisible();
      }
      await expect(row(page, "A1.1").getByText("Não iniciado")).toBeVisible();
      // O gate espera os entregáveis, e diz quais.
      await expect(
        page.getByText(/entregáveis obrigatórios pendentes: A1\.1/)
      ).toBeVisible();

      // O caso de negócio nasceu com a trilha, em rascunho.
      await page.getByRole("button", { name: /Caso de negócio BC-/ }).click();
      await page.waitForURL(/\/scaffold\/baseline\//, { timeout: 30_000 });
      caseUrl = page.url();
      await expect(page.getByText("Rascunho").first()).toBeVisible();
      await context.close();
    });

    test("Fase 1: entregáveis aprovados, caso escrito, enviado e assinado", async ({
      browser,
    }) => {
      await deliver(browser, trackUrl, ASSESS);

      // A consultoria escreve a promessa.
      const c = await as(browser, "consultant", trackUrl).then(async (s) => {
        await s.page.goto(caseUrl);
        return s;
      });
      await c.page.getByLabel(/^Rótulo/).fill("Cycle time da triagem");
      await c.page.getByLabel(/^Unidade/).fill("min");
      await c.page.getByLabel(/^Linha de base/).fill("46");
      await c.page.getByLabel(/^Meta/).fill("34");
      await c.page.getByLabel(/^Fonte/).fill("Log do sistema de fila");
      await c.page.getByLabel(/^Amostra/).fill("4 semanas");
      await c.page.getByLabel(/^Janela de apuração/).fill("6");
      await c.page
        .getByLabel(/^Base do benefício/)
        .fill("Horas de triagem evitadas.");
      await c.page.getByRole("button", { name: "Salvar rascunho" }).click();
      await expect(
        c.page.getByText("Cycle time da triagem").first()
      ).toBeVisible();
      await c.page
        .getByRole("button", { name: "Enviar para assinatura" })
        .click();
      await expect(
        c.page.getByText("Aguardando assinatura").first()
      ).toBeVisible();
      await c.close();

      // O dono do processo assina.
      const o = await as(browser, "owner", trackUrl).then(async (s) => {
        await s.page.goto(caseUrl);
        return s;
      });
      await o.page
        .getByRole("button", { name: "Assinar", exact: true })
        .click();
      await o.page.locator("#bc-signer").fill("Paula Oliveira");
      await o.page.getByRole("button", { name: /^Assinar v\d/ }).click();
      await expect(o.page.getByText("Assinado").first()).toBeVisible();
      await o.close();
    });

    test("Fase 1: Revisar e assinar fecha o gate e abre a Fase 2", async ({
      browser,
    }) => {
      await closeGate(browser, trackUrl, ASSESS_STEPS);
      // A trilha andou: reabrir a tela cai na fase corrente, a PILOT.
      const s = await as(browser, "consultant", trackUrl);
      await expect(s.page.getByText(/Entregáveis — /)).toContainText(
        /Pilot|Piloto/i
      );
      await s.close();
    });

    test("Fase 2: entregáveis até Aprovado e o gate libera", async ({
      browser,
    }) => {
      await deliver(browser, trackUrl, PILOT);
      const s = await as(browser, "consultant", trackUrl);
      for (const statement of PILOT_STEPS) {
        await s.page.getByLabel(`Concluir: ${statement}`).click();
      }
      await expect(
        s.page.getByRole("button", { name: "Revisar e assinar" })
      ).toBeEnabled();
      await expect(
        s.page.getByText(/entregáveis? obrigatórios? pendentes?/)
      ).toHaveCount(0);
      await s.close();
    });

    test("Fase 2: Revisar e assinar fecha o gate", async ({ browser }) => {
      const s = await as(browser, "consultant", trackUrl);
      const boxes = s.page.getByRole("checkbox");
      const n = await boxes.count();
      for (let i = 0; i < n; i++) {
        await boxes.nth(i).check();
      }
      await s.page.getByRole("button", { name: "Revisar e assinar" }).click();
      await expect(s.page.getByText("fechado", { exact: true })).toBeVisible();
      await expect(
        s.page.getByRole("button", { name: "Reabrir fase" })
      ).toBeVisible();
      await s.close();
    });
  });

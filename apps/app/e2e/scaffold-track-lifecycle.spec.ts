import { type Browser, expect, type Page, test } from "@playwright/test";
import { roleStorageState } from "./setup/auth.setup";

/**
 * E2E — Scaffold: ciclo de vida da trilha (T124, S7).
 *
 * Duas pessoas, de propósito. "Ninguém aprova o que é seu": o que o cliente
 * produz é do dono do processo e a consultoria aprova; o resto é da consultoria
 * e o dono aprova. Uma sessão só não conseguiria percorrer nenhum entregável até
 * Aprovado.
 *
 *   - `admin@cosmos.local`  → CONSULTANT
 *   - `po@cosmos.local`     → PROCESS_OWNER
 *
 * Pré-requisito: o globalSetup roda `seed:scaffold-e2e`, que publica o catálogo,
 * contrata o módulo, atribui os dois papéis e cria a TR-901 já na Fase 2.
 *
 * Por que há duas partes: a tela ainda não edita as métricas do caso de
 * negócio, então uma trilha nova não passa da Fase 1 pela interface (o gate da
 * ASSESS exige o caso assinado). A primeira parte prova o começo do ciclo numa
 * trilha criada pela tela; a segunda percorre a Fase 2 até "Revisar e assinar"
 * na TR-901, que o seed deixa com a Fase 1 fechada.
 */

const consultant = roleStorageState("admin");
const owner = roleStorageState("po");

/** A linha de um entregável na lista da fase, achada pelo código. */
const row = (page: Page, code: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByText(code, { exact: true }) });

/** Escolhe num <select> a opção cujo texto casa com o padrão. `selectOption`
 *  por rótulo só aceita texto exato, e aqui o rótulo leva o papel junto. */
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

/** Abre a mesma trilha numa sessão de outra pessoa. */
async function asPerson(browser: Browser, state: string, url: string) {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByText("Gate da fase")).toBeVisible();
  return { page, close: () => context.close() };
}

test.describe("Scaffold · trilha nova do catálogo @auth @scaffold", () => {
  test.use({ storageState: consultant });

  test("nasce com entregáveis e leva o primeiro até Aprovado", async ({
    page,
    browser,
  }) => {
    await page.goto("/scaffold");
    await page.getByRole("button", { name: "Nova trilha" }).click();

    await page.locator("#nt-name").fill("Triagem de demanda (e2e)");
    // A versão mais nova do template é a pinada: a que tem entregáveis.
    await pick(page, "#nt-template", /Triagem de suporte/);
    await pick(page, "#nt-owner", /Paula Oliveira/);
    await page.locator("#nt-consultant").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Criar trilha" }).click();

    await page.waitForURL(/\/scaffold\/track\//, { timeout: 30_000 });
    const trackUrl = page.url();

    // Os entregáveis da ASSESS nascem com a trilha.
    await expect(
      page.getByText("Entregáveis — ", { exact: false }).first()
    ).toBeVisible();
    for (const code of ["A1.1", "A2.1", "A3.1", "A3.2"]) {
      await expect(row(page, code)).toBeVisible();
    }
    await expect(row(page, "A1.1").getByText("Não iniciado")).toBeVisible();
    await expect(row(page, "A1.1").getByText("Obrigatório")).toBeVisible();

    // A1.1 é do dono do processo: ele elabora e envia.
    const po = await asPerson(browser, owner, trackUrl);
    await act(po.page, "A1.1", "Iniciar", "Em elaboração");
    await act(po.page, "A1.1", "Enviar para revisão", "Em revisão");
    // Quem produziu não aprova o que é seu.
    await expect(
      row(po.page, "A1.1").getByRole("button", { name: "Aprovar", exact: true })
    ).toBeDisabled();
    await po.close();

    // A consultoria aprova.
    await page.reload();
    await act(page, "A1.1", "Aprovar", "Aprovado");
  });
});

test.describe
  .serial("Scaffold · Fase 2 da TR-901 @auth @scaffold", () => {
    const PILOT_BY_CONSULTANT = ["B1.1", "B1.2", "B2.1", "B3.1"];
    let trackUrl = "";

    test("o gate espera os entregáveis obrigatórios, e diz quais", async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: consultant });
      const page = await context.newPage();
      await page.goto("/scaffold");
      await page.getByRole("button", { name: "Abrir trilha TR-901" }).click();
      await page.waitForURL(/\/scaffold\/track\//, { timeout: 30_000 });
      trackUrl = page.url();

      const gate = page.getByRole("button", { name: "Revisar e assinar" });
      await expect(gate).toBeDisabled();
      await expect(
        page.getByText(/entregáveis obrigatórios pendentes: B1\.1/)
      ).toBeVisible();
      await context.close();
    });

    test("consultoria elabora e envia o que produz; o dono aprova", async ({
      browser,
    }) => {
      const c = await asPerson(browser, consultant, trackUrl);
      for (const code of PILOT_BY_CONSULTANT) {
        await act(c.page, code, "Iniciar", "Em elaboração");
        await act(c.page, code, "Enviar para revisão", "Em revisão");
      }
      await c.close();

      const o = await asPerson(browser, owner, trackUrl);
      for (const code of PILOT_BY_CONSULTANT) {
        await act(o.page, code, "Aprovar", "Aprovado");
      }
      await o.close();
    });

    test("o que o dono produz é aprovado pela consultoria, e o gate libera", async ({
      browser,
    }) => {
      const o = await asPerson(browser, owner, trackUrl);
      // O 16º entregável da triagem (B1.3) é do dono.
      await act(o.page, "B1.3", "Iniciar", "Em elaboração");
      await act(o.page, "B1.3", "Enviar para revisão", "Em revisão");
      await o.close();

      const c = await asPerson(browser, consultant, trackUrl);
      await act(c.page, "B1.3", "Aprovar", "Aprovado");

      const gate = c.page.getByRole("button", { name: "Revisar e assinar" });
      await expect(gate).toBeEnabled();
      await expect(
        c.page.getByText(/entregáveis? obrigatórios? pendentes?/)
      ).toHaveCount(0);
      await c.close();
    });

    test("Revisar e assinar fecha a fase", async ({ browser }) => {
      const c = await asPerson(browser, consultant, trackUrl);
      // Todos os critérios da fase, marcados pela pessoa que assina.
      const boxes = c.page.getByRole("checkbox");
      const n = await boxes.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        await boxes.nth(i).check();
      }
      await c.page.getByRole("button", { name: "Revisar e assinar" }).click();

      await expect(c.page.getByText("fechado", { exact: true })).toBeVisible();
      await expect(
        c.page.getByRole("button", { name: "Reabrir fase" })
      ).toBeVisible();
      await c.close();
    });
  });

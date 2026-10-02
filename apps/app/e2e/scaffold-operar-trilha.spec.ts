import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/**
 * E2E SC-001 — Scaffold, PR 1 "Operar a trilha" (specs/015, D-28).
 *
 * Leva a trilha do Atlas (TR-120, assessment AS-120) da ASSESS ao EMBED pela
 * interface: passos, entregáveis, caso de negócio, decisão do gate com
 * evidência por critério, recusas (A4 pendente, caso de negócio sem
 * assinatura, critério não atendido, política do Charter) e o modal
 * "Nova trilha" só pelo teclado.
 *
 * Atalho declarado: na ASSESS os quatro entregáveis seguem o ciclo inteiro
 * pela tela (iniciar, anexar, enviar, aprovar por outra pessoa). Em PILOT,
 * SCALE e EMBED os entregáveis obrigatórios entram aprovados por SQL (aprovar
 * onze pela tela com duas pessoas não acrescenta prova nova); os passos e a
 * decisão do gate seguem pela tela.
 *
 * Reinicia o TR-120 a cada execução: apaga a trilha e roda o seed de demo.
 */

const ADMIN = { email: "admin@cosmos.local", password: "Cosmos@2026!" }; // CONSULTANT
const PO = { email: "po@cosmos.local", password: "Cosmos@2026!" }; // PROCESS_OWNER

const PKG_DB = resolve(process.cwd(), "../../packages/database");

async function openDb() {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const { PrismaClient } = await import(
    "../../../packages/database/generated/index.js"
  );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { db, close: () => db.$disconnect().then(() => pool.end()) };
}

async function withDb<T>(
  fn: (db: Awaited<ReturnType<typeof openDb>>["db"]) => Promise<T>
): Promise<T> {
  const { db, close } = await openDb();
  try {
    return await fn(db);
  } finally {
    await close();
  }
}

/** Apaga o TR-120 (e o que o prende) e recria pelo seed de demo. */
async function resetTr120() {
  await withDb(async (db) => {
    const tracks = await db.scaffoldTrack.findMany({
      where: { code: "TR-120" },
      select: { id: true, overlayId: true },
    });
    const overlays = tracks.flatMap((t) => (t.overlayId ? [t.overlayId] : []));
    await db.scaffoldTrack.deleteMany({
      where: { id: { in: tracks.map((t) => t.id) } },
    });
    if (overlays.length > 0) {
      await db.scaffoldOverlayConflict.deleteMany({
        where: { overlayId: { in: overlays } },
      });
    }
  });
  execFileSync(
    "pnpm",
    ["exec", "tsx", "--env-file=.env", "scripts/seed-scaffold-demo.mts"],
    {
      cwd: PKG_DB,
      env: { ...process.env, SCAFFOLD_DEMO_TENANT: "cosmos-dev" },
      stdio: "pipe",
    }
  );
}

async function deliverableStatuses(): Promise<Record<string, string>> {
  return await withDb(async (db) => {
    const rows = await db.scaffoldDeliverableInstance.findMany({
      where: { track: { code: "TR-120" } },
      select: { code: true, status: true },
    });
    return Object.fromEntries(rows.map((r) => [r.code, r.status]));
  });
}

async function countStatus(status: string): Promise<number> {
  return Object.values(await deliverableStatuses()).filter((s) => s === status)
    .length;
}

async function phaseStates(): Promise<Record<string, string>> {
  return await withDb(async (db) => {
    const rows = await db.scaffoldPhaseInstance.findMany({
      where: { track: { code: "TR-120" } },
      select: { phase: true, state: true },
    });
    return Object.fromEntries(rows.map((r) => [r.phase, r.state]));
  });
}

/** Atalho: entregáveis obrigatórios da fase entram aprovados. */
async function approveByDb(phase: "PILOT" | "SCALE" | "EMBED") {
  await withDb((db) =>
    db.scaffoldDeliverableInstance.updateMany({
      where: {
        required: true,
        track: { code: "TR-120" },
        phaseInstance: { phase },
      },
      data: { status: "APPROVED" },
    })
  );
}

async function loginAs(page: Page, who: { email: string; password: string }) {
  await page.goto("/sign-in");
  await page.locator('input[type="email"]').fill(who.email);
  await page.locator('input[type="password"]').fill(who.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
    timeout: 90_000,
  });
}

async function newSession(browser: Browser, who: typeof ADMIN) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await loginAs(page, who);
  return { context, page };
}

async function openTr120(page: Page) {
  await page.goto("/scaffold");
  const card = page.getByRole("button", { name: /Abrir trilha TR-120/ });
  await card.waitFor({ timeout: 120_000 });
  await card.click();
  await page.getByText("Gate da fase").waitFor({ timeout: 90_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function reloadTrack(page: Page) {
  await page.reload();
  await page.getByText("Gate da fase").waitFor({ timeout: 90_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function axeSerious(page: Page, label: string) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("iframe")
    .analyze();
  const serious = r.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  expect(serious, `[${label}] ${JSON.stringify(serious, null, 2)}`).toEqual([]);
}

/** Conclui os passos da fase ativa pela tela, um a um. */
async function concluirPassos(page: Page) {
  const pendentes = page.getByRole("button", { name: /^Concluir:/ });
  for (let i = 0; i < 12; i++) {
    const antes = await pendentes.count();
    if (antes === 0) {
      return;
    }
    await pendentes.first().click();
    await expect(pendentes).toHaveCount(antes - 1, { timeout: 30_000 });
  }
}

/** Marca todo critério e escreve a evidência do primeiro. */
async function marcarCriterios(page: Page, evidencia: string) {
  const caixas = page.getByRole("checkbox");
  const n = await caixas.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await caixas.nth(i).check();
  }
  await page
    .getByRole("textbox", { name: /^Evidência:/ })
    .first()
    .fill(evidencia);
  await expect(page.getByText(new RegExp(`${n}/${n} atendidos`))).toBeVisible();
}

const assinar = (page: Page) =>
  page.getByRole("button", { name: "Revisar e assinar" });

async function fecharGate(page: Page, evidencia: string) {
  await marcarCriterios(page, evidencia);
  await assinar(page).click();
  await expect(page.getByText(/Decidido em/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(evidencia)).toBeVisible();
}

let admin: { context: BrowserContext; page: Page };
let po: { context: BrowserContext; page: Page };

test.describe("Scaffold · operar a trilha (SC-001) @scaffold", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async ({ browser }) => {
    await resetTr120();
    admin = await newSession(browser, ADMIN);
    po = await newSession(browser, PO);
  });
  test.afterAll(async () => {
    await admin?.context.close();
    await po?.context.close();
  });

  test("modal Nova trilha só pelo teclado: campos antes dos botões, Tab preso, Esc fecha, foco volta", async () => {
    const page = admin.page;
    await page.goto("/scaffold");
    const abrir = page.getByRole("button", { name: "Nova trilha" });
    await abrir.waitFor({ timeout: 120_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await abrir.focus();
    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("dialog", { name: /Nova trilha/ });
    await expect(dialogo).toBeVisible({ timeout: 30_000 });

    // Campos antes dos botões de ação na ordem do DOM (FR-011).
    const ordem = await dialogo.evaluate((d) =>
      [...d.querySelectorAll("button,input,select,textarea")].map(
        (e) =>
          `${e.tagName}:${(e.getAttribute("aria-label") || (e as HTMLElement).innerText || "").trim().slice(0, 20)}`
      )
    );
    const iCampo = ordem.findIndex((x) => /^(INPUT|SELECT)/.test(x));
    const iCancelar = ordem.findIndex((x) => /Cancelar/.test(x));
    const iCriar = ordem.findIndex((x) => /Criar trilha/.test(x));
    expect(iCampo, ordem.join(" | ")).toBeGreaterThanOrEqual(0);
    expect(iCampo).toBeLessThan(iCancelar);
    expect(iCampo).toBeLessThan(iCriar);

    await axeSerious(page, "modal Nova trilha");

    // Tab e Shift+Tab nunca saem do modal (FR-012).
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const dentro = await page.evaluate(
        () => !!document.activeElement?.closest("[role=dialog]")
      );
      expect(dentro, `Tab ${i + 1} escapou do modal`).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest("[role=dialog]")
        )
      ).toBe(true);
    }

    // Esc fecha e o foco volta ao botão que abriu (FR-013).
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(abrir).toBeFocused();
  });

  test("ASSESS: passos e entregáveis pela tela; o gate recusa enquanto falta o A4", async () => {
    const page = admin.page;
    await openTr120(page);
    await concluirPassos(page);

    // A3.1 e A4.1 iniciam; A2.1, A3.1 e A4.1 recebem arquivo e vão para revisão.
    const iniciar = page.getByRole("button", { name: "Iniciar", exact: true });
    for (let i = 0; i < 2; i++) {
      const antes = await iniciar.count();
      await iniciar.first().click();
      await expect(iniciar).toHaveCount(antes - 1, { timeout: 30_000 });
    }
    for (const code of ["A2.1", "A3.1", "A4.1"]) {
      await page
        .locator(`input[aria-label="Anexar arquivo: ${code}"]`)
        .setInputFiles({
          name: `${code}.txt`,
          mimeType: "text/plain",
          buffer: Buffer.from(`artefato sintético de ${code}`),
        });
      await expect(page.getByText(`${code}.txt`).first()).toBeVisible({
        timeout: 30_000,
      });
    }
    const enviar = page.locator("button:not([disabled])", {
      hasText: "Enviar para revisão",
    });
    for (let i = 0; i < 3; i++) {
      await reloadTrack(page);
      await expect(enviar.first()).toBeVisible({ timeout: 30_000 });
      await enviar.first().click();
      // A1.1 já nasce em revisão: com o primeiro envio são duas.
      await expect
        .poll(() => countStatus("IN_REVIEW"), { timeout: 30_000 })
        .toBe(i + 2);
    }

    // Quem é responsável pelo entregável não o aprova: o botão fica desabilitado.
    await reloadTrack(page);
    const proprios = await page
      .getByRole("button", { name: "Aprovar", exact: true })
      .all();
    expect(proprios.length).toBeGreaterThan(0);
    for (const b of proprios) {
      await expect(b).toBeDisabled();
    }

    // Outra pessoa (dono do processo) aprova A1.1, A2.1 e A3.1; A4.1 fica pendente.
    await openTr120(po.page);
    const aprovar = po.page.locator("button:not([disabled])", {
      hasText: /^Aprovar$/,
    });
    for (let i = 0; i < 3; i++) {
      await reloadTrack(po.page);
      await expect(aprovar.first()).toBeVisible({ timeout: 30_000 });
      await aprovar.first().click();
      await expect
        .poll(() => countStatus("APPROVED"), { timeout: 30_000 })
        .toBe(i + 1);
    }
    expect((await deliverableStatuses())["A4.1"]).toBe("IN_REVIEW");

    // Falta obrigatório (A4.1): botão desabilitado com o motivo escrito (FR-007).
    await reloadTrack(page);
    await expect(
      page.getByText("1 entregável obrigatório pendente: A4.1.")
    ).toBeVisible();
    await expect(assinar(page)).toBeDisabled();
  });

  test("ASSESS: sem caso de negócio assinado o gate recusa; assinado, fecha com evidência (axe + teclado)", async () => {
    // O dono do processo aprova o A4.1.
    await reloadTrack(po.page);
    await po.page
      .locator("button:not([disabled])", { hasText: /^Aprovar$/ })
      .first()
      .click();
    await expect
      .poll(async () => (await deliverableStatuses())["A4.1"], {
        timeout: 30_000,
      })
      .toBe("APPROVED");

    const page = admin.page;
    await reloadTrack(page);
    await expect(assinar(page)).toBeEnabled();

    // Marca tudo e tenta fechar: SG-04, falta o caso de negócio assinado.
    await marcarCriterios(page, "Relatório do AS-120 anexado ao A1.1");
    await assinar(page).click();
    await expect(
      page
        .getByRole("alert")
        .getByText(/não fecha sem caso de negócio assinado/)
    ).toBeVisible({ timeout: 30_000 });
    expect((await phaseStates()).ASSESS).not.toBe("CLOSED");

    // Caso de negócio: a consultora redige e envia; o dono do processo assina.
    await page.getByRole("button", { name: /Caso de negócio BC-120/ }).click();
    await page
      .getByRole("button", { name: "Adicionar métrica" })
      .waitFor({ timeout: 60_000 });
    await page
      .getByRole("textbox", { name: "Rótulo" })
      .fill("Tempo de triagem manual");
    await page.getByRole("textbox", { name: "Unidade" }).fill("min");
    await page.getByRole("textbox", { name: "Linha de base" }).fill("42");
    await page.getByRole("textbox", { name: "Meta" }).fill("20");
    await page
      .getByRole("textbox", { name: "Fonte do número" })
      .fill("Amostra de 120 casos do Atlas");
    await page.getByRole("textbox", { name: "Amostra" }).fill("120 casos");
    await page
      .getByRole("textbox", { name: "Benefício anual (R$)" })
      .fill("180000");
    await page
      .getByRole("textbox", { name: "Base do benefício" })
      .fill("Horas evitadas x custo-hora (demonstração)");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    const enviarAss = page.getByRole("button", {
      name: "Enviar para assinatura",
    });
    await expect(enviarAss).toBeEnabled({ timeout: 30_000 });
    await enviarAss.click();
    await expect(page.getByText(/Aguardando assinatura/).first()).toBeVisible({
      timeout: 30_000,
    });

    // A consultora não assina: o papel é do dono do processo.
    await openTr120(po.page);
    await po.page
      .getByRole("button", { name: /Caso de negócio BC-120/ })
      .click();
    await po.page.getByRole("button", { name: "Assinar", exact: true }).click();
    await po.page
      .getByRole("textbox", { name: "Quem assina" })
      .fill("Paula Oliveira (dona do processo)");
    await po.page.getByRole("button", { name: "Assinar v1" }).click();
    await expect(po.page.getByText(/Assinado/).first()).toBeVisible({
      timeout: 30_000,
    });

    // Volta ao gate: axe, teclado e fechamento com a evidência.
    await openTr120(page);
    await axeSerious(page, "gate da ASSESS");
    const primeira = page.getByRole("checkbox").first();
    await primeira.focus();
    await page.keyboard.press("Space");
    await expect(primeira).toBeChecked();
    await page.keyboard.press("Space");
    await expect(primeira).not.toBeChecked();
    await marcarCriterios(page, "Relatório do AS-120 anexado ao A1.1");
    await assinar(page).focus();
    await expect(assinar(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Decidido em/)).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByText("Relatório do AS-120 anexado ao A1.1")
    ).toBeVisible();
    const estados = await phaseStates();
    expect(estados.ASSESS).toBe("CLOSED");
    expect(estados.PILOT).toBe("OPEN");
  });

  test("PILOT: critério não atendido é recusado e a opção de override aparece (US2 #4 e #6)", async () => {
    // Antes do fix do #286, `closePhase` gravava BLOCKED e lançava CRITERIA_UNMET
    // na mesma transação: o throw desfazia o BLOCKED e o override nunca aparecia
    // (este teste era `test.fail`). Agora o BLOCKED persiste antes da recusa.
    await approveByDb("PILOT");
    const page = admin.page;
    await reloadTrack(page);
    await concluirPassos(page);

    // Marca todos menos o último critério.
    const caixas = page.getByRole("checkbox");
    const n = await caixas.count();
    for (let i = 0; i < n - 1; i++) {
      await caixas.nth(i).check();
    }
    await assinar(page).click();
    await expect(
      page.getByRole("alert").getByText(/critério de gate não atendido/)
    ).toBeVisible({ timeout: 30_000 });

    // SG-02: a fase vai a BLOCKED e só então o override aparece. Soft: se não
    // aparecer, o teste falha mas o resto da trilha continua a ser exercitado.
    expect
      .soft(
        (await phaseStates()).PILOT,
        "a fase deveria estar BLOCKED depois da recusa"
      )
      .toBe("BLOCKED");
    await expect
      .soft(
        page.getByRole("button", { name: "Registrar override" }),
        "opção de override depois da recusa"
      )
      .toBeVisible({ timeout: 10_000 });

    // Atende o critério que faltava e fecha normalmente.
    await caixas.nth(n - 1).check();
    await page
      .getByRole("textbox", { name: /^Evidência:/ })
      .first()
      .fill("Catálogo com 4 fontes críticas (P1.1 aprovado)");
    await assinar(page).click();
    await expect(page.getByText(/Decidido em/)).toBeVisible({
      timeout: 60_000,
    });
    expect((await phaseStates()).PILOT).toBe("CLOSED");
  });

  test("SCALE: recusa sem a política do Charter aceita; aplicada, fecha", async () => {
    await approveByDb("SCALE");
    const page = admin.page;
    await reloadTrack(page);
    await concluirPassos(page);
    await marcarCriterios(page, "Política de Uso de IA aceita para o fluxo");
    await assinar(page).click();
    await expect(
      page
        .getByRole("alert")
        .getByText(/não fecha sem o aceite da política do Charter/)
    ).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole("button", { name: /^Aplicar/ })
      .first()
      .click();
    await expect(page.getByText(/Aceita em/)).toBeVisible({ timeout: 30_000 });
    await reloadTrack(page);
    await fecharGate(page, "Política de Uso de IA aceita para o fluxo");
    expect((await phaseStates()).SCALE).toBe("CLOSED");
  });

  test("EMBED: fecha o último gate e abre a janela de observação com o handover pack", async () => {
    await approveByDb("EMBED");
    const page = admin.page;
    await reloadTrack(page);
    await concluirPassos(page);
    await fecharGate(page, "Governança contínua e posse entregue ao Atlas");
    await expect(page.getByText(/Nenhuma reabertura até agora/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Exportar handover pack" })
    ).toBeVisible();
    const estados = await phaseStates();
    expect(["CLOSED", "OBSERVING"]).toContain(estados.EMBED);
    expect(estados.ASSESS).toBe("CLOSED");
    expect(estados.PILOT).toBe("CLOSED");
    expect(estados.SCALE).toBe("CLOSED");
  });
});

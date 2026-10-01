import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import dotenv from "dotenv";
import { meridianStorageState } from "./setup/auth.setup";

dotenv.config({ path: ".env.local" });

/**
 * E2E — Meridian · finalizar assessment (REVIEW → FINALISED).
 *
 * Usa o AS-104 (Vanta Saúde, `seed:meridian cosmos-dev`): em revisão, com o
 * eixo Data contestado. O teste de sucesso é irreversível pela tela, então o
 * `afterAll` devolve o assessment ao estado do seed (REVIEW, Data contestado).
 * A auditoria é imutável: as linhas `meridian.assessment.finalise` ficam, e a
 * conferência é por delta de contagem.
 *
 * Papéis REVIEWER/VIEWER: o seed só tem a Clara (REVIEWER); o VIEWER é a
 * mesma Clara rebaixada durante o teste e restaurada em `finally`.
 */

const PASSWORD = process.env.MERIDIAN_SEED_PASSWORD ?? "meridian123";
const REVIEWER_EMAIL = "clara.nunes@nebuloz.exemplo";
const SCAFFOLD_EMAIL = "admin@cosmos.local";
const SCAFFOLD_PASSWORD = "Cosmos@2026!";

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

/** Estado do seed: AS-104 em REVIEW com o eixo Data contestado. */
async function resetAs104() {
  await withDb(async (db) => {
    const a = await db.meridianAssessment.findFirst({
      where: { code: "AS-104" },
      select: { id: true },
    });
    if (!a) {
      throw new Error("AS-104 ausente: rode `pnpm seed:meridian cosmos-dev`.");
    }
    await db.meridianAssessment.update({
      where: { id: a.id },
      data: { status: "REVIEW" },
    });
    await db.meridianAxisScore.updateMany({
      where: { assessmentId: a.id, axis: "DATA" },
      data: { status: "CONTESTED" },
    });
  });
}

/** Decisão do contestado, sem passar pela fila: Data deixa de estar contestado. */
async function decideData() {
  await withDb(async (db) => {
    const a = await db.meridianAssessment.findFirst({
      where: { code: "AS-104" },
      select: { id: true },
    });
    await db.meridianAxisScore.updateMany({
      where: { assessmentId: a?.id, axis: "DATA" },
      data: { status: "COMPUTED" },
    });
  });
}

async function countFinaliseAudits(): Promise<number> {
  return await withDb((db) =>
    db.auditLog.count({ where: { action: "meridian.assessment.finalise" } })
  );
}

async function statusOf(): Promise<string | undefined> {
  return await withDb(async (db) => {
    const a = await db.meridianAssessment.findFirst({
      where: { code: "AS-104" },
      select: { status: true },
    });
    return a?.status;
  });
}

async function setReviewerRole(role: "VIEWER" | "REVIEWER") {
  await withDb(async (db) => {
    const user = await db.user.findFirst({
      where: { email: REVIEWER_EMAIL },
      select: { id: true },
    });
    await db.meridianMembership.updateMany({
      where: { userId: user?.id },
      data: { role },
    });
  });
}

async function openAs104(page: Page) {
  await page.goto("/meridian");
  const card = page.getByRole("button", {
    name: /Abrir assessment Vanta Saúde.*AS-104/,
  });
  await card.first().waitFor({ timeout: 90_000 });
  await card.first().click();
  await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
  await page
    .getByRole("button", { name: /Coleta/ })
    .waitFor({ timeout: 60_000 });
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

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
    timeout: 60_000,
  });
}

test.describe("Meridian · finalizar assessment @meridian", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    await resetAs104();
  });
  test.afterAll(async () => {
    await setReviewerRole("REVIEWER");
    await resetAs104();
  });

  test.describe("consultora", () => {
    test.use({ storageState: meridianStorageState("consultant") });

    test("com eixo contestado: botão desabilitado e o motivo nomeia o eixo", async ({
      page,
    }) => {
      await openAs104(page);
      const botao = page.getByRole("button", { name: "Finalizar assessment" });
      await expect(botao).toBeVisible();
      await expect(botao).toBeDisabled();
      await expect(
        page.getByText(/Decida o eixo contestado \(Data\)/)
      ).toBeVisible();
      expect(await statusOf()).toBe("REVIEW");
    });

    test("sem contestado: Finalizar pede confirmação, finaliza e audita (axe + teclado)", async ({
      page,
    }) => {
      await decideData();
      await openAs104(page);
      const botao = page.getByRole("button", { name: "Finalizar assessment" });
      await expect(botao).toBeEnabled();
      await axeSerious(page, "botão");

      // Teclado: foco no botão e Enter abre a confirmação.
      await botao.focus();
      await expect(botao).toBeFocused();
      await page.keyboard.press("Enter");
      const dialogo = page.getByRole("dialog", {
        name: /Finalizar assessment/,
      });
      await expect(dialogo).toBeVisible();
      await expect(
        dialogo.getByText(/O assessment não volta para Em revisão/)
      ).toBeVisible();
      expect(await statusOf()).toBe("REVIEW");
      await axeSerious(page, "confirmação");

      // Esc fecha sem finalizar.
      await page.keyboard.press("Escape");
      await expect(dialogo).toBeHidden();
      expect(await statusOf()).toBe("REVIEW");

      // Reabre e confirma por teclado: Tab até "Confirmar finalização".
      await botao.focus();
      await page.keyboard.press("Enter");
      await expect(dialogo).toBeVisible();
      const confirmar = dialogo.getByRole("button", {
        name: "Confirmar finalização",
      });
      await confirmar.focus();
      await expect(confirmar).toBeFocused();

      const antes = await countFinaliseAudits();
      await page.keyboard.press("Enter");
      await expect(dialogo).toBeHidden({ timeout: 30_000 });
      await expect.poll(statusOf, { timeout: 30_000 }).toBe("FINALISED");
      expect(await countFinaliseAudits()).toBe(antes + 1);
      await expect(
        page.getByRole("button", { name: "Finalizar assessment" })
      ).toHaveCount(0);
    });
  });

  test("depois de finalizado, o Scaffold lista os gaps do AS-104 (X-03)", async ({
    browser,
  }) => {
    const abrirNovaTrilha = async (page: Page) => {
      await page.goto("/scaffold");
      const nova = page.getByRole("button", { name: "Nova trilha" });
      await nova.waitFor({ timeout: 90_000 });
      for (let i = 0; i < 6; i++) {
        await nova.click();
        if (
          await page
            .getByRole("dialog", { name: /Nova trilha/ })
            .waitFor({ timeout: 4000 })
            .then(() => true)
            .catch(() => false)
        ) {
          return;
        }
      }
    };

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    try {
      const page = await context.newPage();
      await loginAs(page, SCAFFOLD_EMAIL, SCAFFOLD_PASSWORD);

      // Antes: AS-104 em REVIEW, nenhum gap liberado.
      await resetAs104();
      await abrirNovaTrilha(page);
      await expect(
        page.getByText(/Nenhum gap finalizado no Meridian/)
      ).toBeVisible({ timeout: 60_000 });
      await page.keyboard.press("Escape");

      // Depois: finaliza (mesma transição que a tela faz) e os gaps aparecem.
      await decideData();
      await withDb((db) =>
        db.meridianAssessment.updateMany({
          where: { code: "AS-104" },
          data: { status: "FINALISED" },
        })
      );
      await abrirNovaTrilha(page);
      await expect(
        page.getByText(/Sem catálogo unificado/).first()
      ).toBeVisible({ timeout: 60_000 });
    } finally {
      await context.close();
    }
  });

  test("REVIEWER e VIEWER não veem o botão Finalizar", async ({ browser }) => {
    await resetAs104();
    await decideData();
    for (const role of ["REVIEWER", "VIEWER"] as const) {
      await setReviewerRole(role);
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      try {
        const page = await context.newPage();
        await loginAs(page, REVIEWER_EMAIL, PASSWORD);
        await openAs104(page);
        await expect(
          page.getByRole("button", { name: "Finalizar assessment" }),
          `${role} não deveria ver o botão`
        ).toHaveCount(0);
      } finally {
        await context.close();
        await setReviewerRole("REVIEWER");
      }
    }
  });
});

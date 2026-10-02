import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import dotenv from "dotenv";
import { meridianStorageState } from "./setup/auth.setup";

dotenv.config({ path: ".env.local" });

/**
 * E2E — Meridian D-29 (PR #338): confirmar o computado, reabrir e as travas.
 *
 * Usa o AS-104 (Vanta Saúde, `seed:meridian cosmos-dev`): em revisão, com o
 * eixo Data contestado. O `afterAll` devolve o assessment ao estado do seed.
 * A auditoria é imutável: conferência por delta de contagem. O VIEWER/REVIEWER
 * é a Clara Nunes (REVIEWER no seed), rebaixada a VIEWER durante o teste.
 *
 * As travas do assessment finalizado (override e confirmação recusados) não têm
 * botão na tela: são exercitadas chamando a server action pela sessão do
 * navegador (POST com o `Next-Action` do manifesto do `next dev`). O re-scoring
 * (`runScoring`) não tem caminho de tela nem de HTTP (só `closeCollection` o
 * chama, em COLLECTING); "não volta a contestado" fica no vitest
 * (`scoring-plan.test.ts`).
 */

const PASSWORD = process.env.MERIDIAN_SEED_PASSWORD ?? "meridian123";
const CLARA = "clara.nunes@nebuloz.exemplo";
const RACIONAL =
  "A evidência de campo sustenta o score computado; mantenho o valor.";
const MOTIVO_REABRIR =
  "Corrigir a justificativa do eixo Data antes de entregar ao cliente.";

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

async function as104() {
  return await withDb(async (db) => {
    const a = await db.meridianAssessment.findFirst({
      where: { code: "AS-104" },
      select: { id: true, status: true },
    });
    if (!a) {
      throw new Error("AS-104 ausente: rode `pnpm seed:meridian cosmos-dev`.");
    }
    return a;
  });
}

/** Estado do seed: AS-104 em REVIEW, Data contestado e sem confirmação. */
async function resetAs104() {
  const a = await as104();
  await withDb(async (db) => {
    await db.meridianAssessment.update({
      where: { id: a.id },
      data: { status: "REVIEW" },
    });
    await db.meridianAxisScore.updateMany({
      where: { assessmentId: a.id, axis: "DATA" },
      data: { status: "CONTESTED" },
    });
    await db.meridianOverride.deleteMany({
      where: { assessmentId: a.id, axis: "DATA", kind: "CONFIRMATION" },
    });
    const u = await db.user.findFirst({
      where: { email: CLARA },
      select: { id: true },
    });
    await db.meridianMembership.updateMany({
      where: { userId: u?.id },
      data: { role: "REVIEWER" },
    });
  });
}

async function setClaraRole(role: "VIEWER" | "REVIEWER") {
  await withDb(async (db) => {
    const u = await db.user.findFirst({
      where: { email: CLARA },
      select: { id: true },
    });
    await db.meridianMembership.updateMany({
      where: { userId: u?.id },
      data: { role },
    });
  });
}

async function dataScore() {
  const a = await as104();
  return await withDb((db) =>
    db.meridianAxisScore.findFirst({
      where: { assessmentId: a.id, axis: "DATA" },
    })
  );
}

async function countConfirmations(): Promise<number> {
  const a = await as104();
  return await withDb((db) =>
    db.meridianOverride.count({
      where: { assessmentId: a.id, axis: "DATA", kind: "CONFIRMATION" },
    })
  );
}

async function countAudit(action: string): Promise<number> {
  return await withDb((db) => db.auditLog.count({ where: { action } }));
}

/** Id da server action no manifesto mais recente do `next dev`. */
function actionId(exportedName: string, fileIncludes: string): string {
  const candidatos = [
    ".next/dev/server/server-reference-manifest.json",
    ".next/server/server-reference-manifest.json",
  ]
    .map((p) => join(process.cwd(), p))
    .filter((p) => existsSync(p))
    .sort((x, y) => statSync(y).mtimeMs - statSync(x).mtimeMs);
  const manifesto = JSON.parse(
    readFileSync(candidatos[0] as string, "utf8")
  ) as {
    node: Record<string, { exportedName?: string; filename?: string }>;
  };
  const hit = Object.entries(manifesto.node).find(
    ([, v]) =>
      v.exportedName === exportedName &&
      (v.filename ?? "").includes(fileIncludes)
  );
  if (!hit) {
    throw new Error(
      `action ${exportedName} fora do manifesto: abra a tela uma vez antes.`
    );
  }
  return hit[0];
}

/** Chama a server action pela sessão do navegador; devolve o Result. */
async function callAction(
  page: Page,
  id: string,
  args: unknown[]
): Promise<{ ok: boolean; error?: string }> {
  return await page.evaluate(
    async ([actionIdValue, argumentos]) => {
      const r = await fetch(location.pathname, {
        method: "POST",
        headers: {
          "Next-Action": actionIdValue as string,
          "Content-Type": "text/plain;charset=UTF-8",
          Accept: "text/x-component",
        },
        body: JSON.stringify(argumentos),
      });
      const t = await r.text();
      const linha = t.split("\n").find((l) => l.includes('"ok"')) ?? "";
      const json = linha.slice(linha.indexOf("{"));
      try {
        return JSON.parse(json);
      } catch {
        return { ok: false, error: `resposta ilegível: ${t.slice(0, 200)}` };
      }
    },
    [id, args] as const
  );
}

async function openAs104(page: Page) {
  await page.goto("/meridian");
  const card = page.getByRole("button", {
    name: /Abrir assessment Vanta Saúde.*AS-104/,
  });
  await card.first().waitFor({ timeout: 120_000 });
  await card.first().click();
  await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
  await page
    .getByRole("button", { name: /Coleta/ })
    .waitFor({ timeout: 90_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function openScoring(page: Page) {
  await openAs104(page);
  await page.getByRole("button", { name: /Scoring & Revisão/ }).click();
  await page
    .getByText(/Revisar e decidir|Confirmado pelo revisor|Computado/)
    .first()
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

async function loginAs(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
    timeout: 90_000,
  });
}

test.describe("Meridian · D-29 confirmar, reabrir e travas @meridian", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    await resetAs104();
  });
  test.afterAll(async () => {
    await resetAs104();
  });

  test.describe("consultora", () => {
    test.use({ storageState: meridianStorageState("consultant") });

    test("confirmar o computado: o eixo sai da fila sem mudar o score e aparece como Confirmado pelo revisor (axe + teclado)", async ({
      page,
    }) => {
      const antes = await dataScore();
      expect(antes?.status).toBe("CONTESTED");
      const scoreAntes = antes?.final;

      await openScoring(page);
      await page.getByRole("button", { name: "Revisar e decidir" }).click();
      const dialogo = page.getByRole("dialog", { name: /Override/ });
      await expect(dialogo).toBeVisible();
      const confirmar = dialogo.getByRole("button", {
        name: "Confirmar o computado",
      });
      // Justificativa curta: desabilitado até as 20 letras (mesma regra do override).
      await expect(confirmar).toBeDisabled();
      const campo = dialogo.getByRole("textbox", {
        name: /O que a evidência mostra/,
      });
      await campo.fill("curta");
      await expect(confirmar).toBeDisabled();
      await axeSerious(page, "modal de decisão do eixo");

      // Teclado: foco no campo, digita a justificativa, Tab até confirmar, Enter.
      await campo.fill(RACIONAL);
      await expect(confirmar).toBeEnabled();
      await confirmar.focus();
      await expect(confirmar).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialogo).toBeHidden({ timeout: 30_000 });

      // Score igual, eixo fora do contestado, confirmação registrada, sem override.
      await expect
        .poll(async () => (await dataScore())?.status, { timeout: 30_000 })
        .not.toBe("CONTESTED");
      const depois = await dataScore();
      expect(depois?.final).toBe(scoreAntes);
      expect(await countConfirmations()).toBe(1);
      await expect(
        page.getByText("Confirmado pelo revisor").first()
      ).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("Contestado", { exact: true })).toHaveCount(
        0
      );
    });

    test("finalizado: as decisões travam e só a consultora reabre, com motivo, de volta a REVIEW", async ({
      page,
    }) => {
      await openAs104(page);
      const finalizar = page.getByRole("button", {
        name: "Finalizar assessment",
      });
      await expect(finalizar).toBeEnabled();
      await finalizar.click();
      await page.getByRole("button", { name: "Confirmar finalização" }).click();
      await expect
        .poll(async () => (await as104()).status, { timeout: 30_000 })
        .toBe("FINALISED");

      // Travas: com o assessment finalizado o servidor recusa novas decisões.
      const a = await as104();
      const trava = await callAction(
        page,
        actionId("registerOverride", "overrides.ts"),
        [{ assessmentId: a.id, axis: "DATA", toScore: 55, rationale: RACIONAL }]
      );
      expect(
        trava.ok,
        "registerOverride deveria ser recusado depois de finalizar"
      ).toBe(false);
      const confirmacao = await callAction(
        page,
        actionId("confirmComputed", "confirm.ts"),
        [{ assessmentId: a.id, axis: "DATA", rationale: RACIONAL }]
      );
      expect(
        confirmacao.ok,
        "confirmComputed deveria ser recusado depois de finalizar"
      ).toBe(false);
      expect(await countConfirmations()).toBe(1);

      // Reabrir: botão visível, motivo obrigatório (20+), volta a Em revisão.
      await page.reload();
      const reabrir = page.getByRole("button", { name: "Reabrir assessment" });
      await reabrir.waitFor({ timeout: 90_000 });
      await expect(reabrir).toBeEnabled();
      await axeSerious(page, "botão Reabrir");
      await reabrir.focus();
      await page.keyboard.press("Enter");
      const dialogo = page.getByRole("dialog", { name: /Reabrir assessment/ });
      await expect(dialogo).toBeVisible();
      const confirmar = dialogo.getByRole("button", {
        name: "Confirmar reabertura",
      });
      await expect(confirmar).toBeDisabled();
      const campo = dialogo.getByRole("textbox");
      await campo.fill("curto");
      await expect(confirmar).toBeDisabled();
      await axeSerious(page, "confirmação de reabertura");

      // Esc fecha sem reabrir.
      await page.keyboard.press("Escape");
      await expect(dialogo).toBeHidden();
      expect((await as104()).status).toBe("FINALISED");

      await reabrir.focus();
      await page.keyboard.press("Enter");
      await campo.fill(MOTIVO_REABRIR);
      await expect(confirmar).toBeEnabled();
      const auditoria = await countAudit("meridian.assessment.reopen");
      await confirmar.focus();
      await page.keyboard.press("Enter");
      await expect(dialogo).toBeHidden({ timeout: 30_000 });
      await expect
        .poll(async () => (await as104()).status, { timeout: 30_000 })
        .toBe("REVIEW");
      expect(await countAudit("meridian.assessment.reopen")).toBe(
        auditoria + 1
      );
      // Respostas continuam travadas: a coleta não reabre.
      await expect(
        page.getByRole("button", { name: "Reabrir assessment" })
      ).toHaveCount(0);
    });
  });

  test("REVIEWER e VIEWER: reabrir desabilitado com o motivo; VIEWER sem decidir", async ({
    browser,
  }) => {
    // Estado: assessment finalizado para o botão Reabrir aparecer.
    const a = await as104();
    await withDb((db) =>
      db.meridianAssessment.update({
        where: { id: a.id },
        data: { status: "FINALISED" },
      })
    );
    for (const role of ["REVIEWER", "VIEWER"] as const) {
      await setClaraRole(role);
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      try {
        const page = await context.newPage();
        await loginAs(page, CLARA);
        await openAs104(page);
        const reabrir = page.getByRole("button", {
          name: "Reabrir assessment",
        });
        await expect(
          reabrir,
          `${role}: botão Reabrir deveria existir`
        ).toBeVisible({
          timeout: 60_000,
        });
        await expect(
          reabrir,
          `${role}: Reabrir deveria estar desabilitado`
        ).toBeDisabled();
        await expect(
          page.getByText("Só a consultora reabre o assessment."),
          `${role}: motivo escrito`
        ).toBeVisible();
      } finally {
        await context.close();
        await setClaraRole("REVIEWER");
      }
    }
  });

  test("REVIEWER e VIEWER no eixo contestado: confirmar e override desabilitados com o motivo (quem não tem override.write)", async ({
    browser,
  }) => {
    await resetAs104();
    for (const role of ["VIEWER"] as const) {
      await setClaraRole(role);
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      try {
        const page = await context.newPage();
        await loginAs(page, CLARA);
        await openScoring(page);
        await page.getByRole("button", { name: "Revisar e decidir" }).click();
        const dialogo = page.getByRole("dialog", { name: /Override/ });
        await expect(dialogo).toBeVisible();
        await expect(
          dialogo.getByRole("button", { name: "Confirmar o computado" }),
          `${role}: confirmar`
        ).toBeDisabled();
        await expect(
          dialogo.getByRole("button", { name: "Registrar override" }),
          `${role}: override`
        ).toBeDisabled();
        await expect(
          dialogo.getByText(
            /Só a consultora ou a revisora confirmam o computado/
          )
        ).toBeVisible();
      } finally {
        await context.close();
        await setClaraRole("REVIEWER");
      }
    }
  });
});

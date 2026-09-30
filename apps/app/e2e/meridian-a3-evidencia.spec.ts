import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import dotenv from "dotenv";
import { meridianStorageState } from "./setup/auth.setup";

dotenv.config({ path: ".env.local" });

/**
 * E2E — Meridian A3 · "Ver evidência" em Coleta e no gap (M8).
 *
 * Prova, com banco e Storage reais:
 *  - consultora (`evidence.read`) abre a evidência nas duas telas e cada
 *    abertura grava `meridian.evidence.read` (M8), com alvo pelo id e nunca
 *    pelo nome do arquivo;
 *  - VIEWER (sem `evidence.read`) vê só a contagem: nenhum nome de arquivo
 *    no HTML nem na resposta da action;
 *  - evidência eliminada pela retenção aparece sem botão;
 *  - nome longo é truncado só no visual (`title` e nome acessível completos);
 *  - axe (WCAG 2.2 AA) e teclado.
 *
 * Planta as evidências no AS-104 (Vanta Saúde, `seed:meridian cosmos-dev`) e
 * as remove no fim. O VIEWER é a Clara Nunes rebaixada durante o teste
 * (o seed não tem persona VIEWER) e restaurada em `finally`.
 */

const BUCKET = "meridian-evidence";
const RETENTION_MARKER = "eliminado-por-retencao";
const PASSWORD = process.env.MERIDIAN_SEED_PASSWORD ?? "meridian123";
const VIEWER_EMAIL = "clara.nunes@nebuloz.exemplo";

const NAME_OK = "auditoria-titular-maria-souza.txt";
const NAME_LONG = `${"relatorio-de-conformidade-do-titular-joao-da-silva-".repeat(3)}final.txt`;
const NAME_ELIMINATED_ORIGINAL = "nome-original-eliminado-carlos-lima.pdf";
const ALL_NAMES = [NAME_OK, NAME_LONG, NAME_ELIMINATED_ORIGINAL];

const IDS = {
  ok: "cmea3evidenceok0000000001",
  long: "cmea3evidencelong00000001",
  eliminated: "cmea3evidenceelim00000001",
};

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

async function putObject(path: string, body: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!(base && key)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes."
    );
  }
  await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: BUCKET, public: false }),
  }).catch(() => {});
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "text/plain",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`upload falhou (${res.status}): ${await res.text()}`);
  }
}

async function plantEvidence() {
  const { db, close } = await openDb();
  try {
    const a = await db.meridianAssessment.findFirst({
      where: { code: "AS-104" },
      select: { id: true, tenantId: true },
    });
    if (!a) {
      throw new Error("AS-104 ausente: rode `pnpm seed:meridian cosmos-dev`.");
    }
    const respondent = await db.meridianRespondent.findFirst({
      where: { assessmentId: a.id, tenantId: a.tenantId },
      select: { id: true },
    });
    const response = await db.meridianResponse.findFirst({
      where: { tenantId: a.tenantId, respondentId: respondent?.id },
      select: { id: true },
    });
    if (!(respondent && response)) {
      throw new Error("AS-104 sem respondente/resposta para anexar evidência.");
    }
    await db.meridianEvidence.deleteMany({
      where: { id: { in: Object.values(IDS) } },
    });
    const rows = [
      { id: IDS.ok, fileName: NAME_OK, live: true },
      { id: IDS.long, fileName: NAME_LONG, live: true },
      { id: IDS.eliminated, fileName: NAME_ELIMINATED_ORIGINAL, live: false },
    ];
    for (const r of rows) {
      const storagePath = `${a.tenantId}/${a.id}/${r.id}`;
      if (r.live) {
        await putObject(storagePath, `conteudo ${r.id}`);
      }
      await db.meridianEvidence.create({
        data: {
          id: r.id,
          tenantId: a.tenantId,
          assessmentId: a.id,
          responseId: response.id,
          // Eliminada: mesmo estado que o job de retenção deixa (path e nome
          // viram o marcador).
          storagePath: r.live ? storagePath : RETENTION_MARKER,
          fileName: r.live ? r.fileName : RETENTION_MARKER,
          mimeType: "text/plain",
          sizeBytes: 20,
          uploadedByRespondentId: respondent.id,
        },
      });
    }
    return { tenantId: a.tenantId, assessmentId: a.id };
  } finally {
    await close();
  }
}

async function cleanupEvidence() {
  const { db, close } = await openDb();
  try {
    await db.meridianEvidence.deleteMany({
      where: { id: { in: Object.values(IDS) } },
    });
  } finally {
    await close();
  }
}

async function readAudits(entityId: string) {
  const { db, close } = await openDb();
  try {
    return await db.auditLog.findMany({
      where: { action: "meridian.evidence.read", entityId },
      select: { entityId: true, metadata: true },
    });
  } finally {
    await close();
  }
}

async function setClaraRole(role: "VIEWER" | "REVIEWER") {
  const { db, close } = await openDb();
  try {
    const user = await db.user.findFirst({
      where: { email: VIEWER_EMAIL },
      select: { id: true },
    });
    if (!user) {
      throw new Error(
        "Clara Nunes ausente: rode `pnpm seed:meridian cosmos-dev`."
      );
    }
    await db.meridianMembership.updateMany({
      where: { userId: user.id },
      data: { role },
    });
  } finally {
    await close();
  }
}

async function openColeta(page: Page) {
  await page.goto("/meridian");
  const card = page.getByRole("button", { name: /Vanta Saúde/ }).first();
  await card.waitFor({ timeout: 90_000 });
  await card.click();
  await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
  await page.getByRole("button", { name: /Coleta/ }).click();
}

async function openGap(page: Page) {
  await page.goto("/meridian/registry");
  await page
    .getByRole("button", { name: /Abrir gap/ })
    .filter({ hasText: "Vanta Saúde" })
    .filter({ hasNotText: "Promovido" })
    .first()
    .click();
}

/** Clica e espera a aba aberta por `window.open` (no gesto do clique), que a
 *  action navega para a URL assinada depois da volta do servidor. */
async function clickAndExpectTab(
  context: BrowserContext,
  click: () => Promise<void>
) {
  const [tab] = await Promise.all([context.waitForEvent("page"), click()]);
  await tab.waitForURL(/\/storage\/v1\/object\/sign\/meridian-evidence\//, {
    timeout: 90_000,
    waitUntil: "commit",
  });
  await tab.close();
}

async function assertNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("iframe")
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  expect(serious, `[${label}] ${JSON.stringify(serious, null, 2)}`).toEqual([]);
}

test.describe("Meridian A3 · Ver evidência em Coleta e no gap @meridian", () => {
  // Primeira compilação de cada rota no `next dev` estoura o timeout padrão.
  test.describe.configure({ timeout: 150_000 });
  test.beforeAll(async () => {
    await plantEvidence();
  });
  test.afterAll(async () => {
    await setClaraRole("REVIEWER");
    await cleanupEvidence();
  });

  test.describe("consultora com evidence.read", () => {
    test.use({ storageState: meridianStorageState("consultant") });

    test("Coleta: abre a evidência e grava meridian.evidence.read pelo id (M8)", async ({
      page,
      context,
    }) => {
      await openColeta(page);
      const btn = page.getByRole("button", { name: NAME_OK });
      await expect(btn).toBeVisible();
      const before = (await readAudits(IDS.ok)).length;
      await clickAndExpectTab(context, () => btn.click());
      const after = await readAudits(IDS.ok);
      expect(after.length).toBe(before + 1);
      // Alvo pelo id: o nome do arquivo (pode ter dado pessoal) não vai ao log.
      expect(JSON.stringify(after)).not.toContain("maria-souza");
    });

    test("gap: abre a mesma evidência e grava a segunda entrada (M8)", async ({
      page,
      context,
    }) => {
      await openGap(page);
      const btn = page.getByRole("button", { name: NAME_OK });
      await expect(btn).toBeVisible();
      const before = (await readAudits(IDS.ok)).length;
      await clickAndExpectTab(context, () => btn.click());
      expect((await readAudits(IDS.ok)).length).toBe(before + 1);
    });

    test("evidência eliminada pela retenção aparece sem botão, em Coleta e no gap", async ({
      page,
    }) => {
      for (const open of [openColeta, openGap]) {
        await open(page);
        await expect(page.getByText(/eliminada pela retenção/)).toBeVisible();
        await expect(
          page.getByRole("button", { name: RETENTION_MARKER })
        ).toHaveCount(0);
      }
    });

    test("nome longo: truncado só no visual, title e nome acessível completos", async ({
      page,
    }) => {
      await openColeta(page);
      const btn = page.getByRole("button", { name: NAME_LONG });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute("title", NAME_LONG);
      const box = await btn.boundingBox();
      // maxWidth 240 do nome + ícone + padding: bem abaixo do nome inteiro.
      expect(box?.width ?? 9999).toBeLessThan(340);
    });

    test("teclado: Tab chega ao botão, foco visível, Enter abre", async ({
      page,
      context,
    }) => {
      await openColeta(page);
      const btn = page.getByRole("button", { name: NAME_OK });
      await btn.scrollIntoViewIfNeeded();
      await btn.focus();
      await expect(btn).toBeFocused();
      const before = (await readAudits(IDS.ok)).length;
      await clickAndExpectTab(context, () => page.keyboard.press("Enter"));
      expect((await readAudits(IDS.ok)).length).toBe(before + 1);
    });

    test("axe WCAG 2.2 AA em Coleta e no gap", async ({ page }) => {
      await openColeta(page);
      await expect(page.getByRole("button", { name: NAME_OK })).toBeVisible();
      await assertNoSeriousViolations(page, "coleta");
      await openGap(page);
      await expect(page.getByRole("button", { name: NAME_OK })).toBeVisible();
      await assertNoSeriousViolations(page, "gap");
    });
  });

  test.describe("VIEWER sem evidence.read", () => {
    test("vê só a contagem: nenhum nome no HTML nem na resposta das actions", async ({
      browser,
    }) => {
      await setClaraRole("VIEWER");
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const bodies: string[] = [];
        page.on("response", async (res) => {
          if (res.request().method() === "POST") {
            bodies.push(await res.text().catch(() => ""));
          }
        });
        await page.goto("/sign-in");
        await page.locator('input[type="email"]').fill(VIEWER_EMAIL);
        await page.locator('input[type="password"]').fill(PASSWORD);
        await page.locator('button[type="submit"]').click();
        await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
          timeout: 30_000,
        });

        await page.goto("/meridian");
        await page
          .getByRole("button", { name: /Vanta Saúde/ })
          .first()
          .click();
        await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
        await page.getByRole("button", { name: /Coleta/ }).click();
        await expect(
          page.getByText(/3 evidência\(s\) anexada\(s\)/)
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: /auditoria-titular|relatorio-de-conformidade/,
          })
        ).toHaveCount(0);

        const html = await page.content();
        const wire = bodies.join("\n");
        for (const name of ALL_NAMES) {
          expect(html, `HTML vazou ${name}`).not.toContain(name);
          expect(wire, `resposta vazou ${name}`).not.toContain(name);
        }
        for (const id of Object.values(IDS)) {
          expect(wire, `resposta vazou id ${id}`).not.toContain(id);
        }
      } finally {
        await context.close();
        await setClaraRole("REVIEWER");
      }
    });
  });
});

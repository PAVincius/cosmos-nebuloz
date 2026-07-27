import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";
import { roleStorageState, type SeededRole } from "./setup/auth.setup";

dotenv.config({ path: ".env.local" });

/**
 * RBAC coverage.
 *
 * This tenant used to hold exactly one account, an ADMIN, so requireRole —
 * gating 130+ call sites across ADMIN/STE/RTE/PO/SM — had nobody to fail as
 * and was never exercised end to end. seed-e2e now creates a login per role
 * and globalSetup saves a signed-in state for each.
 *
 * Worth knowing while reading this: RBAC lives entirely in the server actions.
 * No API route calls requireRole, and no Cosmos screen filters affordances by
 * role — a DEV is shown the same "Novo Épico" button as an ADMIN and only
 * finds out on submit. The server does refuse, which is what matters for
 * safety; the second test below pins that refusal.
 */

const ALL_ROLES: SeededRole[] = ["admin", "ste", "rte", "po", "sm", "dev"];

// The per-role states are generated, not committed (they hold session tokens),
// so a suite run without AUTH_TEST=1 has nothing to sign in with. Skip loudly
// rather than fail on a missing file — the reason is the fix.
test.beforeEach(() => {
  test.skip(
    !existsSync(roleStorageState("dev")),
    "Sessões por papel ausentes — rode com AUTH_TEST=1 para gerá-las."
  );
});

test.describe("RBAC — seeded role logins", () => {
  for (const role of ALL_ROLES) {
    test(`${role.toUpperCase()} signs in and reaches the portfolio board`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        storageState: roleStorageState(role),
      });
      const page = await context.newPage();
      try {
        await page.goto("/cosmos/kanban");
        // Not redirected to sign-in, and the board rendered its own header.
        await expect(page).not.toHaveURL(/sign-in/);
        await expect(page.getByText("Kanban de Épicos").first()).toBeVisible({
          timeout: 30_000,
        });
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("RBAC — createEpic is gated", () => {
  // createEpic allows ADMIN | RTE | PO. DEV appears in no requireRole list
  // anywhere, which makes it the role that proves the gate actually closes.
  const DEV_EPIC_TITLE = "Épico proibido para DEV (RBAC)";

  test("DEV is refused and the epic is not created", async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      storageState: roleStorageState("dev"),
    });
    const page = await context.newPage();
    try {
      await page.goto("/cosmos/kanban");
      await page.getByRole("button", { name: "Novo Épico" }).click();
      await page
        .getByPlaceholder("Ex: Antifraude em tempo real…")
        .fill(DEV_EPIC_TITLE);
      await page.getByRole("button", { name: "Criar épico" }).click();

      await expect(
        page.getByText(/Não foi possível criar o épico/i)
      ).toBeVisible({ timeout: 30_000 });

      // The refusal must be real, not just a toast: reload and confirm the
      // board never took the row.
      await page.goto("/cosmos/kanban");
      await page.locator(".card-in").first().waitFor({ timeout: 30_000 });
      await expect(page.getByText(DEV_EPIC_TITLE)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("PO is allowed to create an epic", async ({ browser }) => {
    test.setTimeout(120_000);
    const title = `Épico criado por PO ${Date.now()}`;
    const context = await browser.newContext({
      storageState: roleStorageState("po"),
    });
    const page = await context.newPage();
    // The next seed would wipe it, but a test that depends on someone else
    // tidying up is a test that pollutes every run before that happens.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
      await page.goto("/cosmos/kanban");
      await page.getByRole("button", { name: "Novo Épico" }).click();
      await page.getByPlaceholder("Ex: Antifraude em tempo real…").fill(title);
      await page.getByRole("button", { name: "Criar épico" }).click();

      await expect(page.getByText("Épico criado.")).toBeVisible({
        timeout: 30_000,
      });
      // Proves the negative case above is about the role, not a broken form.
      await page.goto("/cosmos/kanban");
      await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
    } finally {
      await context.close();
      await db.epic.deleteMany({ where: { title } }).catch(() => null);
      await db.$disconnect();
      await pool.end();
    }
  });
});

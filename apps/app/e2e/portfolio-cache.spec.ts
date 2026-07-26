import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";

dotenv.config({ path: ".env.local" });

/**
 * Regression: the Portfolio Kanban must reflect writes that never went through
 * a server action.
 *
 * Epics are written from ~20 places, and only a handful call revalidateTag —
 * the Jira/Azure/Trello/CSV importer, the Linear import, the GitHub sync and
 * the copilot tools all write straight to the database. When listEpics was
 * cached on the tenant id alone with no TTL, those writes were invisible: a
 * user who imported a portfolio kept seeing the pre-import board, and clicking
 * a card opened an epic id that no longer resolved.
 *
 * This test writes an epic the way an importer does — direct database insert,
 * no action, no revalidation — and asserts the board shows it.
 */

const PROBE_TITLE = "Épico importado fora do app (regressão de cache)";

test.describe("Portfolio Kanban — cache reflects out-of-band writes", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("an epic inserted straight into the database appears on the board", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });

    let probeId: string | null = null;
    try {
      // Must be the tenant the auth fixture is signed into. Other tenants exist
      // in this database, and an epic created in one of them would (correctly)
      // never show up on this board.
      const slug = process.env.SEED_TENANT_SLUG ?? "cosmos-dev";
      const tenant = await db.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!tenant) {
        throw new Error(`Tenant "${slug}" not found — run pnpm seed:e2e`);
      }
      const tenantId = tenant.id;

      // Warm the board so a stale cache would have something to serve. Wait on
      // a card, not the header counter — the counter paints before the columns.
      await page.goto("/cosmos/kanban");
      await page.locator(".card-in").first().waitFor({ timeout: 30_000 });
      const before = await page.locator(".card-in").count();

      // The importer's move: straight to the table, no revalidateTag.
      const created = await db.epic.create({
        data: {
          tenantId,
          title: PROBE_TITLE,
          statusId: "BACKLOG",
          lifecycleStatus: "FUNNEL",
          lifecycleOrder: 999,
          order: 999,
        },
        select: { id: true },
      });
      probeId = created.id;

      await page.goto("/cosmos/kanban");
      await expect(page.getByText(PROBE_TITLE)).toBeVisible({
        timeout: 30_000,
      });
      expect(await page.locator(".card-in").count()).toBe(before + 1);
    } finally {
      if (probeId) {
        await db.epic.delete({ where: { id: probeId } }).catch(() => null);
      }
      await db.$disconnect();
      await pool.end();
    }
  });
});

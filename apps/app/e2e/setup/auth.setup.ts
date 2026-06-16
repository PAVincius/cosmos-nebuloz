import { execSync } from "node:child_process";
import { chromium, type FullConfig } from "@playwright/test";
import { database } from "@repo/database";

/**
 * Playwright Global Setup — Auth Session Generator
 *
 * This script creates an authenticated browser session and saves it to
 * e2e/fixtures/auth-session.json for use in @auth tests.
 *
 * Run once before @auth tests:
 *   pnpm exec playwright test --project=setup
 *
 * Or set AUTH_EMAIL and AUTH_PASSWORD env vars and run:
 *   AUTH_TEST=true pnpm test:e2e
 */
async function globalSetup(config: FullConfig) {
  if (!process.env.AUTH_TEST) {
    console.log("⏭  Skipping auth setup (AUTH_TEST not set)");
    return;
  }

  const { baseURL } = config.projects[0].use;
  const email = process.env.E2E_EMAIL ?? "admin@cosmos.local";
  const password = process.env.E2E_PASSWORD ?? "Cosmos@2026!";

  console.log("🌱 Executing seed:e2e before E2E tests...");
  try {
    execSync("pnpm seed:e2e", { stdio: "inherit" });
  } catch (_err) {
    console.warn("⚠️ pnpm seed:e2e had warnings/errors but continuing...");
  }

  console.log(`🔐 Setting up auth session for ${email}...`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/sign-in`);

    // Fill in credentials
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for DB session creation
    await page.waitForTimeout(3000);

    console.log("⚙️ Injecting activeTenantId into DB Session...");
    const user = await database.user.findUnique({ where: { email } });
    if (user) {
      const member = await database.tenantMember.findFirst({
        where: { userId: user.id },
      });
      if (member) {
        await database.session.updateMany({
          where: { userId: user.id },
          data: { activeTenantId: member.tenantId },
        });
        console.log(`✅ activeTenantId set to ${member.tenantId}`);
      }
    }

    // Wait for redirect to dashboard/home
    await page.waitForURL(/dashboard|portfolio|\/$/, { timeout: 30_000 });

    // Save auth state (cookies + localStorage)
    await page.context().storageState({
      path: "./e2e/fixtures/auth-session.json",
    });

    console.log("✅ Auth session saved to e2e/fixtures/auth-session.json");
  } catch (err) {
    console.error("❌ Auth setup failed:", err);
  } finally {
    await browser.close();
  }
}

export default globalSetup;

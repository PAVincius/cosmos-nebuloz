import { execSync } from "node:child_process";
import { chromium, type FullConfig } from "@playwright/test";

// ponytail: no direct DB — requireTenantSession auto-sets activeTenantId on first request

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

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to authenticated area
    await page.waitForURL(/dashboard|portfolio|\/$/, { timeout: 30_000 });

    // Hit dashboard so requireTenantSession runs and auto-sets activeTenantId
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState("networkidle");

    await page.context().storageState({
      path: "./e2e/fixtures/auth-session.json",
    });

    console.log("✅ Auth session saved to e2e/fixtures/auth-session.json");
  } catch (err) {
    console.error("❌ Auth setup failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

export default globalSetup;

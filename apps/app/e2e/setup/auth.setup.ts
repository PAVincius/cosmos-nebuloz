import { execSync } from "node:child_process";
import { type Browser, chromium, type FullConfig } from "@playwright/test";

// ponytail: no direct DB — requireTenantSession auto-sets activeTenantId on first request

/**
 * Roles seeded with real credentials by scripts/seed-e2e.ts. One signed-in
 * storage state is written per role so specs can pick who they act as —
 * without which the persona specs could only probe routes signed out, and RBAC
 * (130+ requireRole call sites over ADMIN/STE/RTE/PO/SM) had nobody to fail as.
 *
 * DEV holds no gate anywhere; it is the role that proves a gate closes.
 */
const ROLES = ["admin", "ste", "rte", "po", "sm", "dev"] as const;
export type SeededRole = (typeof ROLES)[number];

/** Storage state for a seeded role, relative to apps/app. */
export function roleStorageState(role: SeededRole): string {
  return `./e2e/fixtures/roles/${role}.json`;
}

/** The admin state, kept at its original path so existing specs keep working. */
const ADMIN_STATE = "./e2e/fixtures/auth-session.json";

/**
 * As quatro personas de governança do Charter, semeadas por `seed-charter.ts`
 * no tenant `medcore`. Sem sessão própria por papel, os specs de RBAC do
 * Charter (`case.decide`, `policy.publish`, ...) não teriam quem fazer os
 * gates falharem ou passarem — mesmo motivo dos papéis SAFe acima.
 */
const CHARTER_PERSONAS = [
  { role: "compliance", email: "marina.alves@vanta.exemplo" },
  { role: "security", email: "diego.prado@vanta.exemplo" },
  { role: "hr", email: "ana.beatriz@vanta.exemplo" },
  { role: "requester", email: "rafael.lima@vanta.exemplo" },
] as const;
export type CharterPersonaRole = (typeof CHARTER_PERSONAS)[number]["role"];

/** Storage state for a seeded Charter persona, relative to apps/app. */
export function charterStorageState(role: CharterPersonaRole): string {
  return `./e2e/fixtures/charter/${role}.json`;
}

async function signInAndSave(
  browser: Browser,
  opts: {
    baseURL: string;
    email: string;
    password: string;
    paths: string[];
    /** Rota autenticada que dispara `requireTenantSession` e fixa o tenant
     *  ativo antes de gravar o storageState. `/dashboard` para Cosmos; telas
     *  do Charter usam `/charter` para o mesmo efeito nesse módulo. */
    landingPath?: string;
  }
) {
  const { baseURL, email, password, paths, landingPath = "/dashboard" } = opts;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/sign-in`);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard|portfolio|\/$/, { timeout: 30_000 });

    // Hit an authenticated route so requireTenantSession runs and auto-sets
    // activeTenantId
    await page.goto(`${baseURL}${landingPath}`);
    await page.waitForLoadState("networkidle");

    // Drop better-auth's cached session snapshot cookie. It is written at login
    // time — before the first authenticated request sets activeTenantId — so it
    // still carries activeTenantId: null. Left in, tests inherit a tenant-less
    // session and every tenant-scoped query returns empty. Removing it forces
    // the app to read the (correct) active tenant from the DB session row.
    await context.clearCookies({ name: "better-auth.session_data" });

    for (const path of paths) {
      await context.storageState({ path });
    }
  } finally {
    await context.close();
  }
}

async function globalSetup(config: FullConfig) {
  if (!process.env.AUTH_TEST) {
    console.log("⏭  Skipping auth setup (AUTH_TEST not set)");
    return;
  }

  const { baseURL } = config.projects[0].use;
  const password = process.env.E2E_PASSWORD ?? "Cosmos@2026!";

  console.log("🌱 Executing seed:e2e before E2E tests...");
  try {
    execSync("pnpm seed:e2e", { stdio: "inherit" });
  } catch (_err) {
    console.warn("⚠️ pnpm seed:e2e had warnings/errors but continuing...");
  }

  console.log("🌱 Executing seed:charter before E2E tests...");
  try {
    execSync("pnpm seed:charter", { stdio: "inherit" });
  } catch (_err) {
    console.warn("⚠️ pnpm seed:charter had warnings/errors but continuing...");
  }

  const charterPassword = process.env.CHARTER_SEED_PASSWORD ?? "charter123";

  const browser = await chromium.launch();
  try {
    for (const role of ROLES) {
      // E2E_EMAIL still overrides the admin account so an existing runner
      // config keeps pointing wherever it pointed before.
      const email =
        role === "admin"
          ? (process.env.E2E_EMAIL ?? "admin@cosmos.local")
          : `${role}@cosmos.local`;
      const paths =
        role === "admin"
          ? [ADMIN_STATE, roleStorageState(role)]
          : [roleStorageState(role)];

      console.log(`🔐 Signing in ${email} (${role.toUpperCase()})...`);
      await signInAndSave(browser, {
        baseURL: baseURL as string,
        email,
        password,
        paths,
      });
    }
    console.log(`✅ ${ROLES.length} sessões salvas em e2e/fixtures/`);

    for (const persona of CHARTER_PERSONAS) {
      console.log(
        `🔐 Signing in ${persona.email} (Charter/${persona.role.toUpperCase()})...`
      );
      await signInAndSave(browser, {
        baseURL: baseURL as string,
        email: persona.email,
        password: charterPassword,
        paths: [charterStorageState(persona.role)],
        landingPath: "/charter",
      });
    }
    console.log(
      `✅ ${CHARTER_PERSONAS.length} sessões do Charter salvas em e2e/fixtures/charter/`
    );
  } catch (err) {
    console.error("❌ Auth setup failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

export default globalSetup;

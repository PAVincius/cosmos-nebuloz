import { execSync } from "node:child_process";
import { type Browser, chromium, type FullConfig } from "@playwright/test";

// ponytail: no direct DB — requireTenantSession auto-sets activeTenantId on first request

/** Storage state de um papel semeado, relativo a apps/app. */
const fixture = (dir: string, role: string) =>
  `./e2e/fixtures/${dir}/${role}.json`;

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
export const roleStorageState = (role: SeededRole) => fixture("roles", role);

/** The admin state, kept at its original path so existing specs keep working. */
const ADMIN_STATE = "./e2e/fixtures/auth-session.json";

/**
 * As quatro personas de governança do Charter, semeadas por `seed-charter.ts`
 * no tenant `medcore`. Sem sessão própria por papel, os specs de RBAC do
 * Charter (`case.decide`, `policy.publish`, ...) não teriam quem fazer os
 * gates falharem ou passarem — mesmo motivo dos papéis SAFe acima.
 */
const CHARTER_PERSONAS = {
  compliance: "marina.alves@vanta.exemplo",
  security: "diego.prado@vanta.exemplo",
  hr: "ana.beatriz@vanta.exemplo",
  requester: "rafael.lima@vanta.exemplo",
} as const;
export type CharterPersonaRole = keyof typeof CHARTER_PERSONAS;
export const charterStorageState = (role: CharterPersonaRole) =>
  fixture("charter", role);

/**
 * Personas do Meridian, semeadas por `seed-meridian.ts` no tenant do e2e.
 *
 * Sem sessão de consultor, os specs do Meridian só conseguiriam provar o
 * default deny: o admin do e2e recebe o módulo contratado mas nenhum
 * `MeridianMembership`, então ele bate no guard de papel e nunca chega às
 * telas. É a mesma razão das personas do Charter acima — quem prova que o
 * portão abre não pode ser quem prova que ele fecha.
 */
const MERIDIAN_PERSONAS = {
  consultant: "marina.duarte@nebuloz.exemplo",
} as const;
export type MeridianPersonaRole = keyof typeof MERIDIAN_PERSONAS;
export const meridianStorageState = (role: MeridianPersonaRole) =>
  fixture("meridian", role);

/**
 * Persona do tenant `nebuloz-e2e-interno` (`isInternalTenant = true`),
 * semeada por `seed-catalogo-e2e.ts` — único jeito de exercitar o cenário 2
 * do catálogo pós-login (spec 004, US2) sem depender do workspace real do
 * CEO (`seed-nebuloz.ts` é convite, sem senha).
 */
const CATALOGO_PERSONAS = {
  interna: "interno.catalogo@nebuloz.exemplo",
} as const;
export type CatalogoPersonaRole = keyof typeof CATALOGO_PERSONAS;
export const catalogoStorageState = (role: CatalogoPersonaRole) =>
  fixture("catalogo", role);

/** Erro vira aviso: o seed pode já estar aplicado, e abortar aqui jogaria
 *  fora as suítes que não dependem dele. */
const SEEDS = [
  "seed:e2e",
  "seed:charter",
  "seed:meridian cosmos-dev",
  "seed:catalogo-e2e",
] as const;

/**
 * Grupos de persona que dependem de um seed opcional.
 *
 * Sem o seed, as sessões do grupo não são salvas e os specs daquele módulo
 * falham sozinhos, com contexto — em vez de derrubar as suítes SAFe, cujas
 * sessões já foram gravadas antes e seriam jogadas fora por um throw aqui.
 */
const GRUPOS_OPCIONAIS = [
  {
    nome: "Charter",
    dir: "charter",
    personas: CHARTER_PERSONAS,
    landingPath: "/charter",
    envSenha: "CHARTER_SEED_PASSWORD",
    senhaPadrao: "charter123",
    ausente: "seed do medcore ausente?",
  },
  {
    nome: "Meridian",
    dir: "meridian",
    personas: MERIDIAN_PERSONAS,
    landingPath: "/meridian",
    envSenha: "MERIDIAN_SEED_PASSWORD",
    senhaPadrao: "meridian123",
    ausente: "seed ausente?",
  },
  {
    nome: "Catálogo interno",
    dir: "catalogo",
    personas: CATALOGO_PERSONAS,
    landingPath: "/produto",
    envSenha: "CATALOGO_SEED_PASSWORD",
    senhaPadrao: "catalogo123",
    ausente: "seed catalogo-e2e ausente?",
  },
] as const;

async function signInAndSave(
  browser: Browser,
  opts: {
    baseURL: string;
    email: string;
    password: string;
    paths: string[];
    /** Rota autenticada que dispara `requireTenantSession` e fixa o tenant
     *  ativo antes de gravar o storageState. `/cosmos/dashboard` para Cosmos;
     *  telas do Charter usam `/charter` para o mesmo efeito nesse módulo. */
    landingPath?: string;
  }
) {
  const {
    baseURL,
    email,
    password,
    paths,
    landingPath = "/cosmos/dashboard",
  } = opts;
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

  for (const seed of SEEDS) {
    console.log(`🌱 Executing ${seed} before E2E tests...`);
    try {
      execSync(`pnpm ${seed}`, { stdio: "inherit" });
    } catch (_err) {
      console.warn(`⚠️ pnpm ${seed} had warnings/errors but continuing...`);
    }
  }

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

    for (const grupo of GRUPOS_OPCIONAIS) {
      const personas = Object.entries(grupo.personas);
      try {
        for (const [role, email] of personas) {
          console.log(
            `🔐 Signing in ${email} (${grupo.nome}/${role.toUpperCase()})...`
          );
          await signInAndSave(browser, {
            baseURL: baseURL as string,
            email,
            password: process.env[grupo.envSenha] ?? grupo.senhaPadrao,
            paths: [fixture(grupo.dir, role)],
            landingPath: grupo.landingPath,
          });
        }
        console.log(
          `✅ ${personas.length} sessão(ões) do ${grupo.nome} salvas em e2e/fixtures/${grupo.dir}/`
        );
      } catch (err) {
        console.warn(
          `⚠️ Sessões do ${grupo.nome} não salvas (${grupo.ausente}) — demais suítes seguem:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  } catch (err) {
    console.error("❌ Auth setup failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

export default globalSetup;

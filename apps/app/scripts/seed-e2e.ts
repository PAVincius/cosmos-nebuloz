/**
 * scripts/seed-e2e.ts
 *
 * Seed completo para testes E2E. Cria uma empresa simulada com:
 * - Usuário admin + tenant COSMOS Dev (UNIVERSE)
 * - ART + 1 Time dimensionado (5 membros)
 * - 3 Sprints (COMPLETED / ACTIVE / PLANNING)
 * - 1 PI Plan + 4 PI Objectives
 * - 3 Temas Estratégicos → 3 OKRs → 6 Key Results
 * - 3 Épicos → 4 Features em múltiplos status
 * - 6 Stories em todos os status (BACKLOG/TODO/IN_PROGRESS/REVIEW/DONE)
 * - 9 Tasks em todos os status (TODO/IN_PROGRESS/DONE)
 *
 * Idempotente — limpa dados do tenant antes do re-seed.
 *
 * Uso:
 *   cd apps/app
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cosmos_dev" \
 *   BETTER_AUTH_SECRET="cosmos-dev-secret-key-min-32-chars-placeholder" \
 *   BETTER_AUTH_URL="http://localhost:3000" \
 *   npx tsx scripts/seed-e2e.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../../../packages/database/generated";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const E2E_EMAIL    = process.env.E2E_EMAIL    ?? "admin@cosmos.local";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "Cosmos@2026!";
const TENANT_SLUG  = process.env.SEED_TENANT_SLUG ?? "cosmos-dev";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db      = new PrismaClient({ adapter });

const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  session: {
    additionalFields: {
      activeTenantId: { type: "string", nullable: true, input: false },
    },
  },
  secret:  process.env.BETTER_AUTH_SECRET ?? "cosmos-dev-secret-key-min-32-chars-placeholder",
  baseURL: process.env.BETTER_AUTH_URL    ?? "http://localhost:3000",
});

function wsjf(bv: number, tc: number, rr: number, js: number) {
  return Math.round(((bv + tc + rr) / js) * 10) / 10;
}

const addDays  = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addWeeks = (d: Date, w: number) => addDays(d, w * 7);

async function main() {
  console.log("🌱 seed-e2e: Iniciando seed completo para E2E...\n");

  // ─── 1. Usuário ───────────────────────────────────────────────────
  let userId: string;
  const existingUser = await db.user.findUnique({ where: { email: E2E_EMAIL } });
  if (existingUser) {
    userId = existingUser.id;
    console.log(`  ✓ user (já existe) ${E2E_EMAIL}`);
  } else {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(E2E_PASSWORD);
    const user = await db.user.create({
      data: {
        email: E2E_EMAIL,
        name: "Admin E2E",
        emailVerified: true,
        accounts: {
          create: { accountId: E2E_EMAIL, providerId: "credential", password: hashedPassword },
        },
      },
    });
    userId = user.id;
    console.log(`  ✓ user criado ${E2E_EMAIL}`);
  }

  // ─── 2. Tenant ───────────────────────────────────────────────────
  let tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: "COSMOS Dev", slug: TENANT_SLUG, plan: "UNIVERSE", metadata: { seeded: true } },
    });
    console.log(`  ✓ tenant criado ${TENANT_SLUG}`);
  } else {
    await db.tenant.update({ where: { id: tenant.id }, data: { plan: "UNIVERSE" } });
    console.log(`  ✓ tenant (já existe) ${TENANT_SLUG}`);
  }
  const TENANT_ID = tenant.id;

  const membership = await db.tenantMember.findFirst({ where: { userId, tenantId: TENANT_ID } });
  if (!membership) {
    await db.tenantMember.create({ data: { userId, tenantId: TENANT_ID, role: "ADMIN" } });
    console.log(`  ✓ membership ADMIN criado`);
  }

  // ─── 3. Cleanup dados de portfolio e entrega ─────────────────────
  console.log("\n  Limpando dados existentes...");
  await db.task.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.story.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.sprint.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.feature.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.epic.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.keyResult.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.oKR.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.themeART.deleteMany({ where: { theme: { tenantId: TENANT_ID } } });
  await db.strategicTheme.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.pIObjective.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.pIPlan.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.team.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.aRT.deleteMany({ where: { tenantId: TENANT_ID } });
  console.log("  ✓ Cleanup concluído");

  // ─── 4. ART ──────────────────────────────────────────────────────
  const art = await db.aRT.create({
    data: { tenantId: TENANT_ID, name: "Plataforma COSMOS", cadence: 10 },
  });
  console.log(`\n  ✓ ART "${art.name}"`);

  // ─── 5. Time dimensionado ─────────────────────────────────────────
  const team = await db.team.create({
    data: {
      tenantId: TENANT_ID,
      artId: art.id,
      name: "Team Nebula",
      velocity: 40,
      sprintLengthDays: 14,
      members: [
        { name: "Ana Lima",    role: "SM",  skills: ["Scrum", "Kanban", "SAFe Coaching"],         hoursPerWeek: 40 },
        { name: "Bruno Melo",  role: "PO",  skills: ["Product Discovery", "SAFe", "BDD"],         hoursPerWeek: 40 },
        { name: "Carla Nunes", role: "DEV", skills: ["TypeScript", "React", "Next.js"],           hoursPerWeek: 40 },
        { name: "Diego Souza", role: "DEV", skills: ["Node.js", "PostgreSQL", "Prisma"],          hoursPerWeek: 40 },
        { name: "Eva Costa",   role: "DEV", skills: ["TypeScript", "Testing", "Playwright"],      hoursPerWeek: 40 },
      ],
    },
  });
  console.log(`  ✓ Team "${team.name}" (5 membros)`);

  // ─── 6. Sprints ────────────────────────────────────────────────────
  const now = new Date();

  const sprint1 = await db.sprint.create({
    data: {
      tenantId: TENANT_ID, teamId: team.id,
      name: "Sprint 1 — Foundation",
      goal: "Implementar infraestrutura base e auth multi-tenant",
      startDate: addWeeks(now, -4),
      endDate: addWeeks(now, -2),
      status: "COMPLETED",
      capacity: 40,
    },
  });
  const sprint2 = await db.sprint.create({
    data: {
      tenantId: TENANT_ID, teamId: team.id,
      name: "Sprint 2 — Portfolio Core",
      goal: "Entregar temas estratégicos, épicos e OKRs funcionais",
      startDate: addWeeks(now, -2),
      endDate: addWeeks(now, 0),
      status: "ACTIVE",
      capacity: 40,
    },
  });
  const sprint3 = await db.sprint.create({
    data: {
      tenantId: TENANT_ID, teamId: team.id,
      name: "Sprint 3 — AI Features",
      goal: "Iniciar AI Risk Copilot e dependency detection",
      startDate: addWeeks(now, 0),
      endDate: addWeeks(now, 2),
      status: "PLANNING",
      capacity: 40,
    },
  });
  console.log(`  ✓ 3 Sprints (COMPLETED, ACTIVE, PLANNING)`);

  // ─── 7. PI Plan ────────────────────────────────────────────────────
  const piPlan = await db.pIPlan.create({
    data: {
      tenantId: TENANT_ID, artId: art.id,
      name: "PI 2026-Q2",
      startDate: addWeeks(now, -4),
      endDate: addWeeks(now, 6),
    },
  });
  console.log(`  ✓ PI Plan "${piPlan.name}"`);

  await db.pIObjective.createMany({
    data: [
      { tenantId: TENANT_ID, piPlanId: piPlan.id, teamId: team.id, title: "Lançar Portfolio Kanban em produção", businessValue: 9,  isStretch: false, status: "IN_PROGRESS" },
      { tenantId: TENANT_ID, piPlanId: piPlan.id, teamId: team.id, title: "Implementar OKRs de portfolio",       businessValue: 8,  isStretch: false, status: "IN_PROGRESS" },
      { tenantId: TENANT_ID, piPlanId: piPlan.id, teamId: team.id, title: "Zero erros críticos em produção",    businessValue: 10, isStretch: false, status: "IN_PROGRESS" },
      { tenantId: TENANT_ID, piPlanId: piPlan.id, teamId: team.id, title: "AI Risk Copilot MVP",                businessValue: 7,  isStretch: true,  status: "NOT_STARTED" },
    ],
  });
  console.log(`  ✓ 4 PI Objectives (3 committed + 1 stretch)`);

  // ─── 8. Temas Estratégicos + OKRs + Key Results ───────────────────
  console.log("\n  Criando temas estratégicos, OKRs e KRs...");

  const theme1 = await db.strategicTheme.create({
    data: {
      tenantId: TENANT_ID, code: "THEME-001",
      title: "Acelerar time-to-market enterprise",
      description: "Reduzir lead time de épicos críticos para clientes enterprise via SAFe + automação de fluxo.",
      color: "#6366f1", horizon: "2026", themeType: "GROWTH", status: "ACTIVE",
      budgetTotal: 2500000, order: 0,
    },
  });
  const theme2 = await db.strategicTheme.create({
    data: {
      tenantId: TENANT_ID, code: "THEME-002",
      title: "Inovação com IA aplicada ao SAFe",
      description: "AI Copilots em PI Planning, risk scoring e dependency detection.",
      color: "#8b5cf6", horizon: "H1 2026", themeType: "INNOVATION", status: "ACTIVE",
      budgetTotal: 1800000, order: 1,
    },
  });
  const theme3 = await db.strategicTheme.create({
    data: {
      tenantId: TENANT_ID, code: "THEME-003",
      title: "Compliance & Segurança Enterprise",
      description: "LGPD, SOC2, multi-tenant RLS e auditoria completa para vendas enterprise.",
      color: "#ef4444", horizon: "2026", themeType: "COMPLIANCE", status: "APPROVED",
      budgetTotal: 1200000, order: 2,
    },
  });

  await db.themeART.createMany({
    data: [
      { themeId: theme1.id, artId: art.id },
      { themeId: theme2.id, artId: art.id },
      { themeId: theme3.id, artId: art.id },
    ],
  });

  const okrDefs = [
    {
      theme: theme1,
      title: "Reduzir lead time de portfolio em 40%",
      krs: [
        { title: "Lead time médio de épicos",          metric: "Lead time",      baseline: 90, current: 65, target: 54, unit: "dias",     measurementType: "absolute"   as const },
        { title: "Predictability score do portfólio",  metric: "Predictability", baseline: 60, current: 72, target: 90, unit: "%",        measurementType: "percentage" as const },
        { title: "Épicos entregues por PI",             metric: "Throughput",     baseline: 5,  current: 8,  target: 12, unit: "épicos",   measurementType: "absolute"   as const },
      ],
    },
    {
      theme: theme2,
      title: "Lançar 3 features de IA em produção",
      krs: [
        { title: "Features de IA em GA",               metric: "Features GA",    baseline: 0,  current: 1,  target: 3,  unit: "features", measurementType: "absolute"   as const },
        { title: "Adoção de Risk Copilot por RTEs",    metric: "Adoção %",       baseline: 0,  current: 12, target: 50, unit: "%",        measurementType: "percentage" as const },
      ],
    },
    {
      theme: theme3,
      title: "Atingir SOC2 Type II + LGPD compliance pleno",
      krs: [
        { title: "Controles SOC2 implementados",       metric: "Controles SOC2", baseline: 10, current: 18, target: 64, unit: "controles", measurementType: "absolute"  as const },
        { title: "Cobertura de audit log",             metric: "% auditado",     baseline: 0,  current: 45, target: 100, unit: "%",        measurementType: "percentage" as const },
      ],
    },
  ];

  for (const def of okrDefs) {
    const okr = await db.oKR.create({
      data: {
        tenantId: TENANT_ID, type: "portfolio_theme",
        strategicThemeId: def.theme.id,
        title: def.title,
        horizon: "2026",
        status: "ON_TRACK",
      },
    });
    for (const kr of def.krs) {
      await db.keyResult.create({
        data: { tenantId: TENANT_ID, okrId: okr.id, ...kr },
      });
    }
  }
  console.log(`  ✓ 3 Temas + 3 OKRs + 7 Key Results + 3 ThemeART links`);

  // ─── 9. Épicos ────────────────────────────────────────────────────
  console.log("\n  Criando épicos...");

  const epicMain = await db.epic.create({
    data: {
      tenantId: TENANT_ID,
      title: "Portfolio Kanban & OKR Dashboard",
      statusId: "IMPLEMENTING",
      order: 0,
      strategicThemeId: theme1.id,
    },
  });
  const epicAI = await db.epic.create({
    data: {
      tenantId: TENANT_ID,
      title: "AI-Powered Risk Copilot",
      statusId: "ANALYSIS",
      order: 1,
      strategicThemeId: theme2.id,
    },
  });
  const epicSec = await db.epic.create({
    data: {
      tenantId: TENANT_ID,
      title: "SAML SSO & SCIM Provisioning",
      statusId: "BACKLOG",
      order: 2,
      strategicThemeId: theme3.id,
    },
  });
  console.log(`  ✓ 3 Épicos (IMPLEMENTING, ANALYSIS, BACKLOG)`);

  // ─── 10. Features ─────────────────────────────────────────────────
  console.log("\n  Criando features...");

  const featKanban = await db.feature.create({
    data: {
      tenantId: TENANT_ID, epicId: epicMain.id, piPlanId: piPlan.id,
      title: "Portfolio Kanban Board (5 colunas SAFe)",
      statusId: "DONE",
      bv: 20, tc: 13, rr: 5, js: 8,
      wsjfScore: wsjf(20, 13, 5, 8),
      storyPoints: 13,
      assigneeUserId: userId,
      completedAt: addDays(now, -7),
    },
  });
  const featOKR = await db.feature.create({
    data: {
      tenantId: TENANT_ID, epicId: epicMain.id, piPlanId: piPlan.id,
      title: "OKR Dashboard com Key Results",
      statusId: "IMPLEMENTING",
      bv: 13, tc: 8, rr: 5, js: 5,
      wsjfScore: wsjf(13, 8, 5, 5),
      storyPoints: 8,
      assigneeUserId: userId,
    },
  });
  const featRisk = await db.feature.create({
    data: {
      tenantId: TENANT_ID, epicId: epicAI.id, piPlanId: piPlan.id,
      title: "Risk Score Engine baseado em histórico de entregas",
      statusId: "BACKLOG",
      bv: 13, tc: 8, rr: 8, js: 3,
      wsjfScore: wsjf(13, 8, 8, 3),
      storyPoints: 8,
    },
  });
  await db.feature.create({
    data: {
      tenantId: TENANT_ID, epicId: epicSec.id,
      title: "SAML 2.0 IdP Integration (Okta, Azure AD)",
      statusId: "BACKLOG",
      bv: 13, tc: 13, rr: 8, js: 5,
      wsjfScore: wsjf(13, 13, 8, 5),
      storyPoints: 8,
    },
  });
  console.log(`  ✓ 4 Features (DONE, IMPLEMENTING, BACKLOG x2)`);

  // ─── 11. Stories em todos os status ───────────────────────────────
  console.log("\n  Criando stories (todos os status)...");

  const storyDone = await db.story.create({
    data: {
      tenantId: TENANT_ID, featureId: featKanban.id, sprintId: sprint1.id,
      title: "Drag-and-drop entre colunas do Kanban",
      description: "Arrastar épico entre colunas SAFe (Backlog → Review → Analysis → Implementing → Done).",
      acceptanceCriteria: "- DnD funciona em mouse e touch\n- Persiste no banco via server action\n- Optimistic update sem flicker",
      storyPoints: 8, status: "DONE", priority: "critical", order: 0,
      assigneeUserId: userId,
      completedAt: addDays(now, -10),
    },
  });
  const storyReview = await db.story.create({
    data: {
      tenantId: TENANT_ID, featureId: featOKR.id, sprintId: sprint2.id,
      title: "Filtrar OKRs por horizonte (2026, H1, H2)",
      description: "Dropdown para filtrar por horizonte com URL state (searchParams).",
      acceptanceCriteria: "- URL reflete filtro selecionado\n- Reset limpa filtro\n- Funciona sem JS via searchParams",
      storyPoints: 2, status: "REVIEW", priority: "medium", order: 0,
      assigneeUserId: userId,
    },
  });
  const storyInProgress = await db.story.create({
    data: {
      tenantId: TENANT_ID, featureId: featOKR.id, sprintId: sprint2.id,
      title: "Criar/editar OKR via modal",
      description: "Formulário com campos: título, descrição, horizonte, status. Salva via server action.",
      acceptanceCriteria: "- Form valida campos obrigatórios\n- Salva via server action\n- Toast de sucesso/erro\n- Fecha modal após salvar",
      storyPoints: 5, status: "IN_PROGRESS", priority: "critical", order: 1,
      assigneeUserId: userId,
    },
  });
  const storyTodo = await db.story.create({
    data: {
      tenantId: TENANT_ID, featureId: featOKR.id, sprintId: sprint2.id,
      title: "Gráfico de progresso por Key Result",
      description: "Gauge/progress bar mostrando baseline → current → target para cada KR.",
      acceptanceCriteria: "- Gauge visível para cada KR\n- Tooltip com valores numéricos\n- Cor muda com status (verde/amarelo/vermelho)",
      storyPoints: 3, status: "TODO", priority: "high", order: 2,
      assigneeUserId: userId,
    },
  });
  const storyBacklog = await db.story.create({
    data: {
      tenantId: TENANT_ID, featureId: featOKR.id, sprintId: sprint2.id,
      title: "Exibir lista de OKRs agrupados por tema",
      description: "Como LPM, quero ver todos os OKRs agrupados por tema estratégico para priorizar investimentos.",
      acceptanceCriteria: "- Lista carrega em < 2s\n- Agrupamento por tema correto\n- Sem erros de hidratação",
      storyPoints: 3, status: "BACKLOG", priority: "high", order: 3,
    },
  });
  const storyPlanning = await db.story.create({
    data: {
      tenantId: TENANT_ID, featureId: featRisk.id, sprintId: sprint3.id,
      title: "Definir modelo de scoring de riscos SAFe",
      description: "Pesquisar e definir algoritmo base para risk score baseado em histórico de PIs.",
      acceptanceCriteria: "- Documento de decisão arquitetural (ADR) aprovado\n- Modelo validado com dados históricos",
      storyPoints: 3, status: "TODO", priority: "medium", order: 0,
    },
  });
  console.log(`  ✓ 6 Stories (DONE, REVIEW, IN_PROGRESS, TODO x2, BACKLOG)`);

  // ─── 12. Tasks em todos os status ─────────────────────────────────
  console.log("\n  Criando tasks (todos os status)...");

  // Tasks da story IN_PROGRESS — exercita os 3 status de task
  await db.task.createMany({
    data: [
      {
        tenantId: TENANT_ID, storyId: storyInProgress.id,
        title: "Criar schema Zod para formulário de OKR",
        status: "DONE", assigneeUserId: userId, estimateHours: 2,
        completedAt: addDays(now, -2),
      },
      {
        tenantId: TENANT_ID, storyId: storyInProgress.id,
        title: "Implementar server action createOKR / updateOKR",
        status: "IN_PROGRESS", assigneeUserId: userId, estimateHours: 3,
      },
      {
        tenantId: TENANT_ID, storyId: storyInProgress.id,
        title: "Construir componente OKRFormModal",
        status: "IN_PROGRESS", assigneeUserId: userId, estimateHours: 4,
      },
      {
        tenantId: TENANT_ID, storyId: storyInProgress.id,
        title: "Adicionar toast de sucesso/erro com Sonner",
        status: "TODO", estimateHours: 1,
      },
      {
        tenantId: TENANT_ID, storyId: storyInProgress.id,
        title: "Escrever testes E2E do modal de OKR",
        status: "TODO", estimateHours: 2,
      },
    ],
  });

  // Tasks da story TODO
  await db.task.createMany({
    data: [
      {
        tenantId: TENANT_ID, storyId: storyTodo.id,
        title: "Pesquisar biblioteca de gauge/radial para Radix UI",
        status: "DONE", assigneeUserId: userId, estimateHours: 1,
        completedAt: addDays(now, -1),
      },
      {
        tenantId: TENANT_ID, storyId: storyTodo.id,
        title: "Implementar componente KeyResultProgress",
        status: "TODO", estimateHours: 3,
      },
    ],
  });

  // Tasks da story DONE (sprint encerrado)
  await db.task.createMany({
    data: [
      {
        tenantId: TENANT_ID, storyId: storyDone.id,
        title: "Integrar @dnd-kit/core no Portfolio Kanban",
        status: "DONE", assigneeUserId: userId, estimateHours: 4,
        completedAt: addDays(now, -12),
      },
      {
        tenantId: TENANT_ID, storyId: storyDone.id,
        title: "Server action updateEpicStatus com optimistic UI",
        status: "DONE", assigneeUserId: userId, estimateHours: 3,
        completedAt: addDays(now, -11),
      },
    ],
  });

  console.log(`  ✓ 9 Tasks (2 TODO, 2 IN_PROGRESS, 5 DONE)`);

  // ─── Resumo ────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────");
  console.log("🎉 seed-e2e concluído!\n");
  console.log("  Credenciais E2E:");
  console.log(`  Email:    ${E2E_EMAIL}`);
  console.log(`  Senha:    ${E2E_PASSWORD}`);
  console.log(`  Tenant:   COSMOS Dev (${TENANT_SLUG}) — UNIVERSE`);
  console.log("\n  Dados criados:");
  console.log("  • 1 ART  →  1 Time (5 membros dimensionados)");
  console.log("  • 3 Sprints (COMPLETED / ACTIVE / PLANNING)");
  console.log("  • 1 PI Plan  →  4 PI Objectives (3 committed + 1 stretch)");
  console.log("  • 3 Temas Estratégicos  →  3 OKRs  →  7 Key Results");
  console.log("  • 3 Épicos  →  4 Features");
  console.log("  • 6 Stories (todos os status: DONE/REVIEW/IN_PROGRESS/TODO/BACKLOG)");
  console.log("  • 9 Tasks (todos os status: DONE/IN_PROGRESS/TODO)");
  console.log("\n  Variáveis de ambiente para E2E:");
  console.log(`  E2E_EMAIL="${E2E_EMAIL}" E2E_PASSWORD="${E2E_PASSWORD}"`);
  console.log("─────────────────────────────────────────────────────\n");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ seed-e2e falhou:", err);
  process.exit(1);
});

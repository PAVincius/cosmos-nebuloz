// seed-cosmos.mts — demo tenant + strategic themes + epics for the Kanban board.
// Run: pnpm exec tsx scripts/seed-cosmos.mts   (from packages/database)
// Run with: pnpm exec tsx --env-file=.env scripts/seed-cosmos.mts
// Instantiate the client directly (the package index imports "server-only",
// which throws under plain tsx) using the same pg driver adapter Prisma 7 needs.
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

// ART → tone (design-system §4): Payments=blue, Platform=purple, Growth=green, Data&AI=amber
const ART_TONE: Record<string, string> = {
  pay: "blue",
  plat: "purple",
  growth: "green",
  data: "amber",
};
// mock kanban column → real SAFe lifecycle
const LIFECYCLE: Record<string, string> = {
  funnel: "FUNNEL",
  reviewing: "ANALYZING",
  analyzing: "ANALYZING",
  backlog: "PORTFOLIO_BACKLOG",
  implementing: "IMPLEMENTING",
  done: "DONE",
};

// Metadados de portfólio por tema. Sem eles a tela /cosmos/themes abre com todo
// KPI em "—": alocação-alvo, saúde e horizonte são exatamente o que o Strategy
// Map compara. Os alvos somam 100%, invariante que rebalanceThemeTargets impõe.
const THEME_META: Record<
  string,
  {
    target: number;
    health: string;
    horizon: string;
    type: string;
    order: number;
  }
> = {
  "Modernização da Plataforma": {
    target: 25,
    health: "watch",
    horizon: "H1 2026",
    type: "INNOVATION",
    order: 0,
  },
  "Expansão LATAM": {
    target: 20,
    health: "on",
    horizon: "H1 2026",
    type: "GROWTH",
    order: 1,
  },
  "Confiança & Risco": {
    target: 20,
    health: "behind",
    horizon: "H2 2026",
    type: "COMPLIANCE",
    order: 2,
  },
  "Data & AI": {
    target: 15,
    health: "on",
    horizon: "H2 2026",
    type: "INNOVATION",
    order: 3,
  },
  "Enterprise Ready": {
    target: 12,
    health: "on",
    horizon: "2027",
    type: "CUSTOMER_EXPERIENCE",
    order: 4,
  },
  "Eficiência de Custo": {
    target: 8,
    health: "watch",
    horizon: "H1 2026",
    type: "EFFICIENCY",
    order: 5,
  },
};

const EPICS = [
  {
    id: "EP-104",
    col: "funnel",
    title: "Carteira digital multi-moeda",
    theme: "Expansão LATAM",
    art: "pay",
    owner: "Marina Alves",
    wsjf: 11.2,
    size: 34,
    progress: 0,
  },
  {
    id: "EP-118",
    col: "funnel",
    title: "Programa de fidelidade B2B",
    theme: "Data & AI",
    art: "growth",
    owner: "Caio Nunes",
    wsjf: 8.4,
    size: 21,
    progress: 0,
  },
  {
    id: "EP-097",
    col: "reviewing",
    title: "Antifraude em tempo real (ML)",
    theme: "Confiança & Risco",
    art: "data",
    owner: "Letícia Rocha",
    wsjf: 19.6,
    size: 55,
    progress: 6,
    hot: true,
  },
  {
    id: "EP-112",
    col: "reviewing",
    title: "Onboarding self-service KYC",
    theme: "Expansão LATAM",
    art: "pay",
    owner: "Bruno Dias",
    wsjf: 14.1,
    size: 40,
    progress: 10,
  },
  {
    id: "EP-088",
    col: "analyzing",
    title: "Plataforma de eventos unificada",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Helena Souza",
    wsjf: 16.8,
    size: 68,
    progress: 22,
  },
  {
    id: "EP-101",
    col: "analyzing",
    title: "Checkout 1-clique",
    theme: "Eficiência de Custo",
    art: "growth",
    owner: "Diego Lima",
    wsjf: 13.3,
    size: 29,
    progress: 18,
  },
  {
    id: "EP-076",
    col: "backlog",
    title: "Migração core para multi-tenant",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Helena Souza",
    wsjf: 22.4,
    size: 89,
    progress: 0,
    hot: true,
  },
  {
    id: "EP-093",
    col: "backlog",
    title: "Observabilidade ponta-a-ponta",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Rafael Teixeira",
    wsjf: 12.0,
    size: 47,
    progress: 0,
  },
  {
    id: "EP-109",
    col: "backlog",
    title: "Open Finance · agregação",
    theme: "Expansão LATAM",
    art: "pay",
    owner: "Marina Alves",
    wsjf: 15.5,
    size: 52,
    progress: 0,
  },
  {
    id: "EP-061",
    col: "implementing",
    title: "SSO & SCIM Enterprise",
    theme: "Enterprise Ready",
    art: "plat",
    owner: "Rafael Teixeira",
    wsjf: 18.2,
    size: 34,
    progress: 64,
  },
  {
    id: "EP-070",
    col: "implementing",
    title: "Pix recorrente & agendado",
    theme: "Confiança & Risco",
    art: "pay",
    owner: "Bruno Dias",
    wsjf: 20.1,
    size: 42,
    progress: 48,
    hot: true,
  },
  {
    id: "EP-085",
    col: "implementing",
    title: "Copilot de relatórios financeiros",
    theme: "Data & AI",
    art: "data",
    owner: "Letícia Rocha",
    wsjf: 17.0,
    size: 38,
    progress: 31,
  },
  {
    id: "EP-042",
    col: "done",
    title: "FinOps guardrails por ART",
    theme: "Eficiência de Custo",
    art: "data",
    owner: "Letícia Rocha",
    wsjf: 9.8,
    size: 26,
    progress: 100,
  },
  {
    id: "EP-055",
    col: "done",
    title: "Migração para Design System v3",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Helena Souza",
    wsjf: 7.5,
    size: 31,
    progress: 100,
  },
];

// Benefit tracking do tenant demo. Cobre os dois caminhos que a tela precisa
// mostrar: indicador já medido (realização derivada) e indicador ainda sem
// medição, que deve aparecer como "sem dados" e nunca como 0%.
const VALUE_METRICS = [
  {
    epicTitle: "SSO & SCIM Enterprise",
    metricLabel: "Contas enterprise ativadas",
    unit: "contas",
    planned: 40,
    actual: 34,
    status: "tracking",
  },
  {
    epicTitle: "Migração para Design System v3",
    metricLabel: "Tempo de entrega de tela nova",
    unit: "%",
    planned: -30,
    actual: -34,
    status: "done",
  },
  {
    epicTitle: "FinOps guardrails por ART",
    metricLabel: "Desvio de orçamento por ART",
    unit: "%",
    planned: -15,
    actual: -4,
    status: "at-risk",
  },
  {
    epicTitle: "Pix recorrente & agendado",
    metricLabel: "MRR incremental",
    unit: "BRL",
    planned: 250_000,
    actual: null,
    status: "pending",
  },
];

// Sprints fechadas do tenant demo. Sem elas /cosmos/velocity abre com todo KPI
// em "—" e o gráfico não tem o que comparar. `capacity` é o comprometido no
// planejamento, `accepted` é o que o PO aceitou na review — a razão entre os
// dois é predictability (FR-011). Atlas fecha acima do benchmark de 80% e Orion
// abaixo, para que o aviso do AC-003 tenha em quem aparecer.
const TEAMS = [
  { name: "Squad Atlas", color: "#6366f1" },
  { name: "Squad Orion", color: "#f59e0b" },
];

const SPRINTS = [
  { team: "Squad Atlas", n: 10, capacity: 40, completed: 38, accepted: 36 },
  { team: "Squad Atlas", n: 11, capacity: 42, completed: 40, accepted: 38 },
  { team: "Squad Atlas", n: 12, capacity: 40, completed: 36, accepted: 34 },
  { team: "Squad Atlas", n: 13, capacity: 40, completed: 39, accepted: 37 },
  { team: "Squad Orion", n: 10, capacity: 30, completed: 24, accepted: 20 },
  { team: "Squad Orion", n: 11, capacity: 32, completed: 26, accepted: 22 },
  { team: "Squad Orion", n: 12, capacity: 30, completed: 25, accepted: 23 },
  { team: "Squad Orion", n: 13, capacity: 30, completed: 28, accepted: 26 },
];

// Measure & Grow do tenant demo. Dois ciclos por competência, ambos no mesmo
// escopo (Squad Atlas) — é o que dá ciclo anterior comparável: avaliação de
// times diferentes não forma delta. Sem isto /cosmos/measure abre sem radar e
// sem nenhuma variação.
const COMPETENCY_SCORES: { key: string; prev: number; current: number }[] = [
  { key: "TEAM_TECHNICAL_AGILITY", prev: 3.4, current: 3.8 },
  { key: "AGILE_PRODUCT_DELIVERY", prev: 3.5, current: 3.4 },
  { key: "ENTERPRISE_SOLUTION_DELIVERY", prev: 2.6, current: 2.9 },
  { key: "LEAN_PORTFOLIO_MANAGEMENT", prev: 3.2, current: 3.6 },
  { key: "ORGANIZATIONAL_AGILITY", prev: 3.1, current: 3.1 },
  { key: "CONTINUOUS_LEARNING_CULTURE", prev: 2.9, current: 2.6 },
  { key: "LEAN_AGILE_LEADERSHIP", prev: 3.6, current: 3.9 },
];

const COMPETENCY_CYCLES = [
  { at: "2026-02-02T00:00:00Z", field: "prev" as const },
  { at: "2026-06-01T00:00:00Z", field: "current" as const },
];

// Ações de melhoria abertas a partir da avaliação mais recente — sem elas a
// taxa de conclusão do FR-013 não tem denominador. Uma cancelada de propósito,
// para provar que ação abandonada sai do denominador e não derruba a taxa.
const IMPROVEMENT_ACTIONS = [
  {
    title: "Rodar dojo de testes de contrato com o ART Plataforma",
    competency: "TEAM_TECHNICAL_AGILITY",
    status: "IN_PROGRESS",
  },
  {
    title: "Revisar hipótese de valor no PI Planning",
    competency: "AGILE_PRODUCT_DELIVERY",
    status: "OPEN",
  },
  {
    title: "Publicar guia de aprendizagem contínua por trilha",
    competency: "CONTINUOUS_LEARNING_CULTURE",
    status: "DONE",
  },
  {
    title: "Contratar consultoria externa de agilidade",
    competency: "ORGANIZATIONAL_AGILITY",
    status: "CANCELLED",
  },
];

// PI em execução do tenant demo. /cosmos/capacity só desenha a grade time ×
// sprint quando existe PI em PLANNING/COMMITTED/EXECUTING com sprints ligadas a
// ele; sem isto a seção abre em "Sem PI ativo ou sem sprints ainda".
const PI_PLAN = {
  name: "PI 2026.3",
  status: "EXECUTING",
  startDate: "2026-07-06T00:00:00Z",
  endDate: "2026-09-13T00:00:00Z",
};

// Capacidade por sprint do PI ativo. As três faixas do AC-002 da story-032
// estão representadas para que a regra tenha em quem aparecer: <80% verde,
// 80–100% âmbar, >100% vermelho. `actual/expected` é a utilização.
const PI_CAPACITY = [
  { team: "Squad Atlas", n: 14, expected: 40, actual: 30, status: "CLOSED" },
  { team: "Squad Atlas", n: 15, expected: 40, actual: 40, status: "CLOSED" },
  { team: "Squad Atlas", n: 16, expected: 40, actual: 44, status: "ACTIVE" },
  { team: "Squad Orion", n: 14, expected: 30, actual: 21, status: "CLOSED" },
  { team: "Squad Orion", n: 15, expected: 30, actual: 27, status: "CLOSED" },
  { team: "Squad Orion", n: 16, expected: 30, actual: 33, status: "ACTIVE" },
];

// Features comprometidas no PI ativo. Sem elas /cosmos/program abre em "Nenhum
// PI ativo" mesmo com PI Plan, e /cosmos/dependencies não tem o que ligar.
// `epic` é o título de um épico semeado acima; resolvido para id na gravação.
const FEATURES = [
  {
    title: "Isolamento de tenant no core",
    epic: "Migração core para multi-tenant",
    team: "Squad Atlas",
    sprint: 14,
    points: 13,
    statusId: "DONE",
    milestone: false,
  },
  {
    title: "Fila de eventos por tenant",
    epic: "Migração core para multi-tenant",
    team: "Squad Atlas",
    sprint: 15,
    points: 8,
    statusId: "IN_PROGRESS",
    milestone: false,
  },
  {
    title: "Agregação Open Finance",
    epic: "Open Finance · agregação",
    team: "Squad Orion",
    sprint: 15,
    points: 8,
    statusId: "IN_PROGRESS",
    milestone: true,
  },
  {
    title: "Consentimento e revogação",
    epic: "Open Finance · agregação",
    team: "Squad Orion",
    sprint: 16,
    points: 5,
    statusId: "BACKLOG",
    milestone: false,
  },
];

// Bloqueios entre features do PI. Os três estados de boardStatus aparecem para
// que a cor-codificação da story-020 AC-006 tenha em quem aparecer. O grafo é
// acíclico de propósito: createDependency recusa ciclo (story-058 AC-001).
const DEPENDENCIES = [
  {
    blocking: "Isolamento de tenant no core",
    blocked: "Fila de eventos por tenant",
    description: "A fila só pode ser particionada depois do isolamento.",
    boardStatus: "RESOLVED",
    status: "completed",
    criticalPath: false,
  },
  {
    blocking: "Fila de eventos por tenant",
    blocked: "Agregação Open Finance",
    description: "Agregação consome os eventos por tenant.",
    boardStatus: "IN_PROGRESS",
    status: "on-track",
    criticalPath: true,
  },
  {
    blocking: "Agregação Open Finance",
    blocked: "Consentimento e revogação",
    description: "Revogação depende do contrato de agregação estar fechado.",
    boardStatus: "IDENTIFIED",
    status: "at-risk",
    criticalPath: false,
  },
];

// Decision Log do tenant demo. `target` é o título do épico ou do tema semeado
// acima — resolvido para id na hora de gravar.
const DECISIONS = [
  {
    titulo: "Aprovar migração core para multi-tenant",
    tipo: "epic_decision",
    targetType: "epic",
    target: "Migração core para multi-tenant",
    decisao: "approved",
    data: "2026-01-15T14:00:00Z",
    justificativa:
      "Dívida arquitetural bloqueia três iniciativas de receita. Custo de adiar mais um PI supera o investimento.",
    tags: ["tech-debt", "arquitetura"],
    dadosSuporte: { wsjf: 22.4, sizePoints: 89 },
  },
  {
    titulo: "Adiar programa de fidelidade B2B",
    tipo: "epic_decision",
    targetType: "epic",
    target: "Programa de fidelidade B2B",
    decisao: "deferred",
    data: "2026-02-03T10:30:00Z",
    justificativa:
      "Hipótese de valor ainda não validada com clientes. Reavaliar após a pesquisa de churn do trimestre.",
    tags: ["descoberta"],
    dadosSuporte: { wsjf: 8.4 },
  },
  {
    titulo: "Elevar alocação de Confiança & Risco",
    tipo: "theme_decision",
    targetType: "theme",
    target: "Confiança & Risco",
    decisao: "changed",
    data: "2026-03-11T09:00:00Z",
    justificativa:
      "Duas exigências regulatórias entraram no trimestre. Alvo sobe de 15% para 20%, saindo de Eficiência de Custo.",
    tags: ["regulatorio", "alocacao"],
    dadosSuporte: { targetAllocationPctFrom: 15, targetAllocationPctTo: 20 },
  },
  {
    titulo: "Rejeitar antecipação de Open Finance",
    tipo: "epic_decision",
    targetType: "epic",
    target: "Open Finance · agregação",
    decisao: "rejected",
    data: "2026-04-22T16:45:00Z",
    justificativa:
      "Antecipar exigiria tirar time da migração multi-tenant, que é pré-requisito técnico deste mesmo épico.",
    tags: ["dependencia"],
    dadosSuporte: { blockedBy: "Migração core para multi-tenant" },
  },
];

type DevDb = typeof db;

export async function seedDevMembership(devDb: DevDb, tenantId: string) {
  const user = await devDb.user.upsert({
    where: { email: "dev@cosmos.local" },
    update: {},
    create: {
      email: "dev@cosmos.local",
      name: "Admin Cosmos",
      emailVerified: true,
    },
  });
  return devDb.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    update: { role: "ADMIN" },
    create: { tenantId, userId: user.id, role: "ADMIN" },
  });
}

async function main() {
  const tenant = await db.tenant.upsert({
    where: { slug: "cosmos-demo" },
    update: {},
    create: { name: "COSMOS Demo", slug: "cosmos-demo" },
  });
  console.log("tenant:", tenant.id, tenant.slug);
  const devMember = await seedDevMembership(db, tenant.id);

  const epicIdByTitle = new Map<string, string>();
  const themeNames = [...new Set(EPICS.map((e) => e.theme))];
  const themeByName = new Map<string, string>();
  for (const name of themeNames) {
    const meta = THEME_META[name];
    // Re-seed atualiza os metadados: um tema criado por um seed antigo nasceu
    // sem alvo/horizonte e deixaria o Strategy Map em branco para sempre.
    const data = {
      tenantId: tenant.id,
      title: name,
      status: "ACTIVE",
      ...(meta
        ? {
            targetAllocationPct: meta.target,
            healthStatus: meta.health,
            horizon: meta.horizon,
            themeType: meta.type,
            order: meta.order,
          }
        : {}),
    };
    const existing = await db.strategicTheme.findFirst({
      where: { tenantId: tenant.id, title: name },
      select: { id: true },
    });
    const row = existing
      ? await db.strategicTheme.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await db.strategicTheme.create({ data, select: { id: true } });
    themeByName.set(name, row.id);
  }
  console.log("themes:", themeByName.size);

  let n = 0;
  for (const [i, e] of EPICS.entries()) {
    const data = {
      tenantId: tenant.id,
      title: e.title,
      lifecycleStatus: LIFECYCLE[e.col],
      order: i,
      strategicThemeId: themeByName.get(e.theme) ?? null,
      wsjf: e.wsjf,
      sizePoints: e.size,
      hot: e.hot ?? false,
      ownerName: e.owner,
      artId: e.art,
      artTone: ART_TONE[e.art] ?? "accent",
      featureCount: 100,
      doneFeatureCount: e.progress, // progress% = done/total
    };
    const existing = await db.epic.findFirst({
      where: { tenantId: tenant.id, title: e.title },
      select: { id: true },
    });
    const epicRow = existing
      ? await db.epic.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await db.epic.create({ data, select: { id: true } });
    epicIdByTitle.set(e.title, epicRow.id);
    n++;
  }
  console.log("epics upserted:", n);

  // Decision Log. Sem entrada, /cosmos/decisions do tenant demo abre no estado
  // vazio e o export de auditoria não tem o que provar. Cada linha aponta para
  // um épico ou tema realmente semeado acima — decisão órfã não é registro de
  // governança, é ruído.
  let d = 0;
  for (const dec of DECISIONS) {
    const targetId =
      dec.targetType === "epic"
        ? epicIdByTitle.get(dec.target)
        : themeByName.get(dec.target);
    if (!targetId) {
      continue;
    }
    const already = await db.decisionLogEntry.findFirst({
      where: { tenantId: tenant.id, titulo: dec.titulo },
      select: { id: true },
    });
    if (already) {
      continue;
    }
    await db.decisionLogEntry.create({
      data: {
        tenantId: tenant.id,
        titulo: dec.titulo,
        tipo: dec.tipo,
        targetType: dec.targetType,
        targetId,
        decisao: dec.decisao,
        justificativa: dec.justificativa,
        tags: dec.tags,
        dataDecisao: new Date(dec.data),
        decisorId: devMember.userId,
        dadosSuporte: dec.dadosSuporte,
      },
    });
    d++;
  }
  console.log("decisions created:", d);

  let v = 0;
  for (const m of VALUE_METRICS) {
    const epicId = epicIdByTitle.get(m.epicTitle);
    if (!epicId) {
      continue;
    }
    const already = await db.epicValueMetric.findFirst({
      where: { tenantId: tenant.id, epicId, metricLabel: m.metricLabel },
      select: { id: true },
    });
    if (already) {
      continue;
    }
    await db.epicValueMetric.create({
      data: {
        tenantId: tenant.id,
        epicId,
        metricLabel: m.metricLabel,
        unit: m.unit,
        plannedValue: m.planned,
        actualValue: m.actual,
        status: m.status,
        measuredAt: m.actual === null ? null : new Date("2026-07-01T00:00:00Z"),
      },
    });
    v++;
  }
  console.log("value metrics created:", v);

  // ART, times e sprints fechadas com Sprint Review. /cosmos/velocity lê a
  // capacidade comprometida da sprint e o ponto aceito da review; sem review
  // não há numerador de predictability e a tela abre inteira em "—".
  const existingArt = await db.aRT.findFirst({
    where: { tenantId: tenant.id, name: "ART Plataforma" },
    select: { id: true },
  });
  const art =
    existingArt ??
    (await db.aRT.create({
      data: { tenantId: tenant.id, name: "ART Plataforma", status: "ACTIVE" },
      select: { id: true },
    }));

  const teamIdByName = new Map<string, string>();
  for (const t of TEAMS) {
    const existing = await db.team.findFirst({
      where: { tenantId: tenant.id, name: t.name },
      select: { id: true },
    });
    const row = existing
      ? await db.team.update({
          where: { id: existing.id },
          data: { artId: art.id, color: t.color },
          select: { id: true },
        })
      : await db.team.create({
          data: {
            tenantId: tenant.id,
            artId: art.id,
            name: t.name,
            color: t.color,
          },
          select: { id: true },
        });
    teamIdByName.set(t.name, row.id);
  }
  console.log("teams:", teamIdByName.size);

  let sp = 0;
  for (const s of SPRINTS) {
    const teamId = teamIdByName.get(s.team);
    if (!teamId) {
      continue;
    }
    const name = `Sprint ${s.n}`;
    // Sprints de 2 semanas já encerradas; a de maior número é a mais recente,
    // que é a ordem que listRecentSprints (endDate desc) espera.
    const endDate = new Date(Date.UTC(2026, 6, 3 + (s.n - 13) * 14));
    const startDate = new Date(endDate.getTime() - 13 * 24 * 60 * 60 * 1000);
    const data = {
      tenantId: tenant.id,
      teamId,
      name,
      startDate,
      endDate,
      status: "CLOSED",
      capacity: s.capacity,
      velocity: s.completed,
      closedAt: endDate,
    };
    const existing = await db.sprint.findFirst({
      where: { tenantId: tenant.id, teamId, name },
      select: { id: true },
    });
    const sprintRow = existing
      ? await db.sprint.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await db.sprint.create({ data, select: { id: true } });

    const review = {
      completedPoints: s.completed,
      acceptedPoints: s.accepted,
      velocity: s.completed,
      goalMet: s.accepted >= s.capacity * 0.8,
    };
    await db.sprintReview.upsert({
      where: { sprintId: sprintRow.id },
      update: review,
      create: { tenantId: tenant.id, sprintId: sprintRow.id, ...review },
    });
    sp++;
  }
  console.log("closed sprints with review:", sp);

  // Measure & Grow: dois ciclos de avaliação no mesmo escopo, mais as ações de
  // melhoria que saem deles. Escopo fixo em Squad Atlas de propósito — o
  // "ciclo anterior" da tela só compara avaliações do mesmo escopo, e semear
  // ciclos em times diferentes produziria um delta que não descreve ninguém.
  const assessmentScopeId = teamIdByName.get("Squad Atlas");
  const assessmentIdByCompetency = new Map<string, string>();
  let ca = 0;
  if (assessmentScopeId) {
    for (const cycle of COMPETENCY_CYCLES) {
      for (const c of COMPETENCY_SCORES) {
        const assessedAt = new Date(cycle.at);
        const existing = await db.competencyAssessment.findFirst({
          where: {
            tenantId: tenant.id,
            competency: c.key,
            scope: "team",
            scopeId: assessmentScopeId,
            assessedAt,
          },
          select: { id: true },
        });
        const data = {
          tenantId: tenant.id,
          competency: c.key,
          score: c[cycle.field],
          scope: "team",
          scopeId: assessmentScopeId,
          assessedAt,
          assessedById: devMember.userId,
        };
        const row = existing
          ? await db.competencyAssessment.update({
              where: { id: existing.id },
              data,
              select: { id: true },
            })
          : await db.competencyAssessment.create({
              data,
              select: { id: true },
            });
        // O ciclo mais recente é o último do laço, então o mapa termina
        // apontando para a avaliação atual — é nela que a ação se pendura.
        assessmentIdByCompetency.set(c.key, row.id);
        ca++;
      }
    }
  }
  console.log("competency assessments upserted:", ca);

  let ia = 0;
  if (assessmentScopeId) {
    for (const a of IMPROVEMENT_ACTIONS) {
      const already = await db.improvementAction.findFirst({
        where: { tenantId: tenant.id, title: a.title },
        select: { id: true },
      });
      if (already) {
        continue;
      }
      await db.improvementAction.create({
        data: {
          tenantId: tenant.id,
          title: a.title,
          scope: "team",
          scopeId: assessmentScopeId,
          status: a.status,
          source: "manual",
          assessmentId: assessmentIdByCompetency.get(a.competency) ?? null,
        },
      });
      ia++;
    }
  }
  console.log("improvement actions created:", ia);

  // Velocity de referência do time = média das sprints fechadas acima. Sem ela
  // a coluna "Velocity" de /cosmos/capacity abre inteira em "—"; o número é
  // derivado do que já foi semeado, não arbitrado.
  for (const [teamName, teamId] of teamIdByName) {
    const done = SPRINTS.filter((row) => row.team === teamName);
    if (done.length === 0) {
      continue;
    }
    const velocity = Math.round(
      done.reduce((acc, row) => acc + row.completed, 0) / done.length
    );
    await db.team.update({ where: { id: teamId }, data: { velocity } });
  }

  // PI ativo + snapshots de capacidade. Sem isto /cosmos/capacity abre com a
  // grade dizendo "Sem PI ativo" e a regra de faixa da story-032 AC-002 não tem
  // em quem aparecer. As três faixas (verde <80%, âmbar 80–100%, vermelho
  // >100%) estão representadas de propósito.
  const existingPi = await db.pIPlan.findFirst({
    where: { tenantId: tenant.id, artId: art.id, name: PI_PLAN.name },
    select: { id: true },
  });
  const piData = {
    tenantId: tenant.id,
    artId: art.id,
    name: PI_PLAN.name,
    status: PI_PLAN.status,
    startDate: new Date(PI_PLAN.startDate),
    endDate: new Date(PI_PLAN.endDate),
  };
  const piPlan = existingPi
    ? await db.pIPlan.update({
        where: { id: existingPi.id },
        data: piData,
        select: { id: true },
      })
    : await db.pIPlan.create({ data: piData, select: { id: true } });

  const piSprintIdByKey = new Map<string, string>();
  let cap = 0;
  for (const c of PI_CAPACITY) {
    const teamId = teamIdByName.get(c.team);
    if (!teamId) {
      continue;
    }
    const name = `Sprint ${c.n}`;
    const startDate = new Date(Date.UTC(2026, 6, 6 + (c.n - 14) * 14));
    const endDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);
    const sprintData = {
      tenantId: tenant.id,
      teamId,
      piPlanId: piPlan.id,
      name,
      startDate,
      endDate,
      status: c.status,
      capacity: c.expected,
    };
    const existingSprint = await db.sprint.findFirst({
      where: { tenantId: tenant.id, teamId, name },
      select: { id: true },
    });
    const sprintRow = existingSprint
      ? await db.sprint.update({
          where: { id: existingSprint.id },
          data: sprintData,
          select: { id: true },
        })
      : await db.sprint.create({ data: sprintData, select: { id: true } });
    piSprintIdByKey.set(`${c.team}:${c.n}`, sprintRow.id);

    // actualCapacityUtil é entregue/planejado — a mesma razão que a tela
    // mostra, para que número e faixa não possam divergir na origem.
    const snapshot = {
      expectedSpNextSprint: c.expected,
      actualSpDelivered: c.actual,
      actualCapacityUtil: c.actual / c.expected,
      // Determinístico: a sprint de maior número é o snapshot mais recente, que
      // é o que listTeamCapacity mostra na tabela por time (recordedAt desc).
      recordedAt: endDate,
    };
    await db.teamCapacitySnapshot.upsert({
      where: { sprintId_teamId: { sprintId: sprintRow.id, teamId } },
      update: snapshot,
      create: {
        tenantId: tenant.id,
        sprintId: sprintRow.id,
        teamId,
        ...snapshot,
      },
    });
    cap++;
  }
  console.log("PI sprints with capacity snapshot:", cap);

  // Features comprometidas no PI + a célula (time × sprint) de cada uma. A
  // célula mora em PIPlanFeatureAssignment, que é o registro que o Program
  // Board escreve; Feature.assignedTeamId sozinho não tem dimensão de sprint.
  const featureIdByTitle = new Map<string, string>();
  for (const f of FEATURES) {
    const teamId = teamIdByName.get(f.team);
    if (!teamId) {
      continue;
    }
    const featureData = {
      tenantId: tenant.id,
      piPlanId: piPlan.id,
      epicId: epicIdByTitle.get(f.epic) ?? null,
      title: f.title,
      statusId: f.statusId,
      assignedTeamId: teamId,
      storyPoints: f.points,
      milestone: f.milestone,
      progressPct: f.statusId === "DONE" ? 100 : 0,
    };
    const existingFeature = await db.feature.findFirst({
      where: { tenantId: tenant.id, title: f.title },
      select: { id: true },
    });
    const featureRow = existingFeature
      ? await db.feature.update({
          where: { id: existingFeature.id },
          data: featureData,
          select: { id: true },
        })
      : await db.feature.create({ data: featureData, select: { id: true } });
    featureIdByTitle.set(f.title, featureRow.id);

    const sprintId = piSprintIdByKey.get(`${f.team}:${f.sprint}`);
    if (sprintId) {
      await db.pIPlanFeatureAssignment.upsert({
        where: {
          piPlanId_featureId: {
            piPlanId: piPlan.id,
            featureId: featureRow.id,
          },
        },
        update: { teamId, sprintId },
        create: {
          tenantId: tenant.id,
          piPlanId: piPlan.id,
          featureId: featureRow.id,
          teamId,
          sprintId,
          rank: 0,
        },
      });
    }
  }
  console.log("PI features with board cell:", featureIdByTitle.size);

  let dep = 0;
  for (const link of DEPENDENCIES) {
    const blockingFeatureId = featureIdByTitle.get(link.blocking);
    const blockedFeatureId = featureIdByTitle.get(link.blocked);
    if (!(blockingFeatureId && blockedFeatureId)) {
      continue;
    }
    const depData = {
      description: link.description,
      status: link.status,
      boardStatus: link.boardStatus,
      criticalPath: link.criticalPath,
    };
    const existingDep = await db.dependencyLink.findFirst({
      where: { tenantId: tenant.id, blockingFeatureId, blockedFeatureId },
      select: { id: true },
    });
    if (existingDep) {
      await db.dependencyLink.update({
        where: { id: existingDep.id },
        data: depData,
      });
    } else {
      await db.dependencyLink.create({
        data: {
          tenantId: tenant.id,
          blockingFeatureId,
          blockedFeatureId,
          ...depData,
        },
      });
    }
    dep++;
  }
  console.log("dependency links:", dep);

  // Verify the real listEpics query path returns the seeded board.
  const rows = await db.epic.findMany({
    where: { tenantId: tenant.id, lifecycleStatus: { not: "REJECTED" } },
    orderBy: [{ lifecycleStatus: "asc" }, { order: "asc" }],
    select: {
      id: true,
      title: true,
      lifecycleStatus: true,
      wsjf: true,
      sizePoints: true,
      hot: true,
      ownerName: true,
      artTone: true,
      featureCount: true,
      doneFeatureCount: true,
      strategicTheme: { select: { title: true } },
    },
  });
  const byCol: Record<string, number> = {};
  for (const r of rows) {
    byCol[r.lifecycleStatus] = (byCol[r.lifecycleStatus] ?? 0) + 1;
  }
  console.log("board by lifecycle:", byCol);
  const s = rows.find((r) => r.hot) ?? rows[0];
  console.log("sample card:", {
    title: s.title,
    theme: s.strategicTheme?.title,
    wsjf: s.wsjf,
    size: s.sizePoints,
    tone: s.artTone,
    owner: s.ownerName,
    progress: Math.round((s.doneFeatureCount / s.featureCount) * 100),
  });
}

// Guarda de entrypoint: __tests__/seed-cosmos.test.ts importa seedDevMembership
// deste módulo — sem a guarda, `pnpm test` roda o seed no banco real.
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main()
    .then(() => db.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await db.$disconnect();
      process.exit(1);
    });
}

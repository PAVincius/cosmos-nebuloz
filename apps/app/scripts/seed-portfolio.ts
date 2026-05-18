import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../packages/database/generated";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/cosmos_dev",
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? "cosmos-dev";

function wsjf(bv: number, tc: number, rr: number, js: number) {
  return Math.round(((bv + tc + rr) / js) * 10) / 10;
}

// ─── Strategic Themes (SAFe Portfolio) ────────────────────────────────────────

type ThemeSeed = {
  code: string;
  title: string;
  description: string;
  color: string;
  horizon: string;
  themeType: "GROWTH" | "EFFICIENCY" | "INNOVATION" | "COMPLIANCE" | "CUSTOMER_EXPERIENCE";
  status: "DRAFT" | "ANALYSIS" | "APPROVED" | "ACTIVE" | "CLOSING" | "ARCHIVED";
  budgetTotal: number;
  okr: {
    title: string;
    description?: string;
    keyResults: {
      title:           string;
      metric:          string;
      baseline:        number;
      current:         number;
      target:          number;
      unit:            string;
      measurementType: "absolute" | "percentage" | "index" | "rate";
      dataSource?:     string;
    }[];
  };
};

const THEMES: ThemeSeed[] = [
  {
    code: "THEME-001",
    title: "Acelerar time-to-market enterprise",
    description: "Reduzir lead time de épicos críticos para clientes enterprise através de automação e melhoria de fluxo SAFe.",
    color: "#6366f1",
    horizon: "2026",
    themeType: "GROWTH",
    status: "ACTIVE",
    budgetTotal: 2500000,
    okr: {
      title: "Reduzir lead time de portfolio em 40%",
      description: "Acelerar entrega de valor para clientes enterprise via SAFe + AI.",
      keyResults: [
        { title: "Lead time médio de épicos",          metric: "Lead time",          baseline: 90, current: 65, target: 54,  unit: "dias",   measurementType: "absolute",   dataSource: "Jira/COSMOS analytics" },
        { title: "Predictability score do portfólio", metric: "Predictability",     baseline: 60, current: 72, target: 90,  unit: "%",      measurementType: "percentage", dataSource: "PI Planning reports" },
        { title: "Épicos entregues por PI",            metric: "Throughput épicos",  baseline: 5,  current: 8,  target: 12,  unit: "épicos", measurementType: "absolute",   dataSource: "COSMOS portfolio" },
      ],
    },
  },
  {
    code: "THEME-002",
    title: "Inovação com IA aplicada ao SAFe",
    description: "Diferenciação competitiva através de AI Copilots em PI Planning, risk scoring e dependency detection.",
    color: "#8b5cf6",
    horizon: "H1 2026",
    themeType: "INNOVATION",
    status: "ACTIVE",
    budgetTotal: 1800000,
    okr: {
      title: "Lançar 3 features de IA em produção",
      description: "Estabelecer COSMOS como referência em SAFe + AI no mercado brasileiro.",
      keyResults: [
        { title: "Features de IA em GA",                metric: "Features GA",          baseline: 0,  current: 1,  target: 3,  unit: "features", measurementType: "absolute",   dataSource: "Release tracker" },
        { title: "Adoção de Risk Copilot",              metric: "% RTEs ativos",        baseline: 5,  current: 12, target: 70, unit: "%",        measurementType: "percentage", dataSource: "Product analytics" },
        { title: "NPS de features IA",                  metric: "NPS",                  baseline: 20, current: 35, target: 60, unit: "NPS",      measurementType: "index",      dataSource: "In-app survey" },
      ],
    },
  },
  {
    code: "THEME-003",
    title: "Compliance & Segurança Enterprise",
    description: "LGPD, SOC2, multi-tenant RLS e auditoria completa — pré-requisito para vendas enterprise.",
    color: "#ef4444",
    horizon: "2026",
    themeType: "COMPLIANCE",
    status: "APPROVED",
    budgetTotal: 1200000,
    okr: {
      title: "Atingir SOC2 Type II + LGPD compliance pleno",
      description: "Remover bloqueio comercial para clientes enterprise regulados.",
      keyResults: [
        { title: "Controles SOC2 implementados",        metric: "Controles SOC2",        baseline: 10, current: 18, target: 64,  unit: "controles", measurementType: "absolute",   dataSource: "Vanta/Drata" },
        { title: "Cobertura de audit log",              metric: "% entidades auditadas", baseline: 40, current: 60, target: 100, unit: "%",         measurementType: "percentage", dataSource: "COSMOS audit logs" },
        { title: "Tempo de resposta a DSAR",            metric: "Tempo médio resposta",  baseline: 120, current: 96, target: 24, unit: "horas",     measurementType: "absolute",   dataSource: "Privacy queue" },
      ],
    },
  },
  {
    code: "THEME-004",
    title: "Experiência colaborativa em tempo real",
    description: "PI Planning remoto-first com CRDT, presença, comentários e modelos compartilháveis.",
    color: "#10b981",
    horizon: "H2 2026",
    themeType: "CUSTOMER_EXPERIENCE",
    status: "ANALYSIS",
    budgetTotal: 900000,
    okr: {
      title: "Tornar PI Planning remoto-first sem perda de produtividade",
      description: "Permitir cerimônias 100% remotas equiparáveis a presenciais.",
      keyResults: [
        { title: "% PI Plannings remotas",            metric: "% cerimônias remotas",  baseline: 15,  current: 30,  target: 80,  unit: "%",   measurementType: "percentage", dataSource: "PI session logs" },
        { title: "Latência média sync CRDT",          metric: "Sync latency",          baseline: 250, current: 180, target: 80,  unit: "ms",  measurementType: "absolute",   dataSource: "Liveblocks telemetry" },
        { title: "Satisfação RTE pós-cerimônia",      metric: "CSAT RTE",              baseline: 6.5, current: 7.2, target: 9.0, unit: "/10", measurementType: "index",      dataSource: "Post-PI survey" },
      ],
    },
  },
];

const EPICS: {
  title: string;
  statusId: string;
  order: number;
  themeCode?: string;
  features: {
    title: string;
    statusId: string;
    bv: number;
    tc: number;
    rr: number;
    js: number;
    storyPoints: number;
    completedAt?: Date;
  }[];
}[] = [
  {
    title: "AI-Powered Risk Copilot",
    statusId: "IMPLEMENTING",
    order: 0,
    themeCode: "THEME-002",
    features: [
      { title: "Risk score engine baseado em histórico de entregas", statusId: "IMPLEMENTING", bv: 13, tc: 8, rr: 8, js: 3, storyPoints: 8 },
      { title: "Dashboard de riscos por ART em tempo real", statusId: "BACKLOG", bv: 8, tc: 5, rr: 5, js: 2, storyPoints: 5 },
      { title: "Alertas proativos de risco via Knock", statusId: "BACKLOG", bv: 5, tc: 8, rr: 3, js: 2, storyPoints: 3 },
      { title: "Integração com histórico de confidence votes", statusId: "REVIEW", bv: 8, tc: 5, rr: 8, js: 3, storyPoints: 5 },
    ],
  },
  {
    title: "Yjs CRDT Realtime Collaboration Engine",
    statusId: "REVIEW",
    order: 1,
    themeCode: "THEME-004",
    features: [
      { title: "Sync CRDT para edição colaborativa de PI board", statusId: "DONE", bv: 20, tc: 13, rr: 5, js: 8, storyPoints: 13, completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      { title: "Presença de cursors em tempo real no kanban", statusId: "DONE", bv: 8, tc: 5, rr: 2, js: 3, storyPoints: 5, completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { title: "Resolução de conflitos de edição offline-first", statusId: "IMPLEMENTING", bv: 13, tc: 8, rr: 8, js: 8, storyPoints: 8 },
      { title: "Histórico de versões do documento PI", statusId: "BACKLOG", bv: 5, tc: 3, rr: 5, js: 5, storyPoints: 5 },
    ],
  },
  {
    title: "BPMN Enterprise Auditing & Compliance",
    statusId: "ANALYSIS",
    order: 2,
    themeCode: "THEME-003",
    features: [
      { title: "Editor BPMN 2.0 integrado ao workflow de PI", statusId: "ANALYSIS", bv: 8, tc: 5, rr: 13, js: 5, storyPoints: 13 },
      { title: "Audit trail completo de mudanças de processo", statusId: "BACKLOG", bv: 13, tc: 8, rr: 13, js: 5, storyPoints: 8 },
      { title: "Exportação de relatórios BPMN para PDF/XML", statusId: "BACKLOG", bv: 3, tc: 3, rr: 5, js: 2, storyPoints: 3 },
      { title: "Validação automática de conformidade SOX", statusId: "BACKLOG", bv: 13, tc: 13, rr: 20, js: 8, storyPoints: 13 },
    ],
  },
  {
    title: "SAML SSO & SCIM Provisioning",
    statusId: "IMPLEMENTING",
    order: 3,
    themeCode: "THEME-003",
    features: [
      { title: "SAML 2.0 IdP integration (Okta, Azure AD)", statusId: "IMPLEMENTING", bv: 13, tc: 13, rr: 8, js: 5, storyPoints: 8 },
      { title: "SCIM 2.0 auto-provisioning de membros", statusId: "REVIEW", bv: 8, tc: 8, rr: 5, js: 3, storyPoints: 5 },
      { title: "RBAC granular por ART e PI Planning", statusId: "BACKLOG", bv: 13, tc: 5, rr: 8, js: 5, storyPoints: 8 },
      { title: "Multi-tenant SSO com domain-based routing", statusId: "BACKLOG", bv: 20, tc: 8, rr: 5, js: 8, storyPoints: 13 },
    ],
  },
  {
    title: "Turborepo Multi-tenant Core Infrastructure",
    statusId: "DONE",
    order: 4,
    themeCode: "THEME-001",
    features: [
      { title: "RLS policies Postgres para isolamento de tenant", statusId: "DONE", bv: 20, tc: 20, rr: 20, js: 13, storyPoints: 13, completedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
      { title: "Pipeline CI/CD por app no turborepo", statusId: "DONE", bv: 13, tc: 13, rr: 8, js: 5, storyPoints: 8, completedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) },
      { title: "Feature flags por tenant via Flags SDK", statusId: "DONE", bv: 8, tc: 5, rr: 5, js: 3, storyPoints: 5, completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      { title: "Observabilidade centralizada BetterStack", statusId: "DONE", bv: 8, tc: 5, rr: 8, js: 3, storyPoints: 5, completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    title: "Portfolio SAFe Analytics & Flow Metrics",
    statusId: "BACKLOG",
    order: 5,
    themeCode: "THEME-001",
    features: [
      { title: "Flow velocity dashboard (SAFe flow metrics)", statusId: "BACKLOG", bv: 13, tc: 8, rr: 5, js: 5, storyPoints: 8 },
      { title: "Predictability score por ART e PI", statusId: "BACKLOG", bv: 8, tc: 5, rr: 5, js: 3, storyPoints: 5 },
      { title: "Burndown comparativo entre PIs", statusId: "BACKLOG", bv: 5, tc: 3, rr: 3, js: 3, storyPoints: 5 },
      { title: "Exportação de métricas para Excel/CSV", statusId: "BACKLOG", bv: 3, tc: 2, rr: 2, js: 1, storyPoints: 2 },
    ],
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.error(`Tenant com slug "${TENANT_SLUG}" não encontrado. Rode seed-admin antes.`);
    process.exit(1);
  }
  const TENANT_ID = tenant.id;
  console.log(`Seed para tenant: ${tenant.name} (${tenant.id})`);

  // ─── Cleanup existing portfolio data ────────────────────────────────────
  const existing = await prisma.epic.count({ where: { tenantId: TENANT_ID } });
  if (existing > 0) {
    console.log(`Tenant já tem ${existing} épicos. Limpando para re-seed...`);
    await prisma.feature.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.epic.deleteMany({ where: { tenantId: TENANT_ID } });
  }

  await prisma.keyResult.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.oKR.deleteMany({
    where: { tenantId: TENANT_ID, strategicThemeId: { not: null } },
  });
  await prisma.themeART.deleteMany({ where: { theme: { tenantId: TENANT_ID } } });
  await prisma.strategicTheme.deleteMany({ where: { tenantId: TENANT_ID } });

  // ─── Strategic Themes + OKRs + KRs ──────────────────────────────────────
  const themeByCode: Record<string, string> = {};
  let totalThemes = 0;
  let totalOkrs = 0;
  let totalKrs = 0;

  for (let i = 0; i < THEMES.length; i++) {
    const t = THEMES[i];
    const theme = await prisma.strategicTheme.create({
      data: {
        tenantId:    TENANT_ID,
        code:        t.code,
        title:       t.title,
        description: t.description,
        color:       t.color,
        order:       i,
        horizon:     t.horizon,
        themeType:   t.themeType,
        status:      t.status,
        budgetTotal: t.budgetTotal,
      },
    });
    themeByCode[t.code] = theme.id;
    totalThemes++;

    const okr = await prisma.oKR.create({
      data: {
        tenantId:         TENANT_ID,
        type:             "portfolio_theme",
        strategicThemeId: theme.id,
        title:            t.okr.title,
        description:      t.okr.description ?? null,
        horizon:          t.horizon,
        status:           "ON_TRACK",
      },
    });
    totalOkrs++;

    for (const kr of t.okr.keyResults) {
      await prisma.keyResult.create({
        data: {
          tenantId:        TENANT_ID,
          okrId:           okr.id,
          title:           kr.title,
          metric:          kr.metric,
          baseline:        kr.baseline,
          current:         kr.current,
          target:          kr.target,
          unit:            kr.unit,
          measurementType: kr.measurementType,
          dataSource:      kr.dataSource ?? null,
        },
      });
      totalKrs++;
    }

    console.log(`✓ Tema: "${t.title}" (${t.code}, ${t.okr.keyResults.length} KRs)`);
  }

  // ─── Link Themes to existing ARTs (if any) ──────────────────────────────
  const arts = await prisma.aRT.findMany({ where: { tenantId: TENANT_ID } });
  let totalThemeArts = 0;
  if (arts.length > 0) {
    for (const themeId of Object.values(themeByCode)) {
      for (const art of arts) {
        await prisma.themeART.upsert({
          where:  { themeId_artId: { themeId, artId: art.id } },
          update: {},
          create: { themeId, artId: art.id },
        });
        totalThemeArts++;
      }
    }
  }

  // ─── Epics + Features ───────────────────────────────────────────────────
  let totalEpics = 0;
  let totalFeatures = 0;

  for (const epicData of EPICS) {
    const epic = await prisma.epic.create({
      data: {
        tenantId:         TENANT_ID,
        title:            epicData.title,
        statusId:         epicData.statusId,
        order:            epicData.order,
        strategicThemeId: epicData.themeCode ? themeByCode[epicData.themeCode] ?? null : null,
      },
    });
    totalEpics++;

    for (let i = 0; i < epicData.features.length; i++) {
      const f = epicData.features[i];
      const score = wsjf(f.bv, f.tc, f.rr, f.js);
      await prisma.feature.create({
        data: {
          tenantId:    TENANT_ID,
          epicId:      epic.id,
          title:       f.title,
          statusId:    f.statusId,
          bv:          f.bv,
          tc:          f.tc,
          rr:          f.rr,
          js:          f.js,
          wsjfScore:   score,
          storyPoints: f.storyPoints,
          completedAt: f.completedAt ?? null,
        },
      });
      totalFeatures++;
    }

    const themeNote = epicData.themeCode ? ` → ${epicData.themeCode}` : "";
    console.log(`✓ Épico: "${epicData.title}"${themeNote} (${epicData.features.length} features)`);
  }

  console.log(
    `\nSeed completo: ${totalThemes} temas, ${totalOkrs} OKRs, ${totalKrs} KRs, ` +
    `${totalThemeArts} theme-ART links, ${totalEpics} épicos, ${totalFeatures} features`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

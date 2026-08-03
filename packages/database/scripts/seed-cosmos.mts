// seed-cosmos.mts — demo tenant + strategic themes + epics for the Kanban board.
// Run: pnpm exec tsx scripts/seed-cosmos.mts   (from packages/database)
// Run with: pnpm exec tsx --env-file=.env scripts/seed-cosmos.mts
// Instantiate the client directly (the package index imports "server-only",
// which throws under plain tsx) using the same pg driver adapter Prisma 7 needs.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

// ART → tone (design-system §4): Payments=blue, Platform=purple, Growth=green, Data&AI=amber
const ART_TONE: Record<string, string> = { pay: 'blue', plat: 'purple', growth: 'green', data: 'amber' };
// mock kanban column → real SAFe lifecycle
const LIFECYCLE: Record<string, string> = {
  funnel: 'FUNNEL', reviewing: 'ANALYZING', analyzing: 'ANALYZING',
  backlog: 'PORTFOLIO_BACKLOG', implementing: 'IMPLEMENTING', done: 'DONE',
};

// Metadados de portfólio por tema. Sem eles a tela /cosmos/themes abre com todo
// KPI em "—": alocação-alvo, saúde e horizonte são exatamente o que o Strategy
// Map compara. Os alvos somam 100%, invariante que rebalanceThemeTargets impõe.
const THEME_META: Record<string, { target: number; health: string; horizon: string; type: string; order: number }> = {
  'Modernização da Plataforma': { target: 25, health: 'watch', horizon: 'H1 2026', type: 'INNOVATION', order: 0 },
  'Expansão LATAM': { target: 20, health: 'on', horizon: 'H1 2026', type: 'GROWTH', order: 1 },
  'Confiança & Risco': { target: 20, health: 'behind', horizon: 'H2 2026', type: 'COMPLIANCE', order: 2 },
  'Data & AI': { target: 15, health: 'on', horizon: 'H2 2026', type: 'INNOVATION', order: 3 },
  'Enterprise Ready': { target: 12, health: 'on', horizon: '2027', type: 'CUSTOMER_EXPERIENCE', order: 4 },
  'Eficiência de Custo': { target: 8, health: 'watch', horizon: 'H1 2026', type: 'EFFICIENCY', order: 5 },
};

const EPICS = [
  { id: 'EP-104', col: 'funnel', title: 'Carteira digital multi-moeda', theme: 'Expansão LATAM', art: 'pay', owner: 'Marina Alves', wsjf: 11.2, size: 34, progress: 0 },
  { id: 'EP-118', col: 'funnel', title: 'Programa de fidelidade B2B', theme: 'Data & AI', art: 'growth', owner: 'Caio Nunes', wsjf: 8.4, size: 21, progress: 0 },
  { id: 'EP-097', col: 'reviewing', title: 'Antifraude em tempo real (ML)', theme: 'Confiança & Risco', art: 'data', owner: 'Letícia Rocha', wsjf: 19.6, size: 55, progress: 6, hot: true },
  { id: 'EP-112', col: 'reviewing', title: 'Onboarding self-service KYC', theme: 'Expansão LATAM', art: 'pay', owner: 'Bruno Dias', wsjf: 14.1, size: 40, progress: 10 },
  { id: 'EP-088', col: 'analyzing', title: 'Plataforma de eventos unificada', theme: 'Modernização da Plataforma', art: 'plat', owner: 'Helena Souza', wsjf: 16.8, size: 68, progress: 22 },
  { id: 'EP-101', col: 'analyzing', title: 'Checkout 1-clique', theme: 'Eficiência de Custo', art: 'growth', owner: 'Diego Lima', wsjf: 13.3, size: 29, progress: 18 },
  { id: 'EP-076', col: 'backlog', title: 'Migração core para multi-tenant', theme: 'Modernização da Plataforma', art: 'plat', owner: 'Helena Souza', wsjf: 22.4, size: 89, progress: 0, hot: true },
  { id: 'EP-093', col: 'backlog', title: 'Observabilidade ponta-a-ponta', theme: 'Modernização da Plataforma', art: 'plat', owner: 'Rafael Teixeira', wsjf: 12.0, size: 47, progress: 0 },
  { id: 'EP-109', col: 'backlog', title: 'Open Finance · agregação', theme: 'Expansão LATAM', art: 'pay', owner: 'Marina Alves', wsjf: 15.5, size: 52, progress: 0 },
  { id: 'EP-061', col: 'implementing', title: 'SSO & SCIM Enterprise', theme: 'Enterprise Ready', art: 'plat', owner: 'Rafael Teixeira', wsjf: 18.2, size: 34, progress: 64 },
  { id: 'EP-070', col: 'implementing', title: 'Pix recorrente & agendado', theme: 'Confiança & Risco', art: 'pay', owner: 'Bruno Dias', wsjf: 20.1, size: 42, progress: 48, hot: true },
  { id: 'EP-085', col: 'implementing', title: 'Copilot de relatórios financeiros', theme: 'Data & AI', art: 'data', owner: 'Letícia Rocha', wsjf: 17.0, size: 38, progress: 31 },
  { id: 'EP-042', col: 'done', title: 'FinOps guardrails por ART', theme: 'Eficiência de Custo', art: 'data', owner: 'Letícia Rocha', wsjf: 9.8, size: 26, progress: 100 },
  { id: 'EP-055', col: 'done', title: 'Migração para Design System v3', theme: 'Modernização da Plataforma', art: 'plat', owner: 'Helena Souza', wsjf: 7.5, size: 31, progress: 100 },
];

// Benefit tracking do tenant demo. Cobre os dois caminhos que a tela precisa
// mostrar: indicador já medido (realização derivada) e indicador ainda sem
// medição, que deve aparecer como "sem dados" e nunca como 0%.
const VALUE_METRICS = [
  { epicTitle: 'SSO & SCIM Enterprise', metricLabel: 'Contas enterprise ativadas', unit: 'contas', planned: 40, actual: 34, status: 'tracking' },
  { epicTitle: 'Migração para Design System v3', metricLabel: 'Tempo de entrega de tela nova', unit: '%', planned: -30, actual: -34, status: 'done' },
  { epicTitle: 'FinOps guardrails por ART', metricLabel: 'Desvio de orçamento por ART', unit: '%', planned: -15, actual: -4, status: 'at-risk' },
  { epicTitle: 'Pix recorrente & agendado', metricLabel: 'MRR incremental', unit: 'BRL', planned: 250_000, actual: null, status: 'pending' },
];

// Decision Log do tenant demo. `target` é o título do épico ou do tema semeado
// acima — resolvido para id na hora de gravar.
const DECISIONS = [
  {
    titulo: 'Aprovar migração core para multi-tenant', tipo: 'epic_decision', targetType: 'epic',
    target: 'Migração core para multi-tenant', decisao: 'approved', data: '2026-01-15T14:00:00Z',
    justificativa: 'Dívida arquitetural bloqueia três iniciativas de receita. Custo de adiar mais um PI supera o investimento.',
    tags: ['tech-debt', 'arquitetura'], dadosSuporte: { wsjf: 22.4, sizePoints: 89 },
  },
  {
    titulo: 'Adiar programa de fidelidade B2B', tipo: 'epic_decision', targetType: 'epic',
    target: 'Programa de fidelidade B2B', decisao: 'deferred', data: '2026-02-03T10:30:00Z',
    justificativa: 'Hipótese de valor ainda não validada com clientes. Reavaliar após a pesquisa de churn do trimestre.',
    tags: ['descoberta'], dadosSuporte: { wsjf: 8.4 },
  },
  {
    titulo: 'Elevar alocação de Confiança & Risco', tipo: 'theme_decision', targetType: 'theme',
    target: 'Confiança & Risco', decisao: 'changed', data: '2026-03-11T09:00:00Z',
    justificativa: 'Duas exigências regulatórias entraram no trimestre. Alvo sobe de 15% para 20%, saindo de Eficiência de Custo.',
    tags: ['regulatorio', 'alocacao'], dadosSuporte: { targetAllocationPctFrom: 15, targetAllocationPctTo: 20 },
  },
  {
    titulo: 'Rejeitar antecipação de Open Finance', tipo: 'epic_decision', targetType: 'epic',
    target: 'Open Finance · agregação', decisao: 'rejected', data: '2026-04-22T16:45:00Z',
    justificativa: 'Antecipar exigiria tirar time da migração multi-tenant, que é pré-requisito técnico deste mesmo épico.',
    tags: ['dependencia'], dadosSuporte: { blockedBy: 'Migração core para multi-tenant' },
  },
];

type DevDb = typeof db;

export async function seedDevMembership(devDb: DevDb, tenantId: string) {
  const user = await devDb.user.upsert({
    where: { email: 'dev@cosmos.local' },
    update: {},
    create: { email: 'dev@cosmos.local', name: 'Admin Cosmos', emailVerified: true },
  });
  return devDb.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    update: { role: 'ADMIN' },
    create: { tenantId, userId: user.id, role: 'ADMIN' },
  });
}

async function main() {
  const tenant = await db.tenant.upsert({
    where: { slug: 'cosmos-demo' },
    update: {},
    create: { name: 'COSMOS Demo', slug: 'cosmos-demo' },
  });
  console.log('tenant:', tenant.id, tenant.slug);
  const devMember = await seedDevMembership(db, tenant.id);

  const epicIdByTitle = new Map<string, string>();
  const themeNames = [...new Set(EPICS.map((e) => e.theme))];
  const themeByName = new Map<string, string>();
  for (const name of themeNames) {
    const meta = THEME_META[name];
    // Re-seed atualiza os metadados: um tema criado por um seed antigo nasceu
    // sem alvo/horizonte e deixaria o Strategy Map em branco para sempre.
    const data = {
      tenantId: tenant.id, title: name, status: 'ACTIVE',
      ...(meta ? { targetAllocationPct: meta.target, healthStatus: meta.health, horizon: meta.horizon, themeType: meta.type, order: meta.order } : {}),
    };
    const existing = await db.strategicTheme.findFirst({ where: { tenantId: tenant.id, title: name }, select: { id: true } });
    const row = existing
      ? await db.strategicTheme.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.strategicTheme.create({ data, select: { id: true } });
    themeByName.set(name, row.id);
  }
  console.log('themes:', themeByName.size);

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
      artTone: ART_TONE[e.art] ?? 'accent',
      featureCount: 100,
      doneFeatureCount: e.progress, // progress% = done/total
    };
    const existing = await db.epic.findFirst({ where: { tenantId: tenant.id, title: e.title }, select: { id: true } });
    const epicRow = existing
      ? await db.epic.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.epic.create({ data, select: { id: true } });
    epicIdByTitle.set(e.title, epicRow.id);
    n++;
  }
  console.log('epics upserted:', n);

  // Decision Log. Sem entrada, /cosmos/decisions do tenant demo abre no estado
  // vazio e o export de auditoria não tem o que provar. Cada linha aponta para
  // um épico ou tema realmente semeado acima — decisão órfã não é registro de
  // governança, é ruído.
  let d = 0;
  for (const dec of DECISIONS) {
    const targetId = dec.targetType === 'epic' ? epicIdByTitle.get(dec.target) : themeByName.get(dec.target);
    if (!targetId) continue;
    const already = await db.decisionLogEntry.findFirst({ where: { tenantId: tenant.id, titulo: dec.titulo }, select: { id: true } });
    if (already) continue;
    await db.decisionLogEntry.create({
      data: {
        tenantId: tenant.id, titulo: dec.titulo, tipo: dec.tipo, targetType: dec.targetType,
        targetId, decisao: dec.decisao, justificativa: dec.justificativa, tags: dec.tags,
        dataDecisao: new Date(dec.data), decisorId: devMember.userId, dadosSuporte: dec.dadosSuporte,
      },
    });
    d++;
  }
  console.log('decisions created:', d);

  let v = 0;
  for (const m of VALUE_METRICS) {
    const epicId = epicIdByTitle.get(m.epicTitle);
    if (!epicId) continue;
    const already = await db.epicValueMetric.findFirst({ where: { tenantId: tenant.id, epicId, metricLabel: m.metricLabel }, select: { id: true } });
    if (already) continue;
    await db.epicValueMetric.create({
      data: {
        tenantId: tenant.id, epicId, metricLabel: m.metricLabel, unit: m.unit,
        plannedValue: m.planned, actualValue: m.actual, status: m.status,
        measuredAt: m.actual === null ? null : new Date('2026-07-01T00:00:00Z'),
      },
    });
    v++;
  }
  console.log('value metrics created:', v);

  // Verify the real listEpics query path returns the seeded board.
  const rows = await db.epic.findMany({
    where: { tenantId: tenant.id, lifecycleStatus: { not: 'REJECTED' } },
    orderBy: [{ lifecycleStatus: 'asc' }, { order: 'asc' }],
    select: {
      id: true, title: true, lifecycleStatus: true, wsjf: true, sizePoints: true,
      hot: true, ownerName: true, artTone: true, featureCount: true, doneFeatureCount: true,
      strategicTheme: { select: { title: true } },
    },
  });
  const byCol: Record<string, number> = {};
  for (const r of rows) byCol[r.lifecycleStatus] = (byCol[r.lifecycleStatus] ?? 0) + 1;
  console.log('board by lifecycle:', byCol);
  const s = rows.find((r) => r.hot) ?? rows[0];
  console.log('sample card:', {
    title: s.title, theme: s.strategicTheme?.title, wsjf: s.wsjf, size: s.sizePoints,
    tone: s.artTone, owner: s.ownerName, progress: Math.round((s.doneFeatureCount / s.featureCount) * 100),
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

// seed-cosmos.mts — demo tenant + strategic themes + epics for the Kanban board.
// Run: pnpm exec tsx scripts/seed-cosmos.mts   (from packages/database)
// Run with: pnpm exec tsx --env-file=.env scripts/seed-cosmos.mts
// Instantiate the client directly (the package index imports "server-only",
// which throws under plain tsx) using the same pg driver adapter Prisma 7 needs.
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

async function main() {
  const tenant = await db.tenant.upsert({
    where: { slug: 'cosmos-demo' },
    update: {},
    create: { name: 'COSMOS Demo', slug: 'cosmos-demo' },
  });
  console.log('tenant:', tenant.id, tenant.slug);

  const themeNames = [...new Set(EPICS.map((e) => e.theme))];
  const themeByName = new Map<string, string>();
  for (const name of themeNames) {
    const existing = await db.strategicTheme.findFirst({ where: { tenantId: tenant.id, title: name }, select: { id: true } });
    const row = existing ?? (await db.strategicTheme.create({ data: { tenantId: tenant.id, title: name }, select: { id: true } }));
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
    if (existing) await db.epic.update({ where: { id: existing.id }, data });
    else await db.epic.create({ data });
    n++;
  }
  console.log('epics upserted:', n);

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

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });

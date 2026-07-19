# Cosmos Tier 0 — Foundation Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the dev-only kanban scaffolds behind a real seeded dev session, and add the two missing Portfolio-tier screens (Epic Detail, Feature Detail) wired to real tenant-scoped data.

**Architecture:** Follow the existing kanban wiring template — a read-model server action (`requireTenantSession` → tenant-scoped Prisma → view map, wrapped in `safeAction`/`Result<T>`) consumed by a client screen registered in `components/cosmos/screens/registry.tsx`. Detail screens receive the entity id via the `[[...seg]]` route `param`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, better-auth (`@repo/auth/server`), Vitest, cosmos `kit` component library.

## Global Constraints

- All data access MUST go through `requireTenantSession(await headers())` and be scoped by `ctx.tenantId`. Never query cross-tenant. (God node: `auth_server_requiretenantsession`.)
- Mutations MUST call `requireRole([...], ctx)` then `logAudit(ctx.tenantId, {...})` then `revalidateTag(...)`.
- Server actions return `Result<T>` via `safeAction` (`app/(cosmos)/actions/_base` — same as `kanban.ts`).
- Design: system colors green/amber/red reserved for positive / money-alert / critical-negative only; all other accents use `--accent` tokens (RF §8). Use `var(--…)` tokens, never raw hex, in new screens.
- Dev-only code paths MUST hard-throw when `process.env.NODE_ENV === 'production'`.
- Portuguese UI copy, matching existing screens.

---

### Task 1: Real dev session — seed dev user + retire `*Dev` scaffolds

**Files:**
- Modify: `packages/database/scripts/seed-cosmos.mts` (add dev User + TenantMember after tenant upsert)
- Modify: `apps/app/app/(cosmos)/actions/kanban.ts:96-230` (delete `listEpicsDev`, `moveEpicDev`, `createEpicDev`)
- Modify: `apps/app/components/cosmos/screens/kanban.tsx` (drop dev fallback chain → call real actions only)
- Test: `apps/app/__tests__/actions/kanban.test.ts` (update mocks: remove `*Dev` expectations)

**Interfaces:**
- Consumes: `requireTenantSession`, `requireRole` from `@repo/auth/server`; `listEpics`/`moveEpic`/`createEpic` (already real).
- Produces: seeded `dev@cosmos.local` user + `TenantMember{role: ADMIN, tenantId: <cosmos-demo>}`; kanban screen depends only on `listEpics`/`moveEpic`/`createEpic`.

- [ ] **Step 1: Write the failing test** — dev seed produces an ADMIN member for cosmos-demo.

```ts
// packages/database/scripts/__tests__/seed-cosmos.test.ts
import { describe, expect, it, vi } from 'vitest';
import { seedDevMembership } from '../seed-cosmos.mts';

it('seeds an ADMIN dev member for cosmos-demo', async () => {
  const db = { user: { upsert: vi.fn().mockResolvedValue({ id: 'u1' }) },
    tenantMember: { upsert: vi.fn().mockResolvedValue({ id: 'm1', role: 'ADMIN' }) } };
  const m = await seedDevMembership(db as never, 't-demo');
  expect(db.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { email: 'dev@cosmos.local' } }));
  expect(m.role).toBe('ADMIN');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/database && pnpm vitest run scripts/__tests__/seed-cosmos.test.ts`
Expected: FAIL — `seedDevMembership` not exported.

- [ ] **Step 3: Implement `seedDevMembership` and call it in the seed**

```ts
// seed-cosmos.mts — export near the tenant upsert
export async function seedDevMembership(db: typeof database, tenantId: string) {
  const user = await db.user.upsert({
    where: { email: 'dev@cosmos.local' },
    update: {},
    create: { email: 'dev@cosmos.local', name: 'Admin Cosmos', emailVerified: true },
  });
  return db.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    update: { role: 'ADMIN' },
    create: { tenantId, userId: user.id, role: 'ADMIN' },
  });
}
// …and after `console.log('tenant:', tenant.id, tenant.slug);`
await seedDevMembership(database, tenant.id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/database && pnpm vitest run scripts/__tests__/seed-cosmos.test.ts`
Expected: PASS

- [ ] **Step 5: Delete the `*Dev` actions and collapse the kanban fallback**

In `kanban.ts` remove `listEpicsDev`, `moveEpicDev`, `createEpicDev` (and any now-unused imports). In `kanban.tsx` replace the `listEpics → listEpicsDev → MOCK` chain with a direct `listEpics()` call; keep `MOCK` only as the empty-error render guard.

- [ ] **Step 6: Update kanban action tests, run the suite**

Run: `cd apps/app && pnpm vitest run __tests__/actions/kanban.test.ts`
Expected: PASS (no `*Dev` references remain).

- [ ] **Step 7: Seed + typecheck + commit**

```bash
pnpm --filter @repo/database seed:cosmos
cd apps/app && pnpm typecheck
git add -A && git commit -m "feat(cosmos): real dev session, retire kanban dev scaffolds"
```

---

### Task 2: Epic Detail screen (`/cosmos/epic/:id`)

**Files:**
- Create: `apps/app/app/(cosmos)/actions/epics.ts` (`getEpic`)
- Create: `apps/app/components/cosmos/screens/epic-detail.tsx`
- Modify: `apps/app/components/cosmos/screens/registry.tsx` (register `epic`)
- Test: `apps/app/__tests__/actions/epics.test.ts`

**Interfaces:**
- Consumes: `requireTenantSession`, `safeAction`, `Result`, `database`.
- Produces: `getEpic(id: string): Promise<Result<EpicDetail | null>>` where
  `EpicDetail = { id; title; lifecycleStatus; wsjf: number|null; sizePoints: number|null; investScore: number|null; investBreakdown: Record<string,{score:number;rationale:string}>|null; hypothesis: string|null; descriptionMd: string|null; features: {id;title;wsjfScore:number;progressPct:number}[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/actions/epics.test.ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('@repo/auth/server', () => ({ requireTenantSession: vi.fn().mockResolvedValue({ tenantId: 't1' }) }));
vi.mock('@repo/database', () => ({ database: { epic: { findFirst: vi.fn() } } }));
import { database } from '@repo/database';
import { getEpic } from '../../app/(cosmos)/actions/epics';

it('returns tenant-scoped epic with features', async () => {
  (database.epic.findFirst as never as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'e1', title: 'X', lifecycleStatus: 'IMPLEMENTING', wsjf: 12, sizePoints: 8,
    investScore: 70, investBreakdown: null, hypothesis: null, descriptionMd: null,
    features: [{ id: 'f1', title: 'F', wsjfScore: 3, progressPct: 50 }],
  });
  const r = await getEpic('e1');
  expect(r.ok).toBe(true);
  expect(database.epic.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'e1', tenantId: 't1' } }));
  if (r.ok) expect(r.data?.features[0].id).toBe('f1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm vitest run __tests__/actions/epics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getEpic`**

```ts
// app/(cosmos)/actions/epics.ts
'use server';
import { requireTenantSession } from '@repo/auth/server';
import { database } from '@repo/database';
import { headers } from 'next/headers';
import { safeAction, type Result } from './_base';

export type EpicDetail = {
  id: string; title: string; lifecycleStatus: string;
  wsjf: number | null; sizePoints: number | null; investScore: number | null;
  investBreakdown: Record<string, { score: number; rationale: string }> | null;
  hypothesis: string | null; descriptionMd: string | null;
  features: { id: string; title: string; wsjfScore: number; progressPct: number }[];
};

export async function getEpic(id: string): Promise<Result<EpicDetail | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const e = await database.epic.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true, title: true, lifecycleStatus: true, wsjf: true, sizePoints: true,
        investScore: true, investBreakdown: true, hypothesis: true, descriptionMd: true,
        features: { select: { id: true, title: true, wsjfScore: true, progressPct: true }, orderBy: { wsjfScore: 'desc' } },
      },
    });
    return (e as EpicDetail | null) ?? null;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm vitest run __tests__/actions/epics.test.ts`
Expected: PASS

- [ ] **Step 5: Build the screen** (server component; renders INVEST/WSJF big-numbers, hypothesis, features list — reuse `kit` `PageHeader`, `KpiCard`, `SectionCard`, `Progress`, `Badge`, `CopyId`; `<ComingSoon>`-style empty when id missing/not found).

```tsx
// components/cosmos/screens/epic-detail.tsx
import { getEpic } from '@/app/(cosmos)/actions/epics';
import { ComingSoon } from '../shell';
import { Badge, KpiCard, PageHeader, Progress, SectionCard } from '../kit';

export default async function EpicDetailScreen({ param }: { param?: string }) {
  if (!param) return <ComingSoon id="epic" />;
  const res = await getEpic(param);
  if (!res.ok || !res.data) return <ComingSoon id="epic" />;
  const e = res.data;
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Portfolio · Épico" title={e.title}
        meta={<><Badge tone="accent">{e.lifecycleStatus}</Badge>{e.wsjf != null && <Badge tone="green" dot>WSJF {e.wsjf}</Badge>}</>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 18 }}>
        <KpiCard icon="trendingUp" tone="accent" label="WSJF" value={e.wsjf ?? '—'} />
        <KpiCard icon="target" tone="green" label="INVEST" value={e.investScore ?? '—'} unit="/100" />
        <KpiCard icon="layers" tone="purple" label="Job Size" value={e.sizePoints ?? '—'} unit="SP" />
      </div>
      <SectionCard title="Features" subtitle={`${e.features.length} itens`} icon="grid" tone="accent" bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {e.features.map(f => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{f.title}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>WSJF {f.wsjfScore}</span>
              <Progress value={f.progressPct} tone="accent" />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 6: Register + typecheck**

Add `import EpicDetailScreen from './epic-detail';` and `epic: EpicDetailScreen,` to `registry.tsx`.
Run: `cd apps/app && pnpm typecheck`
Expected: no errors in `epic-detail`/`epics`/`registry`.

- [ ] **Step 7: Verify in browser + commit**

Navigate `http://localhost:3012/cosmos/epic/<seeded-epic-id>` — renders header + KPIs + features, no console errors beyond CSP/posthog noise.

```bash
git add -A && git commit -m "feat(cosmos): Epic Detail screen wired to real data"
```

---

### Task 3: Feature Detail screen (`/cosmos/feature/:id`)

**Files:**
- Modify: `apps/app/app/(cosmos)/actions/epics.ts` (add `getFeature`)
- Create: `apps/app/components/cosmos/screens/feature-detail.tsx`
- Modify: `apps/app/components/cosmos/screens/registry.tsx` (register `feature`)
- Test: `apps/app/__tests__/actions/epics.test.ts` (add `getFeature` case)

**Interfaces:**
- Produces: `getFeature(id: string): Promise<Result<FeatureDetail | null>>` where
  `FeatureDetail = { id; title; statusId; bv; tc; rr; js; wsjfScore: number; storyPoints: number; progressPct: number; acceptanceCriteria: string[]; epicId: string|null }`.

- [ ] **Step 1: Write the failing test**

```ts
it('returns tenant-scoped feature', async () => {
  (database as never as { feature: { findFirst: ReturnType<typeof vi.fn> } }).feature = { findFirst: vi.fn().mockResolvedValue({
    id: 'f1', title: 'F', statusId: 'IN_PROGRESS', bv: 8, tc: 5, rr: 3, js: 2,
    wsjfScore: 8, storyPoints: 5, progressPct: 40, acceptanceCriteria: ['a'], epicId: 'e1' }) };
  const r = await getFeature('f1');
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data?.wsjfScore).toBe(8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm vitest run __tests__/actions/epics.test.ts -t feature`
Expected: FAIL — `getFeature` undefined.

- [ ] **Step 3: Implement `getFeature`**

```ts
export type FeatureDetail = {
  id: string; title: string; statusId: string; bv: number; tc: number; rr: number; js: number;
  wsjfScore: number; storyPoints: number; progressPct: number; acceptanceCriteria: string[]; epicId: string | null;
};
export async function getFeature(id: string): Promise<Result<FeatureDetail | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const f = await database.feature.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, title: true, statusId: true, bv: true, tc: true, rr: true, js: true,
        wsjfScore: true, storyPoints: true, progressPct: true, acceptanceCriteria: true, epicId: true },
    });
    if (!f) return null;
    return { ...f, acceptanceCriteria: Array.isArray(f.acceptanceCriteria) ? (f.acceptanceCriteria as string[]) : [] };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm vitest run __tests__/actions/epics.test.ts`
Expected: PASS

- [ ] **Step 5: Build `FeatureDetailScreen`** (WSJF breakdown BV/TC/RR/JS as `KpiCard`s, acceptance criteria list, progress, link back to parent epic via `useNav`). Mirror the Epic Detail structure; `<ComingSoon id="feature" />` guards.

- [ ] **Step 6: Register + typecheck**

Add `feature: FeatureDetailScreen,` to `registry.tsx`. Run: `cd apps/app && pnpm typecheck` → clean.

- [ ] **Step 7: Verify in browser + commit**

Navigate `http://localhost:3012/cosmos/feature/<seeded-feature-id>`; renders. Commit:

```bash
git add -A && git commit -m "feat(cosmos): Feature Detail screen wired to real data"
```

---

### Task 4: Design-token pass on new screens

**Files:**
- Modify: `apps/app/components/cosmos/screens/{epic-detail,feature-detail}.tsx`

- [ ] **Step 1: Audit** — grep the two new files for raw hex / rgb literals:

Run: `cd apps/app && grep -nE '#[0-9a-fA-F]{3,6}|rgb\(' components/cosmos/screens/epic-detail.tsx components/cosmos/screens/feature-detail.tsx`
Expected: no matches (all colors via `var(--…)` tokens). Fix any hit by swapping to the nearest existing token in `cosmos-theme.css`.

- [ ] **Step 2: Biome + commit**

```bash
cd apps/app && pnpm exec biome check --write components/cosmos/screens/epic-detail.tsx components/cosmos/screens/feature-detail.tsx
git add -A && git commit -m "style(cosmos): token-only colors in detail screens"
```

---

## Self-Review

- **Spec coverage:** Task 1 = INDEX gap "dev auth" + RF §9 tier-0 foundation. Tasks 2–3 = RF-09 (Epic INVEST/WSJF breakdown + features) and Feature Detail (RF §2.4). Task 4 = RF §8 color rule. Wiring the 8 static screens + creation modals are **explicitly deferred to Tier 1+ plans** (see INDEX) — not in scope here.
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `EpicDetail`/`FeatureDetail`/`Result` names match across action + screen + tests. `getEpic`/`getFeature` signatures identical in Interfaces and implementation.

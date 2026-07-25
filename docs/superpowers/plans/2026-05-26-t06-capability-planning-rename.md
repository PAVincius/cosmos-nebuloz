# T06 — Capability Planning Reescopo (ex-Synergy Detection) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Reposicionar feature de Synergy Detection (que identifica pares/grupos de indivíduos) para Capability Planning (gaps técnicos agregados por time, sem nomear indivíduos). Compliance com GDPR/LGPD + reduz risco cultural de monitoramento individual.

**Architecture:**
- Manter dados de TaskAssignee + PairSynergy/GroupSynergy no banco (alimentam analytics internos)
- UI surfaceada **só** mostra agregado por time/ART, nunca por pessoa
- Nova entidade `CapabilityGap` para skills do time vs demanda do backlog
- Output: "Time X precisa de skill ML antes do PI" não "Pessoa Y precisa pair com Z"

**Tech Stack:** Prisma, Next.js Server Actions, recharts (matrix viz), Zod.

**Estado atual:**
- `flow-intelligence/synergy.ts`: server action
- `flow-intelligence/synergy-utils.ts`: utils
- `analytics/flow/components/synergy-matrix.tsx`: matriz com nomes (REMOVER)
- `analytics/flow/components/synergy-tab.tsx`: tab visível (RENOMEAR)
- Schema: `PairSynergy`, `GroupSynergy`, `TaskAssignee` (mantém para uso interno)
- Falta: nova UI, nova action, deprecation da UI antiga, possível flag/setting

---

## File Structure

```
apps/app/app/actions/flow-intelligence/
  synergy.ts                    DEPRECATE: marcar e remover exports
  synergy-utils.ts              KEEP: continua útil para algoritmo interno
  capability-planning/
    compute-gaps.ts             NEW: algoritmo S(t,p) por time + iniciativa
    capability-schema.ts        NEW: tipos + Zod
    team-capability-profile.ts  NEW: agrega skills por time
    initiative-demand.ts        NEW: estima demanda técnica de Epic/Feature

apps/app/app/(authenticated)/analytics/flow/components/
  synergy-tab.tsx               DELETE: substituir
  synergy-matrix.tsx            DELETE: indivíduos não aparecem mais
  capability-tab.tsx            NEW: novo tab "Team Capability"
  capability-matrix.tsx         NEW: matrix time × skill (não pessoa × pessoa)
  capability-gap-card.tsx       NEW: card por gap detectado

packages/database/prisma/schema/team-capacity.prisma  MODIFY: deprecation comments + opcional novo CapabilityGap model

apps/app/__tests__/actions/flow-intelligence/
  synergy.test.ts               DELETE
  capability-planning.test.ts   NEW
```

---

## Task 1: Capability schema + types

Files:
- Create: `apps/app/app/actions/flow-intelligence/capability-planning/capability-schema.ts`

Step 1: Definir tipos

```typescript
import { z } from "zod";

export const TASK_TYPES = ["backend", "frontend", "ml", "infra", "qa", "data", "design"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const teamCapabilitySchema = z.object({
  teamId: z.string(),
  artId: z.string().nullable(),
  capabilities: z.record(z.enum(TASK_TYPES), z.object({
    deliveredSp: z.number().min(0),
    avgCycleTimeHours: z.number().min(0),
    confidenceLevel: z.number().min(0).max(1),
  })),
  windowSprints: z.number().int().positive(),
});

export type TeamCapability = z.infer<typeof teamCapabilitySchema>;

export const initiativeDemandSchema = z.object({
  initiativeId: z.string(),
  initiativeType: z.enum(["epic", "feature"]),
  demand: z.record(z.enum(TASK_TYPES), z.number().min(0).max(1)),
});

export type InitiativeDemand = z.infer<typeof initiativeDemandSchema>;

export const capabilityGapSchema = z.object({
  teamId: z.string(),
  initiativeId: z.string(),
  initiativeType: z.enum(["epic", "feature"]),
  overallScore: z.number(),
  gapsByCategory: z.record(z.enum(TASK_TYPES), z.object({
    demand: z.number(),
    capability: z.number(),
    gap: z.number(),
    weight: z.number(),
  })),
  recommendation: z.string(),
});

export type CapabilityGap = z.infer<typeof capabilityGapSchema>;
```

Step 2: Commit `feat(capability): schema for team capability + initiative demand + gap`

---

## Task 2: Team capability profile (agregado, sem indivíduos)

Files:
- Create: `apps/app/app/actions/flow-intelligence/capability-planning/team-capability-profile.ts`

Step 1: Failing test

```typescript
import { computeTeamCapability } from "@/app/actions/flow-intelligence/capability-planning/team-capability-profile";

describe("team capability profile", () => {
  it("aggregates by taskType across team without naming individuals", async () => {
    const profile = await computeTeamCapability({ tenantId: "t", teamId: "tm_1", windowSprints: 5 });
    expect(profile.capabilities).toBeDefined();
    expect(profile.capabilities.backend?.deliveredSp).toBeGreaterThanOrEqual(0);
    expect((profile as any).members).toBeUndefined();
  });
});
```

Step 2: Implement

```typescript
import { database } from "@repo/database";
import { type TaskType, TASK_TYPES } from "./capability-schema";

export async function computeTeamCapability(args: {
  tenantId: string;
  teamId: string;
  windowSprints: number;
}) {
  const recentSprints = await database.sprint.findMany({
    where: { tenantId: args.tenantId, teamId: args.teamId, status: "COMPLETED" },
    orderBy: { endDate: "desc" },
    take: args.windowSprints,
    select: { id: true },
  });
  const sprintIds = recentSprints.map((s) => s.id);
  if (sprintIds.length === 0) {
    return { teamId: args.teamId, artId: null, capabilities: {}, windowSprints: args.windowSprints };
  }

  const tasks = await database.task.findMany({
    where: {
      tenantId: args.tenantId,
      story: { sprintId: { in: sprintIds } },
      status: "DONE",
      taskType: { not: null },
    },
    select: { taskType: true, actualSp: true, estimatedSp: true, createdAt: true, completedAt: true },
  });

  const byType: Record<string, { count: number; sp: number; cycleHours: number[] }> = {};
  for (const t of tasks) {
    if (!t.taskType) continue;
    if (!byType[t.taskType]) byType[t.taskType] = { count: 0, sp: 0, cycleHours: [] };
    byType[t.taskType].count++;
    byType[t.taskType].sp += t.actualSp ?? t.estimatedSp ?? 0;
    if (t.completedAt) {
      const hours = (t.completedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
      byType[t.taskType].cycleHours.push(hours);
    }
  }

  const capabilities: Record<string, { deliveredSp: number; avgCycleTimeHours: number; confidenceLevel: number }> = {};
  for (const k of TASK_TYPES) {
    const stats = byType[k];
    if (!stats || stats.count === 0) continue;
    const avgCycle = stats.cycleHours.length > 0
      ? stats.cycleHours.reduce((a, b) => a + b, 0) / stats.cycleHours.length
      : 0;
    const confidence = Math.min(1, stats.count / 20);
    capabilities[k] = {
      deliveredSp: stats.sp,
      avgCycleTimeHours: avgCycle,
      confidenceLevel: confidence,
    };
  }

  const team = await database.team.findUnique({ where: { id: args.teamId }, select: { artId: true } });
  return {
    teamId: args.teamId,
    artId: team?.artId ?? null,
    capabilities,
    windowSprints: args.windowSprints,
  };
}
```

Step 3: Commit `feat(capability): team capability aggregated by taskType (no per-person data)`

---

## Task 3: Initiative demand estimator

Files:
- Create: `apps/app/app/actions/flow-intelligence/capability-planning/initiative-demand.ts`

Step 1: Estimar demanda técnica de Epic/Feature

Two approaches: (a) labels manuais no Epic/Feature, (b) inferência via LLM do descriptionMd.

```typescript
import { database } from "@repo/database";
import Anthropic from "@anthropic-ai/sdk";
import { TASK_TYPES, type TaskType } from "./capability-schema";

export async function estimateInitiativeDemand(args: {
  tenantId: string;
  initiativeId: string;
  initiativeType: "epic" | "feature";
}) {
  const item = args.initiativeType === "epic"
    ? await database.epic.findFirst({ where: { id: args.initiativeId, tenantId: args.tenantId }, select: { title: true, descriptionMd: true } })
    : await database.feature.findFirst({ where: { id: args.initiativeId, tenantId: args.tenantId }, select: { title: true } });

  if (!item) throw new Error("Initiative not found");
  const content = `${item.title}\n${"descriptionMd" in item ? (item.descriptionMd ?? "") : ""}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: `Classify technical demand of a SAFe initiative across categories: ${TASK_TYPES.join(", ")}.
Return JSON: { "<category>": <0-1 weight>, ... }. Sum should be ~1.0. Categories not relevant: omit or 0.`,
    messages: [{ role: "user", content }],
  });

  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("");

  let demand: Record<string, number> = {};
  try { demand = JSON.parse(text); } catch { demand = {}; }

  return {
    initiativeId: args.initiativeId,
    initiativeType: args.initiativeType,
    demand,
  };
}
```

Step 2: Commit `feat(capability): LLM-based initiative demand estimator`

---

## Task 4: Compute capability gaps (algoritmo S(t,p))

Files:
- Create: `apps/app/app/actions/flow-intelligence/capability-planning/compute-gaps.ts`

Step 1: Failing test

```typescript
import { computeCapabilityGap } from "@/app/actions/flow-intelligence/capability-planning/compute-gaps";

describe("capability gap", () => {
  it("computes weighted gap S(t,p) by capability", () => {
    const team = { capabilities: { backend: { deliveredSp: 100, avgCycleTimeHours: 8, confidenceLevel: 0.8 }, ml: { deliveredSp: 5, avgCycleTimeHours: 24, confidenceLevel: 0.2 } } };
    const initiative = { demand: { backend: 0.4, ml: 0.6 } };
    const gap = computeCapabilityGap(team as any, initiative as any);
    expect(gap.overallScore).toBeGreaterThan(0);
    expect(gap.gapsByCategory.ml.gap).toBeGreaterThan(gap.gapsByCategory.backend.gap);
  });
});
```

Step 2: Implement

```typescript
import type { TeamCapability, InitiativeDemand } from "./capability-schema";

export function computeCapabilityGap(
  team: TeamCapability,
  initiative: InitiativeDemand
) {
  const gapsByCategory: Record<string, { demand: number; capability: number; gap: number; weight: number }> = {};
  let overallScore = 0;

  for (const [category, demand] of Object.entries(initiative.demand)) {
    const cap = team.capabilities[category as keyof typeof team.capabilities];
    const capScore = cap ? Math.min(1, cap.deliveredSp / 50) * cap.confidenceLevel : 0;
    const gap = Math.max(0, demand - capScore);
    const weight = demand;
    gapsByCategory[category] = { demand, capability: capScore, gap, weight };
    overallScore += gap * weight;
  }

  const topGap = Object.entries(gapsByCategory).sort((a, b) => b[1].gap - a[1].gap)[0];
  const recommendation = topGap && topGap[1].gap > 0.3
    ? `Time tem gap forte em ${topGap[0]}. Considerar enabler, treinamento, ou cross-team support antes do PI.`
    : "Time tem cobertura adequada para esta iniciativa.";

  return {
    teamId: team.teamId,
    initiativeId: initiative.initiativeId,
    initiativeType: initiative.initiativeType,
    overallScore,
    gapsByCategory,
    recommendation,
  };
}
```

Step 3: Commit `feat(capability): weighted gap algorithm (team capability vs initiative demand)`

---

## Task 5: Capability tab UI (substitui synergy-tab)

Files:
- Delete: `apps/app/app/(authenticated)/analytics/flow/components/synergy-tab.tsx`
- Delete: `apps/app/app/(authenticated)/analytics/flow/components/synergy-matrix.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/capability-tab.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/capability-matrix.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/capability-gap-card.tsx`

Step 1: Capability matrix (time x skill, **não** pessoa x pessoa)

```tsx
type Props = {
  teams: Array<{ id: string; name: string; capabilities: Record<string, { deliveredSp: number; confidenceLevel: number }> }>;
  taskTypes: readonly string[];
};

export function CapabilityMatrix({ teams, taskTypes }: Props) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left">Team</th>
            {taskTypes.map((t) => (
              <th key={t} className="p-2 text-center">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td className="p-2 font-medium">{team.name}</td>
              {taskTypes.map((t) => {
                const cap = team.capabilities[t];
                const score = cap ? cap.deliveredSp * cap.confidenceLevel : 0;
                const intensity = Math.min(1, score / 50);
                const bg = `rgba(99, 102, 241, ${intensity})`;
                return (
                  <td key={t} className="p-2 text-center text-xs" style={{ backgroundColor: bg }}>
                    {cap ? Math.round(cap.deliveredSp) : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Step 2: Gap card mostrando recomendação (sem nome de pessoa)

```tsx
type Props = {
  gap: {
    teamName: string;
    initiativeTitle: string;
    overallScore: number;
    topGap: { category: string; gap: number };
    recommendation: string;
  };
};

export function CapabilityGapCard({ gap }: Props) {
  const sev = gap.overallScore > 0.4 ? "high" : gap.overallScore > 0.2 ? "medium" : "low";
  const color = sev === "high" ? "border-rose-500" : sev === "medium" ? "border-amber-500" : "border-emerald-500";
  return (
    <div className={`rounded border-l-4 bg-card p-3 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{gap.teamName} → {gap.initiativeTitle}</span>
        <span className="text-xs text-muted-foreground">gap {gap.overallScore.toFixed(2)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Maior gap: <strong>{gap.topGap.category}</strong> ({gap.topGap.gap.toFixed(2)})
      </p>
      <p className="mt-1 text-xs">{gap.recommendation}</p>
    </div>
  );
}
```

Step 3: Tab principal

```tsx
import { CapabilityMatrix } from "./capability-matrix";
import { CapabilityGapCard } from "./capability-gap-card";

export function CapabilityTab({ teams, gaps, taskTypes }: { teams: any[]; gaps: any[]; taskTypes: string[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Team Capability Matrix</h3>
        <p className="text-xs text-muted-foreground">
          Capacidade técnica agregada por time. Não exibe dados individuais.
        </p>
        <CapabilityMatrix teams={teams} taskTypes={taskTypes} />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Capability Gaps for Upcoming PI</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {gaps.map((g) => <CapabilityGapCard key={`${g.teamId}-${g.initiativeId}`} gap={g} />)}
        </div>
      </div>
    </div>
  );
}
```

Step 4: Commit `feat(capability): replace synergy UI with team-aggregated capability planning`

---

## Task 6: Deprecate synergy server action

Files:
- Modify: `apps/app/app/actions/flow-intelligence/synergy.ts`

Step 1: Marcar exports como `@deprecated`, manter cálculo interno mas remover surfacing UI

```typescript
/**
 * @deprecated Use capability-planning/compute-gaps instead.
 * Internal data (PairSynergy/GroupSynergy) is preserved for future use only.
 * UI no longer surfaces individual-level synergy due to GDPR/LGPD compliance.
 */
export async function getSynergyMatrix() {
  throw new Error("getSynergyMatrix is deprecated — use capability-planning APIs");
}
```

Step 2: Atualizar imports antigos que referenciavam synergy-tab
Step 3: Commit `refactor(capability): deprecate individual-level synergy UI (GDPR/LGPD)`

---

## Task 7: Privacy + naming policy doc

Files:
- Create: `apps/app/app/(authenticated)/analytics/flow/components/capability-privacy-notice.tsx`

Step 1: Notice visível no tab Capability

```tsx
export function CapabilityPrivacyNotice() {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
      <strong>Privacidade:</strong> Esta análise agrega capacidades técnicas por time. Nenhum dado individual (nome, performance pessoal, padrão de colaboração par-a-par) é exibido ou usado em recomendações.
    </div>
  );
}
```

Step 2: Documentar em `.claude/COMMON_MISTAKES.md` que adicionar nomes individuais aqui é regressão de privacy
Step 3: Commit `docs(capability): add privacy notice + dev guideline`

---

## Done When

- [ ] UI antiga de synergy (matrix com nomes) deletada
- [ ] Nova UI Capability Tab mostra apenas agregados por time × skill
- [ ] Algoritmo S(t,p) computa gap por time/iniciativa sem identificar pessoas
- [ ] Notice de privacy visível
- [ ] Synergy server action marcada deprecated
- [ ] Tests passando (gap computation, team profile sem expor individuals)
- [ ] PairSynergy/GroupSynergy continuam no banco mas não surfaceadas

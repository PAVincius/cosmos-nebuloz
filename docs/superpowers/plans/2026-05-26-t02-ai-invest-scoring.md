# T02 — AI INVEST Scoring em Epic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar scoring INVEST automatizado em Epics, com cache invalidation por hash de conteúdo, breakdown explicável e re-scoring on-demand.

**Architecture:** Anthropic Claude avalia `title + descriptionMd` contra 6 critérios INVEST (Independente, Negociável, Valioso, Estimável, Pequeno, Testável), retornando score 0–100 por critério + rationale. Resultado cacheado em `Epic.investScore/investBreakdown/investHash`. Re-scoring trigger: hash mismatch após update.

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`), Prisma, Zod, Next.js Server Actions, React Query.

**Estado atual:**
- Schema: `Epic.investScore`, `investBreakdown`, `investHash`, `descriptionMd` já existem
- Actions: `create-epic.ts`, `update-epic.ts` em `apps/app/app/actions/epics/`
- Falta: lib de scoring, invocação na create/update, UI para exibir + recompute manual

---

## File Structure

```
apps/app/app/actions/epics/
  invest/
    score-epic.ts          — (NEW) lib de scoring (Claude call + cache)
    invest-prompts.ts      — (NEW) system prompt + few-shot examples
    invest-schema.ts       — (NEW) Zod schema do output do LLM
    recompute-score.ts     — (NEW) server action: recompute manual
  create-epic.ts           — (MODIFY) chamar scoring após create
  update-epic.ts           — (MODIFY) re-scoring se hash mudou

apps/app/app/(authenticated)/portfolio/components/
  invest-score-badge.tsx   — (NEW) badge visual (0-100 + cor)
  invest-breakdown-panel.tsx — (NEW) drill-down de I/N/V/E/S/T com rationale

apps/app/__tests__/actions/epics/
  invest-scoring.test.ts   — (NEW) testes da lib
  recompute-score.test.ts  — (NEW) testes do action
```

---

## Task 1: Schema Zod do output INVEST

**Files:**
- Create: `apps/app/app/actions/epics/invest/invest-schema.ts`

- [ ] **Step 1: Definir schema do output esperado do LLM**

```typescript
import { z } from "zod";

export const investCriterionSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string().min(10).max(500),
});

export const investBreakdownSchema = z.object({
  I: investCriterionSchema, // Independente
  N: investCriterionSchema, // Negociável
  V: investCriterionSchema, // Valioso
  E: investCriterionSchema, // Estimável
  S: investCriterionSchema, // Small/Sized
  T: investCriterionSchema, // Testável
});

export type InvestBreakdown = z.infer<typeof investBreakdownSchema>;

export const INVEST_WEIGHTS = {
  I: 0.15,
  N: 0.10,
  V: 0.25, // valor pesa mais
  E: 0.15,
  S: 0.10,
  T: 0.25, // testabilidade pesa mais
} as const;

export function computeCompositeScore(breakdown: InvestBreakdown): number {
  return (
    breakdown.I.score * INVEST_WEIGHTS.I +
    breakdown.N.score * INVEST_WEIGHTS.N +
    breakdown.V.score * INVEST_WEIGHTS.V +
    breakdown.E.score * INVEST_WEIGHTS.E +
    breakdown.S.score * INVEST_WEIGHTS.S +
    breakdown.T.score * INVEST_WEIGHTS.T
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/actions/epics/invest/invest-schema.ts
git commit -m "feat(epics): add INVEST breakdown Zod schema + weighted composite"
```

---

## Task 2: Prompts do LLM com few-shot

**Files:**
- Create: `apps/app/app/actions/epics/invest/invest-prompts.ts`

- [ ] **Step 1: Construir system prompt + exemplos few-shot**

```typescript
export const INVEST_SYSTEM_PROMPT = `You are a senior SAFe Lean Portfolio Manager evaluating Epic quality against INVEST criteria.

Evaluate the Epic on each criterion (0-100):
- I: Independent — Can it be developed without blocking dependencies?
- N: Negotiable — Is scope flexible enough for refinement?
- V: Valuable — Does it deliver clear business or user value?
- E: Estimable — Is it described well enough to estimate effort?
- S: Sized appropriately — Is it small enough to deliver in 1-3 PIs?
- T: Testable — Can acceptance be objectively verified?

Return JSON ONLY, no prose, matching this exact shape:
{
  "I": { "score": 0-100, "rationale": "..." },
  "N": { "score": 0-100, "rationale": "..." },
  "V": { "score": 0-100, "rationale": "..." },
  "E": { "score": 0-100, "rationale": "..." },
  "S": { "score": 0-100, "rationale": "..." },
  "T": { "score": 0-100, "rationale": "..." }
}

Each rationale: 1-2 sentences, max 500 chars, concrete and actionable.`;

export const INVEST_FEW_SHOT_EXAMPLES = [
  {
    role: "user" as const,
    content: `Epic Title: "Improve user experience"\nDescription: "Make the app better and faster."`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      I: { score: 30, rationale: "Too broad to scope independently — could entangle with any feature." },
      N: { score: 60, rationale: "Vague enough to be negotiable, but lacks anchors for productive negotiation." },
      V: { score: 20, rationale: "No measurable value statement, no target user segment, no outcome metric." },
      E: { score: 10, rationale: "Impossible to estimate without breakdown of what 'better' means." },
      S: { score: 15, rationale: "Effectively unbounded scope." },
      T: { score: 5, rationale: "No acceptance criteria, no measurable outcome to test against." },
    }),
  },
];

export function buildUserPrompt(title: string, descriptionMd: string): string {
  return `Epic Title: "${title}"\nDescription:\n${descriptionMd || "(no description)"}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/actions/epics/invest/invest-prompts.ts
git commit -m "feat(epics): add INVEST scoring prompts with few-shot examples"
```

---

## Task 3: Core scoring lib com cache por hash

**Files:**
- Create: `apps/app/app/actions/epics/invest/score-epic.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/app/__tests__/actions/epics/invest-scoring.test.ts
import { describe, it, expect, vi } from "vitest";
import { computeInvestHash, scoreEpic } from "@/app/actions/epics/invest/score-epic";

describe("computeInvestHash", () => {
  it("returns same hash for same input", () => {
    const h1 = computeInvestHash("Title A", "Desc A");
    const h2 = computeInvestHash("Title A", "Desc A");
    expect(h1).toBe(h2);
  });

  it("returns different hash when title changes", () => {
    const h1 = computeInvestHash("Title A", "Desc");
    const h2 = computeInvestHash("Title B", "Desc");
    expect(h1).not.toBe(h2);
  });
});
```

Run: `pnpm test apps/app/__tests__/actions/epics/invest-scoring.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Implement scoring lib**

```typescript
// apps/app/app/actions/epics/invest/score-epic.ts
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { database } from "@repo/database";
import {
  investBreakdownSchema,
  computeCompositeScore,
  type InvestBreakdown,
} from "./invest-schema";
import {
  INVEST_SYSTEM_PROMPT,
  INVEST_FEW_SHOT_EXAMPLES,
  buildUserPrompt,
} from "./invest-prompts";

export function computeInvestHash(title: string, descriptionMd: string | null): string {
  return createHash("sha256")
    .update(`${title}\n---\n${descriptionMd ?? ""}`)
    .digest("hex");
}

export type ScoreResult = {
  cached: boolean;
  hash: string;
  score: number;
  breakdown: InvestBreakdown;
};

export async function scoreEpic(epicId: string, tenantId: string): Promise<ScoreResult> {
  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId },
    select: { title: true, descriptionMd: true, investHash: true, investScore: true, investBreakdown: true },
  });
  if (!epic) throw new Error("Epic not found");

  const hash = computeInvestHash(epic.title, epic.descriptionMd);

  if (hash === epic.investHash && epic.investScore != null && epic.investBreakdown) {
    return {
      cached: true,
      hash,
      score: epic.investScore,
      breakdown: epic.investBreakdown as InvestBreakdown,
    };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: INVEST_SYSTEM_PROMPT,
    messages: [
      ...INVEST_FEW_SHOT_EXAMPLES,
      { role: "user", content: buildUserPrompt(epic.title, epic.descriptionMd ?? "") },
    ],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const breakdown = investBreakdownSchema.parse(JSON.parse(rawText));
  const score = computeCompositeScore(breakdown);

  await database.epic.update({
    where: { id: epicId },
    data: { investScore: score, investBreakdown: breakdown, investHash: hash },
  });

  return { cached: false, hash, score, breakdown };
}
```

- [ ] **Step 3: Run test**

Run: `pnpm test apps/app/__tests__/actions/epics/invest-scoring.test.ts`
Expected: PASS (hash deterministic test)

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/actions/epics/invest/score-epic.ts apps/app/__tests__/actions/epics/invest-scoring.test.ts
git commit -m "feat(epics): INVEST scoring with sha256 cache invalidation"
```

---

## Task 4: Hook scoring no create-epic e update-epic

**Files:**
- Modify: `apps/app/app/actions/epics/create-epic.ts`
- Modify: `apps/app/app/actions/epics/update-epic.ts`

- [ ] **Step 1: Async scoring após create**

Após `prisma.epic.create()`, disparar scoring sem bloquear o response:

```typescript
import { scoreEpic } from "./invest/score-epic";

// dentro do action, após criar o epic:
queueMicrotask(() => {
  scoreEpic(epic.id, tenantId).catch((err) => {
    console.error("[invest] background scoring failed", { epicId: epic.id, err });
  });
});
```

- [ ] **Step 2: Re-scoring no update se title/description mudou**

```typescript
// update-epic.ts — após update:
const titleChanged = data.title && data.title !== existing.title;
const descChanged = data.descriptionMd !== undefined && data.descriptionMd !== existing.descriptionMd;
if (titleChanged || descChanged) {
  queueMicrotask(() => {
    scoreEpic(epic.id, tenantId).catch((err) => {
      console.error("[invest] re-scoring failed", { epicId: epic.id, err });
    });
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/actions/epics/create-epic.ts apps/app/app/actions/epics/update-epic.ts
git commit -m "feat(epics): trigger INVEST scoring on create + content update"
```

---

## Task 5: Server action recompute manual

**Files:**
- Create: `apps/app/app/actions/epics/invest/recompute-score.ts`

- [ ] **Step 1: Action server-side com rate limit por tenant**

```typescript
"use server";
import { z } from "zod";
import { withAuth } from "@/app/actions/_base";
import { scoreEpic } from "./score-epic";

const recomputeSchema = z.object({ epicId: z.string().cuid() });

export const recomputeInvestScore = withAuth(async (ctx, raw) => {
  const { epicId } = recomputeSchema.parse(raw);
  const result = await scoreEpic(epicId, ctx.tenantId);
  return { ok: true, ...result };
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/actions/epics/invest/recompute-score.ts
git commit -m "feat(epics): manual INVEST recompute server action"
```

---

## Task 6: UI — badge + breakdown panel

**Files:**
- Create: `apps/app/app/(authenticated)/portfolio/components/invest-score-badge.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/components/invest-breakdown-panel.tsx`

- [ ] **Step 1: Badge color-coded**

```tsx
type Props = { score: number | null };

const colorFor = (s: number) =>
  s >= 75 ? "bg-emerald-500" : s >= 50 ? "bg-amber-500" : "bg-rose-500";

export function InvestScoreBadge({ score }: Props) {
  if (score == null) return <span className="text-xs text-muted-foreground">No score</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-white ${colorFor(score)}`}>
      INVEST {Math.round(score)}
    </span>
  );
}
```

- [ ] **Step 2: Breakdown panel (drill-down do score)**

```tsx
import type { InvestBreakdown } from "@/app/actions/epics/invest/invest-schema";

const LABELS = {
  I: "Independent",
  N: "Negotiable",
  V: "Valuable",
  E: "Estimable",
  S: "Sized",
  T: "Testable",
} as const;

export function InvestBreakdownPanel({ breakdown }: { breakdown: InvestBreakdown }) {
  return (
    <div className="space-y-2">
      {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((k) => (
        <div key={k} className="rounded border p-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{k} — {LABELS[k]}</span>
            <span className="tabular-nums">{breakdown[k].score}/100</span>
          </div>
          <p className="text-xs text-muted-foreground">{breakdown[k].rationale}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Integrar no Epic detail drawer**

Adicionar badge no card de Epic do Portfolio Kanban + panel no drawer/sheet de detalhe.

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/\(authenticated\)/portfolio/components/invest-score-badge.tsx apps/app/app/\(authenticated\)/portfolio/components/invest-breakdown-panel.tsx
git commit -m "feat(epics): INVEST score badge + breakdown panel UI"
```

---

## Task 7: E2E — recompute button + breakdown drawer

- [ ] **Step 1: Botão "Recompute INVEST" no drawer chama action**
- [ ] **Step 2: Estado loading + toast de sucesso/erro**
- [ ] **Step 3: Invalidar cache de portfolio na mutação**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(epics): recompute button + cache invalidation"
```

---

## Done When

- [ ] Epic criado dispara scoring async sem bloquear UI
- [ ] Update de title/description re-dispara scoring
- [ ] Hash mismatch = recompute; match = retorna cache
- [ ] Badge visível no Portfolio Kanban com cor por score
- [ ] Drawer exibe breakdown completo I/N/V/E/S/T + rationale
- [ ] Botão recompute manual disponível
- [ ] Tests passando (hash determinism + cache hit/miss)

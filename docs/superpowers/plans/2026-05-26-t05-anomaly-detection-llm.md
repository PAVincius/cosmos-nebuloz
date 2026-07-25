# T05 — Anomaly Detection com Narrativa LLM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Detectar anomalias em FlowMetricSnapshot por regras heurísticas, enriquecer com narrativa LLM em linguagem natural contextualizada ao SAFe, surfaceiar no Copilot e via push notifications. Diferenciador: narrativa contextual SAFe vs alertas brutos do Atlassian Spring 2026.

**Architecture:**
- Trigger: FlowMetricSnapshot criado → AnomalyDetectionRun async
- Pipeline: rules heurísticas → Anomaly[] → LLM enrichment (Claude) → CopilotSuggestion → Notification
- Re-evaluation: se snapshot é reevaluado (staleness fix), re-run anomalies
- Suppression: anomalia já vista em runs anteriores tem rationale de "recurring" vs "new"

**Tech Stack:** Anthropic Claude, Prisma, Vercel Cron, push notifications via packages/email.

**Estado atual:**
- `flow-intelligence/anomaly-rules.ts`: regras heurísticas
- `flow-intelligence/analyze-flow.ts`: runner
- `AnomalyDetectionRun`, `Anomaly`, `StalenessAuditLog` no schema
- Falta: LLM enrichment, surfacing no Copilot, notification, suppression de duplicatas

---

## File Structure

```
apps/app/app/actions/flow-intelligence/
  anomaly-rules.ts             MODIFY: revisar 8 regras + thresholds configuráveis
  analyze-flow.ts              MODIFY: chamar narrative gen + suppression
  narrative-generator.ts       NEW: LLM enrichment com Claude
  anomaly-prompts.ts           NEW: prompts por regra
  suppression-filter.ts        NEW: detectar recorrência + decay
  notify-anomaly.ts            NEW: surface no Copilot + email

apps/app/app/actions/safe-copilot/
  context/anomaly-context.ts   NEW: build context com anomalias abertas

apps/app/app/(authenticated)/analytics/flow/components/
  anomaly-feed.tsx             NEW: lista de anomalias com narrativa
  anomaly-card.tsx             NEW: card individual com action items
  anomaly-trend.tsx            NEW: chart de recorrência por rule

apps/app/app/api/cron/anomaly-scheduler/route.ts  NEW: scheduled runs

apps/app/__tests__/actions/flow-intelligence/
  suppression-filter.test.ts   NEW
  narrative-generator.test.ts  NEW
```

---

## Task 1: Suppression filter (evita ruído)

Files:
- Create: `apps/app/app/actions/flow-intelligence/suppression-filter.ts`

Step 1: Failing test

```typescript
import { shouldSuppress, classifyRecurrence } from "@/app/actions/flow-intelligence/suppression-filter";

describe("suppression", () => {
  it("new anomaly: no suppression", async () => {
    const r = await classifyRecurrence({ tenantId: "t", scope: "team", scopeId: "tm_1", rule: "VelocityCliff" });
    expect(r.kind).toBe("new");
  });

  it("seen 2 sprints ago: recurring", async () => {
    const r = await classifyRecurrence({ tenantId: "t", scope: "team", scopeId: "tm_1", rule: "WIPOverload" });
    expect(["new", "recurring"]).toContain(r.kind);
  });
});
```

Step 2: Implement

```typescript
import { database } from "@repo/database";

export type RecurrenceKind = "new" | "recurring" | "chronic";

export async function classifyRecurrence(args: {
  tenantId: string;
  scope: string;
  scopeId: string;
  rule: string;
}): Promise<{ kind: RecurrenceKind; priorCount: number; lastSeenAt?: Date }> {
  const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const recentRuns = await database.anomalyDetectionRun.findMany({
    where: { tenantId: args.tenantId, scope: args.scope, scopeId: args.scopeId, ranAt: { gte: ninetyDays } },
    include: { anomalies: { where: { rule: args.rule } } },
    orderBy: { ranAt: "desc" },
  });

  const occurrences = recentRuns.filter((r) => r.anomalies.length > 0);
  const priorCount = occurrences.length;

  if (priorCount === 0) return { kind: "new", priorCount };
  if (priorCount >= 5) return { kind: "chronic", priorCount, lastSeenAt: occurrences[0].ranAt };
  return { kind: "recurring", priorCount, lastSeenAt: occurrences[0].ranAt };
}

export function shouldSuppress(kind: RecurrenceKind, lastSeenAt?: Date): boolean {
  if (kind === "new") return false;
  if (kind === "recurring" && lastSeenAt) {
    const ageDays = (Date.now() - lastSeenAt.getTime()) / (24 * 60 * 60 * 1000);
    return ageDays < 3;
  }
  if (kind === "chronic") return false;
  return false;
}
```

Step 3: Commit `feat(flow-intel): anomaly recurrence classifier + suppression filter`

---

## Task 2: Anomaly prompts por rule

Files:
- Create: `apps/app/app/actions/flow-intelligence/anomaly-prompts.ts`

Step 1: Prompt SAFe-contextualizado para cada rule

```typescript
export const RULE_NARRATIVES: Record<string, { title: string; askLLM: (data: AnomalyData) => string }> = {
  VelocityCliff: {
    title: "Velocity drop",
    askLLM: (d) => `Velocity dropped ${Math.round(d.delta * 100)}% in ${d.scope} ${d.scopeId} (from ${d.before} to ${d.after}).
Explain in 2 sentences the likely SAFe causes and recommend 1-2 specific actions an RTE/SM can take in the next sprint planning.
Avoid generic advice. Reference Flow Load and Flow Efficiency if relevant.`,
  },
  WIPOverload: {
    title: "WIP above limit",
    askLLM: (d) => `WIP load is ${d.value}, exceeding the team WIP limit of ${d.threshold}.
Reference SAFe Lean principle of limiting WIP. Recommend a specific drain strategy for this sprint.
Identify which feature/story type is contributing most (from breakdown: ${JSON.stringify(d.breakdown)}).`,
  },
  PredictabilityCollapse: {
    title: "Predictability collapse",
    askLLM: (d) => `Predictability fell to ${(d.value * 100).toFixed(0)}% (planned vs delivered).
Diagnose if this is a planning issue (over-commit), scope issue (mid-sprint changes), or capacity issue (members out).
Suggest one concrete experiment for next PI.`,
  },
  CycleTimeDegradation: {
    title: "Cycle time degrading",
    askLLM: (d) => `Flow Time trend is upward over ${d.windowSprints} sprints. Median rose from ${d.before}h to ${d.after}h.
Identify if this is uniform across work types or concentrated. Recommend specific work-type focus.`,
  },
  EfficiencyNosedive: {
    title: "Flow Efficiency declining",
    askLLM: (d) => `Flow Efficiency at ${(d.value * 100).toFixed(0)}% (industry SAFe healthy = 30-50%).
The remaining time is wait time. Identify likely bottleneck (handoffs, code review, env setup, integration).
Recommend a specific value stream improvement.`,
  },
  WorkTypeImbalance: {
    title: "Work type imbalance",
    askLLM: (d) => `Work distribution: ${JSON.stringify(d.distribution)}.
SAFe recommends balanced Flow Distribution. Evaluate the imbalance against business priorities.
Suggest rebalancing for next PI if needed.`,
  },
  StaleCompetencyAssessment: {
    title: "Competency assessment stale",
    askLLM: (d) => `Competency assessment last updated ${d.daysStale} days ago for ${d.scope} ${d.scopeId}.
SAFe recommends quarterly refresh. Identify which of the 7 SAFe competencies are most at risk.`,
  },
  ImprovementActionOverdue: {
    title: "Improvement action overdue",
    askLLM: (d) => `${d.count} improvement actions are overdue by avg ${d.avgDaysOverdue} days.
Recommend prioritization and identify if action ownership is the root cause.`,
  },
};

export type AnomalyData = {
  scope: string;
  scopeId: string;
  delta?: number;
  before?: number;
  after?: number;
  value?: number;
  threshold?: number;
  breakdown?: Record<string, number>;
  distribution?: Record<string, number>;
  windowSprints?: number;
  daysStale?: number;
  count?: number;
  avgDaysOverdue?: number;
};
```

Step 2: Commit `feat(flow-intel): rule-specific anomaly prompts for LLM`

---

## Task 3: Narrative generator (Claude)

Files:
- Create: `apps/app/app/actions/flow-intelligence/narrative-generator.ts`

Step 1: Função que pega Anomaly + dados + recurrence → chama Claude → retorna narrativa

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { RULE_NARRATIVES, type AnomalyData } from "./anomaly-prompts";
import type { RecurrenceKind } from "./suppression-filter";

const SYSTEM_PROMPT = `You are a SAFe Release Train Engineer assistant. Your job: explain a detected flow anomaly to RTEs/SMs in 2-3 sentences, then recommend 1-2 concrete next-sprint actions.
Speak in plain English. Reference SAFe terms (PI, ART, Flow Metrics) when relevant. Never recommend generic "discuss in retro" — be specific.`;

export async function generateNarrative(args: {
  rule: string;
  data: AnomalyData;
  recurrence: { kind: RecurrenceKind; priorCount: number };
}): Promise<{ narrative: string; actions: string[] }> {
  const ruleConfig = RULE_NARRATIVES[args.rule];
  if (!ruleConfig) {
    return { narrative: "Anomaly detected.", actions: [] };
  }

  const recurrenceLine =
    args.recurrence.kind === "chronic"
      ? `\n\nNote: This pattern has recurred ${args.recurrence.priorCount} times in 90 days. Treat as chronic.`
      : args.recurrence.kind === "recurring"
      ? `\n\nNote: This is a recurring pattern (seen ${args.recurrence.priorCount} times in 90 days).`
      : "";

  const userPrompt = ruleConfig.askLLM(args.data) + recurrenceLine + `\n\nReturn JSON: { "narrative": "...", "actions": ["...", "..."] }`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const json = JSON.parse(text);
    return { narrative: json.narrative ?? "", actions: json.actions ?? [] };
  } catch {
    return { narrative: text.slice(0, 800), actions: [] };
  }
}
```

Step 2: Commit `feat(flow-intel): LLM narrative generator for SAFe-contextual anomalies`

---

## Task 4: Wire narrative no analyze-flow

Files:
- Modify: `apps/app/app/actions/flow-intelligence/analyze-flow.ts`

Step 1: Após detectar Anomaly[], iterar e enrichar

```typescript
import { generateNarrative } from "./narrative-generator";
import { classifyRecurrence, shouldSuppress } from "./suppression-filter";

// dentro do loop de anomalies detectadas:
for (const anom of detected) {
  const recurrence = await classifyRecurrence({
    tenantId, scope: run.scope, scopeId: run.scopeId, rule: anom.rule,
  });
  if (shouldSuppress(recurrence.kind, recurrence.lastSeenAt)) continue;

  const enriched = await generateNarrative({
    rule: anom.rule,
    data: anom.metadata as AnomalyData,
    recurrence,
  });

  await database.anomaly.create({
    data: {
      tenantId,
      runId: run.id,
      rule: anom.rule,
      severity: anom.severity,
      metric: anom.metric,
      delta: anom.delta,
      metadata: {
        ...anom.metadata,
        narrative: enriched.narrative,
        actions: enriched.actions,
        recurrence: recurrence.kind,
        priorCount: recurrence.priorCount,
      },
    },
  });
}
```

Step 2: Commit `feat(flow-intel): enrich anomalies with LLM narrative + suppression`

---

## Task 5: Notify anomaly via Copilot + email

Files:
- Create: `apps/app/app/actions/flow-intelligence/notify-anomaly.ts`

Step 1: Surface no Copilot via CopilotSuggestion (criar se não existir)

```typescript
import { database } from "@repo/database";
import { sendEmail } from "@repo/email";

export async function notifyAnomaly(args: {
  tenantId: string;
  anomalyId: string;
  severity: string;
  narrative: string;
  actions: string[];
}) {
  await database.notification.create({
    data: {
      tenantId: args.tenantId,
      type: "flow_anomaly",
      payload: { anomalyId: args.anomalyId, severity: args.severity, summary: args.narrative.slice(0, 200) },
      read: false,
    },
  });

  if (args.severity === "critical" || args.severity === "high") {
    const recipients = await database.tenantMember.findMany({
      where: { tenantId: args.tenantId, role: { in: ["RTE", "SM", "ADMIN"] } },
      include: { user: { select: { email: true, name: true } } },
    });
    for (const m of recipients) {
      if (!m.user.email) continue;
      await sendEmail({
        to: m.user.email,
        subject: `[Cosmos] Flow anomaly: ${args.severity.toUpperCase()}`,
        html: renderAnomalyEmail(args),
      });
    }
  }
}

function renderAnomalyEmail(args: { narrative: string; actions: string[] }) {
  const actionsList = args.actions.map((a) => `<li>${a}</li>`).join("");
  return `<p>${args.narrative}</p><ul>${actionsList}</ul>`;
}
```

Step 2: Wire em analyze-flow após enriquecer
Step 3: Commit `feat(flow-intel): notify RTE/SM for high-severity anomalies`

---

## Task 6: Anomaly feed UI

Files:
- Create: `apps/app/app/(authenticated)/analytics/flow/components/anomaly-feed.tsx`
- Create: `apps/app/app/(authenticated)/analytics/flow/components/anomaly-card.tsx`

Step 1: Feed component que lê últimas 50 anomalies do tenant
Step 2: Card mostra: rule icon, severity badge, narrative, actions checkboxes, recurrence indicator

```tsx
type Props = {
  anomaly: {
    id: string;
    rule: string;
    severity: string;
    metadata: { narrative: string; actions: string[]; recurrence: string };
  };
};

const SEVERITY_COLOR = {
  critical: "bg-rose-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
} as const;

export function AnomalyCard({ anomaly }: Props) {
  const color = SEVERITY_COLOR[anomaly.severity as keyof typeof SEVERITY_COLOR] ?? "bg-slate-400";
  return (
    <div className="rounded border p-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs font-medium">{anomaly.rule}</span>
        {anomaly.metadata.recurrence !== "new" && (
          <span className="text-xs text-amber-600">[{anomaly.metadata.recurrence}]</span>
        )}
      </div>
      <p className="mt-2 text-sm">{anomaly.metadata.narrative}</p>
      <ul className="mt-2 space-y-1">
        {anomaly.metadata.actions.map((a, i) => (
          <li key={i} className="text-xs text-muted-foreground">- {a}</li>
        ))}
      </ul>
    </div>
  );
}
```

Step 3: Commit `feat(flow-intel): anomaly feed UI with narrative + recurrence flags`

---

## Task 7: Anomaly context para Copilot

Files:
- Create: `apps/app/app/actions/safe-copilot/context/anomaly-context.ts`

Step 1: Quando user pergunta sobre time/ART no Copilot, injetar anomalies abertas no system prompt

```typescript
import { database } from "@repo/database";

export async function buildAnomalyContext(tenantId: string, scopeId?: string) {
  const recent = await database.anomaly.findMany({
    where: {
      tenantId,
      severity: { in: ["high", "critical"] },
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      ...(scopeId && { run: { scopeId } }),
    },
    include: { run: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (recent.length === 0) return "";

  const lines = recent.map((a) => {
    const meta = a.metadata as { narrative?: string };
    return `- [${a.severity}] ${a.rule} (${a.run.scope} ${a.run.scopeId}): ${meta.narrative?.slice(0, 120) ?? ""}`;
  });

  return `## Recent Flow Anomalies (last 14 days)\n\n${lines.join("\n")}\n\nWhen the user asks about team or ART health, reference these directly.`;
}
```

Step 2: Wire no Copilot system prompt builder
Step 3: Commit `feat(copilot): inject recent anomalies into system context`

---

## Task 8: Anomaly scheduler cron

Files:
- Create: `apps/app/app/api/cron/anomaly-scheduler/route.ts`

Step 1: Cron diário que itera tenants ativos e gera FlowMetricSnapshot novo se 24h passaram
Step 2: Após snapshot, dispara analyzeFlow (que enriquece com narrative)
Step 3: vercel.json com schedule `0 6 * * *` (6am UTC)
Step 4: Commit `feat(flow-intel): daily anomaly detection cron`

---

## Done When

- [ ] 8 rules detectam anomalias com thresholds configuráveis
- [ ] Cada Anomaly tem narrative LLM + actions concretas
- [ ] Suppression evita ruído (recurring anomalies)
- [ ] High/critical disparam notification + email para RTE/SM
- [ ] UI feed mostra anomalies com recurrence flags
- [ ] Copilot recebe anomalias abertas no contexto
- [ ] Cron diário garante snapshots frescos
- [ ] Tests passando (suppression, narrative com mock)

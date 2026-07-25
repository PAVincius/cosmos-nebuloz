# T09 — Governance de Epic + DecisionLog Auditável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Portfolio Kanban com state machine de governança de Epic (FUNNEL → ANALYZING → PORTFOLIO_BACKLOG → IMPLEMENTING → DONE → CANCELLED) + DecisionLog auditável (SOX/FDA compliance) registrando cada transição com justificativa, decisor e dados de suporte.

**Architecture:**
- `GovernedEpic` é wrapper 1:1 do Epic com `governanceStatus`. Já existe.
- Transições disparam `ApprovalRequest` quando workflow requer aprovação
- `DecisionLogEntry` é write-only, imutável, indexado por tenant + tipo + data
- UI: Portfolio Kanban com colunas governance + drawer com timeline de decisões + form de transição com required justification

**Tech Stack:** Prisma, Zod, Next.js Server Actions, React Query, DnD Kit (kanban), Better Auth (decidorId).

**Estado atual:**
- `governance/index.ts`: 488 linhas, ações server-side existem
- `GovernedEpic`, `ApprovalWorkflow`, `ApprovalRequest`, `ApprovalStepInstance`, `DecisionLogEntry` no schema
- Falta: UI completa do Portfolio Kanban com governance, drawer de DecisionLog, validação de transições, hooks de auditoria automática

---

## File Structure

```
apps/app/app/actions/governance/
  index.ts                       MODIFY: extrair concerns para arquivos focados
  state-machine.ts               NEW: transições permitidas + validação
  transition-epic.ts             NEW: action que valida + transiciona + loga
  decision-log.ts                NEW: write/read DecisionLogEntry
  audit-hooks.ts                 NEW: hook chamado em mutations sensíveis (budget, theme)

apps/app/app/(authenticated)/portfolio/governance/
  page.tsx                       NEW: Portfolio Kanban governance view
  components/
    governance-kanban.tsx        NEW: kanban com 6 colunas (FUNNEL -> CANCELLED)
    epic-governance-card.tsx     NEW: card com investScore, valueStream, theme
    transition-dialog.tsx        NEW: form de transição com justificativa obrigatória
    decision-log-timeline.tsx    NEW: timeline de decisões para um GovernedEpic
    decision-log-filter.tsx      NEW: filtros por tipo/decisor/data

apps/app/__tests__/actions/governance/
  state-machine.test.ts          NEW: testes de transição permitida
  transition-epic.test.ts        NEW: integração com decision log
  decision-log.test.ts           NEW
```

---

## Task 1: State machine de governance

Files:
- Create: `apps/app/app/actions/governance/state-machine.ts`

Step 1: Failing test

```typescript
import { canTransition, GOVERNANCE_STATES } from "@/app/actions/governance/state-machine";

describe("governance state-machine", () => {
  it("allows FUNNEL -> ANALYZING", () => {
    expect(canTransition("FUNNEL", "ANALYZING")).toBe(true);
  });
  it("rejects FUNNEL -> DONE skip", () => {
    expect(canTransition("FUNNEL", "DONE")).toBe(false);
  });
  it("allows any state -> CANCELLED", () => {
    for (const s of GOVERNANCE_STATES) {
      if (s === "CANCELLED" || s === "DONE") continue;
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });
});
```

Step 2: Implement

```typescript
export const GOVERNANCE_STATES = [
  "FUNNEL",
  "ANALYZING",
  "PORTFOLIO_BACKLOG",
  "IMPLEMENTING",
  "DONE",
  "CANCELLED",
] as const;
export type GovernanceState = (typeof GOVERNANCE_STATES)[number];

const TRANSITIONS: Record<GovernanceState, GovernanceState[]> = {
  FUNNEL:            ["ANALYZING", "CANCELLED"],
  ANALYZING:         ["FUNNEL", "PORTFOLIO_BACKLOG", "CANCELLED"],
  PORTFOLIO_BACKLOG: ["ANALYZING", "IMPLEMENTING", "CANCELLED"],
  IMPLEMENTING:      ["DONE", "CANCELLED"],
  DONE:              [],
  CANCELLED:         [],
};

export function canTransition(from: GovernanceState, to: GovernanceState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: GovernanceState): GovernanceState[] {
  return TRANSITIONS[from] ?? [];
}
```

Step 3: Commit `feat(governance): state machine with permitted transitions`

---

## Task 2: DecisionLog write/read helpers

Files:
- Create: `apps/app/app/actions/governance/decision-log.ts`

Step 1: Failing test

```typescript
import { logDecision, listDecisions } from "@/app/actions/governance/decision-log";

describe("decision-log", () => {
  it("logs a decision and reads it back ordered by date desc", async () => {
    const ctx = { tenantId: "t_1", userId: "u_1" };
    await logDecision(ctx, {
      tipo: "epic_decision",
      targetType: "epic",
      targetId: "e_1",
      decisao: "Move FUNNEL -> ANALYZING",
      justificativa: "Customer commitment for Q2",
      dadosSuporte: { investScore: 78 },
    });
    const all = await listDecisions(ctx.tenantId, { targetType: "epic", targetId: "e_1" });
    expect(all[0].decisao).toMatch(/FUNNEL/);
  });
});
```

Step 2: Implement

```typescript
import { database } from "@repo/database";

export type DecisionInput = {
  tipo: "epic_decision" | "budget_decision" | "theme_decision";
  targetType: "epic" | "guardrail" | "theme";
  targetId: string;
  valueStreamId?: string;
  decisao: string;
  justificativa: string;
  dadosSuporte?: Record<string, unknown>;
};

export async function logDecision(
  ctx: { tenantId: string; userId: string },
  input: DecisionInput
) {
  return database.decisionLogEntry.create({
    data: {
      tenantId: ctx.tenantId,
      tipo: input.tipo,
      targetType: input.targetType,
      targetId: input.targetId,
      valueStreamId: input.valueStreamId,
      decisao: input.decisao,
      justificativa: input.justificativa,
      dadosSuporte: input.dadosSuporte ?? {},
      decisorId: ctx.userId,
    },
  });
}

export async function listDecisions(
  tenantId: string,
  filter: { tipo?: string; targetType?: string; targetId?: string; from?: Date; to?: Date } = {}
) {
  return database.decisionLogEntry.findMany({
    where: {
      tenantId,
      ...(filter.tipo && { tipo: filter.tipo }),
      ...(filter.targetType && { targetType: filter.targetType }),
      ...(filter.targetId && { targetId: filter.targetId }),
      ...(filter.from || filter.to ? { dataDecisao: { gte: filter.from, lte: filter.to } } : {}),
    },
    orderBy: { dataDecisao: "desc" },
  });
}
```

Step 3: Commit `feat(governance): decision log write + filtered read`

---

## Task 3: Transition action com auditoria

Files:
- Create: `apps/app/app/actions/governance/transition-epic.ts`

Step 1: Failing test

```typescript
import { transitionEpic } from "@/app/actions/governance/transition-epic";

describe("transitionEpic", () => {
  it("transitions FUNNEL -> ANALYZING and writes decision log", async () => {
    const r = await transitionEpic({ epicId: "e_1", to: "ANALYZING", justificativa: "Approved by RTE meeting 2026-05-26" });
    expect(r.ok).toBe(true);
    expect(r.newState).toBe("ANALYZING");
  });

  it("rejects invalid transition", async () => {
    await expect(
      transitionEpic({ epicId: "e_1", to: "DONE", justificativa: "x" })
    ).rejects.toThrow(/invalid transition/i);
  });

  it("requires justificativa min length", async () => {
    await expect(
      transitionEpic({ epicId: "e_1", to: "ANALYZING", justificativa: "" })
    ).rejects.toThrow(/justificativa/i);
  });
});
```

Step 2: Implement

```typescript
"use server";
import { z } from "zod";
import { database } from "@repo/database";
import { withAuth } from "@/app/actions/_base";
import { canTransition, type GovernanceState } from "./state-machine";
import { logDecision } from "./decision-log";

const transitionSchema = z.object({
  epicId: z.string().cuid(),
  to: z.enum(["FUNNEL", "ANALYZING", "PORTFOLIO_BACKLOG", "IMPLEMENTING", "DONE", "CANCELLED"]),
  justificativa: z.string().min(10, "justificativa min 10 chars"),
  dadosSuporte: z.record(z.unknown()).optional(),
});

export const transitionEpic = withAuth(async (ctx, raw) => {
  const input = transitionSchema.parse(raw);

  const governed = await database.governedEpic.findFirst({
    where: { tenantId: ctx.tenantId, epicId: input.epicId },
    include: { epic: { select: { title: true, investScore: true } } },
  });
  if (!governed) throw new Error("GovernedEpic not found");

  const from = governed.governanceStatus as GovernanceState;
  if (!canTransition(from, input.to)) {
    throw new Error(`invalid transition ${from} -> ${input.to}`);
  }

  await database.$transaction(async (tx) => {
    await tx.governedEpic.update({
      where: { id: governed.id },
      data: { governanceStatus: input.to },
    });
    await tx.decisionLogEntry.create({
      data: {
        tenantId: ctx.tenantId,
        tipo: "epic_decision",
        targetType: "epic",
        targetId: input.epicId,
        valueStreamId: governed.valueStreamId ?? undefined,
        decisao: `${from} -> ${input.to}: ${governed.epic.title}`,
        justificativa: input.justificativa,
        dadosSuporte: {
          ...input.dadosSuporte,
          investScore: governed.epic.investScore,
          fromState: from,
          toState: input.to,
        },
        decisorId: ctx.userId,
      },
    });
  });

  return { ok: true, newState: input.to };
});
```

Step 3: Commit `feat(governance): transition action with mandatory justification + audit log`

---

## Task 4: Audit hooks em budget/theme

Files:
- Create: `apps/app/app/actions/governance/audit-hooks.ts`

Step 1: Hook chamado por LeanBudget/StrategicTheme mutations

```typescript
import { logDecision } from "./decision-log";

export async function logBudgetChange(
  ctx: { tenantId: string; userId: string },
  args: { budgetId: string; oldAmount: number; newAmount: number; justificativa: string; valueStreamId?: string }
) {
  return logDecision(ctx, {
    tipo: "budget_decision",
    targetType: "guardrail",
    targetId: args.budgetId,
    valueStreamId: args.valueStreamId,
    decisao: `Budget changed ${args.oldAmount} -> ${args.newAmount}`,
    justificativa: args.justificativa,
    dadosSuporte: { delta: args.newAmount - args.oldAmount, deltaPct: ((args.newAmount - args.oldAmount) / args.oldAmount) * 100 },
  });
}

export async function logThemeChange(
  ctx: { tenantId: string; userId: string },
  args: { themeId: string; field: string; oldValue: unknown; newValue: unknown; justificativa: string }
) {
  return logDecision(ctx, {
    tipo: "theme_decision",
    targetType: "theme",
    targetId: args.themeId,
    decisao: `Theme ${args.field} changed`,
    justificativa: args.justificativa,
    dadosSuporte: { field: args.field, before: args.oldValue, after: args.newValue },
  });
}
```

Step 2: Wire hooks em lean-budget/update e strategic-themes/update
Step 3: Commit `feat(governance): audit hooks for budget and theme changes`

---

## Task 5: Governance Kanban UI

Files:
- Create: `apps/app/app/(authenticated)/portfolio/governance/page.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/governance/components/governance-kanban.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/governance/components/epic-governance-card.tsx`

Step 1: Page com header + filtros (valueStream, theme)
Step 2: Kanban com 6 colunas, cards arrastáveis (DnD Kit)
Step 3: Card mostra: title, investScore, valueStream tag, theme color, owner avatar

```tsx
import { useDraggable } from "@dnd-kit/core";
import { InvestScoreBadge } from "../../components/invest-score-badge";

type Props = {
  epic: { id: string; title: string; investScore: number | null; valueStream?: string; themeColor?: string; ownerAvatarUrl?: string };
};

export function EpicGovernanceCard({ epic }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: epic.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
         className="rounded border bg-card p-3 shadow-sm hover:shadow">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium">{epic.title}</h4>
        <InvestScoreBadge score={epic.investScore} />
      </div>
      {epic.valueStream && (
        <div className="mt-2 text-xs text-muted-foreground">VS: {epic.valueStream}</div>
      )}
    </div>
  );
}
```

Step 4: Commit `feat(governance): portfolio governance kanban with drag transitions`

---

## Task 6: Transition dialog com justificativa

Files:
- Create: `apps/app/app/(authenticated)/portfolio/governance/components/transition-dialog.tsx`

Step 1: Dialog disparado pelo drop (drag end) ou botão explícito
Step 2: Form com:
- Próximo estado (computed from current via `nextStates`)
- Justificativa (textarea required, min 10 chars)
- Dados de suporte opcional (JSON livre)

```tsx
import { useState } from "react";
import { nextStates, type GovernanceState } from "@/app/actions/governance/state-machine";
import { transitionEpic } from "@/app/actions/governance/transition-epic";

type Props = {
  epicId: string;
  currentState: GovernanceState;
  proposedState: GovernanceState;
  onClose: () => void;
};

export function TransitionDialog({ epicId, currentState, proposedState, onClose }: Props) {
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = justificativa.trim().length >= 10;

  async function handleSubmit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      await transitionEpic({ epicId, to: proposedState, justificativa });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">
        {currentState} -> {proposedState}
      </h3>
      <p className="text-xs text-muted-foreground">
        Justificativa obrigatória (min 10 caracteres). Registrada no DecisionLog.
      </p>
      <textarea
        className="w-full rounded border p-2 text-sm"
        rows={4}
        value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)}
        placeholder="Ex: Aprovado em LPM weekly 2026-05-26; investScore 82 acima do threshold."
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-sm">Cancel</button>
        <button onClick={handleSubmit} disabled={!valid || submitting}
                className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">
          Confirm transition
        </button>
      </div>
    </div>
  );
}
```

Step 3: Commit `feat(governance): transition dialog with mandatory justification`

---

## Task 7: DecisionLog Timeline UI

Files:
- Create: `apps/app/app/(authenticated)/portfolio/governance/components/decision-log-timeline.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/governance/components/decision-log-filter.tsx`

Step 1: Timeline component que lê DecisionLogEntry filtrado por epic/budget/theme
Step 2: Cada item: data, decisor (avatar + nome), tipo (color-coded), decisao, justificativa expandable, dadosSuporte JSON viewer
Step 3: Drawer no Epic card para abrir timeline contextual
Step 4: Página dedicada `/portfolio/governance/decisions` com filtros
Step 5: Commit `feat(governance): decision log timeline + filtered audit view`

---

## Task 8: Export do DecisionLog para compliance

Files:
- Create: `apps/app/app/actions/governance/export-decisions.ts`

Step 1: Action que retorna CSV com colunas: data, tipo, target, decisao, justificativa, decisor, dados_suporte
Step 2: Filtro por período obrigatório (max 1 ano por export)
Step 3: Botão "Export for Audit" na página de filtros
Step 4: Commit `feat(governance): CSV export of decision log for SOX/FDA audit`

---

## Done When

- [ ] State machine bloqueia transições inválidas
- [ ] Toda transição grava DecisionLogEntry imutável
- [ ] Justificativa min 10 chars obrigatória em transição
- [ ] Mudanças em budget/theme também gravam decision log
- [ ] Portfolio Kanban com 6 colunas + DnD transitions
- [ ] Drawer mostra timeline de decisões do Epic
- [ ] Export CSV para auditoria por período
- [ ] Tests passando (state machine, transition, decision log)

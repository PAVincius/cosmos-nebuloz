# T13 — Copilot Modes por Role + Role UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copilot system prompt and suggested-prompt chips adapt dynamically to the user's SAFe role (RTE, LPM, PO, SM, DEV). Each role gets a dedicated mode with different context prelude and pre-built chips. Role detection comes from `ctx.roles` in the session — no extra config.

**Architecture:** `detectPrimaryRole(roles)` → role token → `buildRoleSystemPrompt(role)` returns prelude string → injected in Copilot session init alongside existing surface prelude. `<CopilotRoleBadge>` and `<CopilotSuggestedChips>` are client components driven by role token from session. No new DB schema.

**Tech Stack:** Next.js 15, existing `requireTenantSession`, existing Copilot thread infrastructure, shadcn/ui Badge + Button.

---

## File Structure

```
apps/app/app/actions/safe-copilot/
  roles/
    detect-role.ts               NEW: detectPrimaryRole(roles) → SAFe role token
    role-prompts.ts              NEW: buildRoleSystemPrompt(role) per RTE/LPM/PO/SM/DEV
    role-chips.ts                NEW: ROLE_SUGGESTED_CHIPS map per role

apps/app/app/(authenticated)/components/copilot/
  copilot-role-badge.tsx         NEW: badge showing active role in header
  copilot-role-chips.tsx         NEW: chip row with role-specific suggested prompts

apps/app/__tests__/actions/safe-copilot/
  detect-role.test.ts            NEW
  role-prompts.test.ts           NEW
```

---

## Task 1: Role detection utility

**Files:**
- Create: `apps/app/app/actions/safe-copilot/roles/detect-role.ts`
- Create: `apps/app/__tests__/actions/safe-copilot/detect-role.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { detectPrimaryRole, ROLE_PRIORITY } from "@/app/actions/safe-copilot/roles/detect-role";

describe("detectPrimaryRole", () => {
  it("returns RTE when among roles", () => {
    expect(detectPrimaryRole(["MEMBER", "RTE"])).toBe("RTE");
  });

  it("respects priority order — LPM beats SM", () => {
    expect(detectPrimaryRole(["SM", "LPM"])).toBe("LPM");
  });

  it("falls back to DEV for unknown roles", () => {
    expect(detectPrimaryRole(["MEMBER"])).toBe("DEV");
  });

  it("returns DEV for empty array", () => {
    expect(detectPrimaryRole([])).toBe("DEV");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/safe-copilot/detect-role.test.ts --no-coverage
```

- [ ] **Step 3: Implement**

```typescript
export type SAFeRole = "RTE" | "LPM" | "PO" | "SM" | "DEV";

// Priority: highest first — first match wins
export const ROLE_PRIORITY: SAFeRole[] = ["RTE", "LPM", "PO", "SM", "DEV"];

// Maps user role strings to SAFe role tokens
const ROLE_MAP: Record<string, SAFeRole> = {
  RTE: "RTE",
  STE: "RTE", // Solution Train Engineer maps to RTE context
  LPM: "LPM",
  ADMIN: "LPM", // Admins get LPM context by default
  PO: "PO",
  PRODUCT_OWNER: "PO",
  SM: "SM",
  SCRUM_MASTER: "SM",
  DEV: "DEV",
  MEMBER: "DEV",
};

export function detectPrimaryRole(roles: string[]): SAFeRole {
  for (const priority of ROLE_PRIORITY) {
    for (const r of roles) {
      if (ROLE_MAP[r.toUpperCase()] === priority) return priority;
    }
  }
  return "DEV";
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/safe-copilot/detect-role.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/safe-copilot/roles/detect-role.ts \
        apps/app/__tests__/actions/safe-copilot/detect-role.test.ts
git commit -m "feat(copilot): detectPrimaryRole — SAFe role priority mapping"
```

---

## Task 2: Role system prompt builders

**Files:**
- Create: `apps/app/app/actions/safe-copilot/roles/role-prompts.ts`
- Create: `apps/app/__tests__/actions/safe-copilot/role-prompts.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { buildRoleSystemPrompt } from "@/app/actions/safe-copilot/roles/role-prompts";

describe("buildRoleSystemPrompt", () => {
  it("RTE prompt contains ART and risk keywords", () => {
    const p = buildRoleSystemPrompt("RTE");
    expect(p).toContain("Release Train Engineer");
    expect(p).toContain("ROAM");
  });

  it("LPM prompt contains INVEST and WSJF", () => {
    const p = buildRoleSystemPrompt("LPM");
    expect(p).toContain("INVEST");
    expect(p).toContain("WSJF");
  });

  it("PO prompt focuses on acceptance criteria", () => {
    const p = buildRoleSystemPrompt("PO");
    expect(p).toContain("acceptance criteria");
  });

  it("SM prompt focuses on team and impediments", () => {
    const p = buildRoleSystemPrompt("SM");
    expect(p).toContain("impediment");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/safe-copilot/role-prompts.test.ts --no-coverage
```

- [ ] **Step 3: Implement**

```typescript
import type { SAFeRole } from "./detect-role";

const ROLE_PROMPTS: Record<SAFeRole, string> = {
  RTE: `## Your Active Role: Release Train Engineer (RTE)

You are helping a Release Train Engineer. Prioritize:
- Cross-team dependency management and ROAM risk resolution
- ART-level flow metrics (velocity, predictability, WIP overload alerts)
- PI Planning ceremony facilitation: identifying blockers before Day 2 commit
- Capacity and load balancing across teams within the ART
- Escalation paths for unresolved impediments

When the user asks about risks, always suggest ROAM classification (Resolved, Owned, Accepted, Mitigated).
When flow anomalies are present, lead with impact on PI objectives.`,

  LPM: `## Your Active Role: Lean Portfolio Manager (LPM)

You are helping a Lean Portfolio Manager. Prioritize:
- INVEST score assessment and Epic quality improvement recommendations
- WSJF prioritization rationale for portfolio backlog ordering
- Lean Budget guardrail analysis: themes vs actual spend
- Strategic Theme alignment for new Epics and investment decisions
- DecisionLog review: what governance decisions are pending
- Portfolio Kanban state transitions: when to move Epic to IMPLEMENTING

Cite INVEST criteria by name (Independent, Negotiable, Valuable, Estimable, Small, Testable).`,

  PO: `## Your Active Role: Product Owner (PO)

You are helping a Product Owner. Prioritize:
- Writing or refining user stories with clear acceptance criteria in Given/When/Then format
- Sprint backlog grooming: splitting large stories, estimating effort
- Clarifying Feature scope and mapping stories to PI objectives
- Identifying story dependencies that block delivery
- Ensuring Definition of Done is met before sprint review

When drafting acceptance criteria, always use Given/When/Then format.
Suggest split patterns (happy path / error path / edge case) when stories exceed 8 points.`,

  SM: `## Your Active Role: Scrum Master (SM)

You are helping a Scrum Master. Prioritize:
- Identifying and escalating impediments blocking team velocity
- Sprint health signals: WIP overload, blocked stories, low sprint goal confidence
- Retrospective action follow-through: are open improvement actions progressing?
- Team capacity planning for upcoming sprints
- Coaching on SAFe ceremonies: Daily Stand-up, Sprint Review, Sprint Retrospective

When discussing impediments, always ask: is this team-level or ART-level? If ART-level, escalate to RTE.`,

  DEV: `## Your Active Role: Developer / Team Member

You are helping a developer or team member. Prioritize:
- Story details, acceptance criteria clarification, and technical scope
- Finding related features, epics, or prior decisions that affect current work
- Dependency lookup: what other stories or features does this depend on?
- Sprint commitment: is the current story within team capacity?
- Technical risk flags: has this area had recent anomalies or defects?`,
};

export function buildRoleSystemPrompt(role: SAFeRole): string {
  return ROLE_PROMPTS[role];
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/safe-copilot/role-prompts.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/safe-copilot/roles/role-prompts.ts \
        apps/app/__tests__/actions/safe-copilot/role-prompts.test.ts
git commit -m "feat(copilot): role system prompts for RTE/LPM/PO/SM/DEV"
```

---

## Task 3: Role suggested chips

**Files:**
- Create: `apps/app/app/actions/safe-copilot/roles/role-chips.ts`

- [ ] **Step 1: Implement chip map**

```typescript
import type { SAFeRole } from "./detect-role";

export type SuggestedChip = {
  label: string;
  prompt: string;
};

export const ROLE_CHIPS: Record<SAFeRole, SuggestedChip[]> = {
  RTE: [
    { label: "🔴 Riscos ROAM pendentes", prompt: "Quais riscos do PI atual ainda não foram ROAMed? Liste por time." },
    { label: "📊 Anomalias de fluxo", prompt: "Tem alguma anomalia ativa no ART que pode impactar os objetivos da PI?" },
    { label: "⚠️ Dependências críticas", prompt: "Mostre as dependências cross-team mais críticas do PI atual." },
    { label: "🎯 Previsibilidade da PI", prompt: "Qual a previsibilidade atual da PI comparando objetivos planejados vs entregues?" },
  ],
  LPM: [
    { label: "🏆 Epics com baixo INVEST", prompt: "Quais Epics do portfólio têm pontuação INVEST abaixo de 50? Sugira melhorias." },
    { label: "💰 Budget vs real", prompt: "Como estão os gastos dos temas estratégicos comparando orçamento vs custo real de nuvem?" },
    { label: "📋 Próximas no Portfolio Kanban", prompt: "Quais Epics estão em ANALYZING e prontas para mover para PORTFOLIO_BACKLOG?" },
    { label: "⚖️ Prioridade WSJF", prompt: "Ordene as Epics do backlog por WSJF e justifique a prioridade das top 3." },
  ],
  PO: [
    { label: "✍️ Refinar história", prompt: "Ajuda a refinar a história atual em Given/When/Then com critérios de aceite claros." },
    { label: "✂️ Dividir história grande", prompt: "Esta história parece grande. Sugira como dividi-la em partes menores e testáveis." },
    { label: "🎯 Alinhamento com Feature", prompt: "As histórias do sprint atual estão alinhadas com os objetivos da Feature?" },
    { label: "📏 Estimativa de esforço", prompt: "Ajuda a estimar o esforço desta história em story points." },
  ],
  SM: [
    { label: "🚧 Impedimentos ativos", prompt: "Quais impedimentos estão bloqueando o time agora? Algum já foi escalado pro RTE?" },
    { label: "❤️ Saúde do sprint", prompt: "Como está a saúde do sprint atual? WIP, histórias bloqueadas, burndown." },
    { label: "🔄 Ações da retro", prompt: "As ações da última retrospectiva estão sendo executadas? O que está pendente?" },
    { label: "📅 Capacidade do próximo sprint", prompt: "Qual a capacidade estimada do time para o próximo sprint considerando folgas e eventos?" },
  ],
  DEV: [
    { label: "📖 Detalhes da história", prompt: "Explica os critérios de aceite da história atual e o que precisa ser feito." },
    { label: "🔗 Dependências", prompt: "Esta história tem dependências com outros times ou sistemas?" },
    { label: "🐛 Defects relacionados", prompt: "Tem algum defect aberto relacionado a esta área do sistema?" },
    { label: "📐 Escopo técnico", prompt: "Quais são os riscos técnicos desta história e como mitigá-los?" },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/actions/safe-copilot/roles/role-chips.ts
git commit -m "feat(copilot): role-specific suggested prompt chips per SAFe role"
```

---

## Task 4: Role badge + chips UI components

**Files:**
- Create: `apps/app/app/(authenticated)/components/copilot/copilot-role-badge.tsx`
- Create: `apps/app/app/(authenticated)/components/copilot/copilot-role-chips.tsx`

- [ ] **Step 1: Role badge**

```tsx
import { Badge } from "@/components/ui/badge";
import type { SAFeRole } from "@/app/actions/safe-copilot/roles/detect-role";

const ROLE_CONFIG: Record<SAFeRole, { label: string; color: string }> = {
  RTE: { label: "RTE", color: "bg-purple-100 text-purple-700 border-purple-300" },
  LPM: { label: "LPM", color: "bg-blue-100 text-blue-700 border-blue-300" },
  PO: { label: "PO", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  SM: { label: "SM", color: "bg-amber-100 text-amber-700 border-amber-300" },
  DEV: { label: "Dev", color: "bg-slate-100 text-slate-600 border-slate-300" },
};

interface Props {
  role: SAFeRole;
}

export function CopilotRoleBadge({ role }: Props) {
  const config = ROLE_CONFIG[role];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 font-semibold ${config.color}`}
      title={`Modo Copilot: ${config.label}`}
    >
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Suggested chips row**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import type { SAFeRole } from "@/app/actions/safe-copilot/roles/detect-role";
import { ROLE_CHIPS } from "@/app/actions/safe-copilot/roles/role-chips";

interface Props {
  role: SAFeRole;
  onSelect: (prompt: string) => void;
}

export function CopilotRoleChips({ role, onSelect }: Props) {
  const chips = ROLE_CHIPS[role] ?? [];

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {chips.map((chip) => (
        <Button
          key={chip.label}
          variant="outline"
          size="sm"
          className="h-7 text-xs rounded-full border-dashed"
          onClick={() => onSelect(chip.prompt)}
        >
          {chip.label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/components/copilot/copilot-role-badge.tsx \
        apps/app/app/\(authenticated\)/components/copilot/copilot-role-chips.tsx
git commit -m "feat(copilot): role badge + suggested chips UI components"
```

---

## Task 5: Wire role into Copilot session

**Files:**
- Modify: `apps/app/app/(authenticated)/components/copilot/copilot-chat.tsx`
- Modify: `apps/app/app/actions/safe-copilot/` — wherever session/thread is initialized

- [ ] **Step 1: Pass role token from session into Copilot**

In the Copilot FAB / trigger component, read session roles and pass role token as prop:

```tsx
// In the Copilot entrypoint Server Component that wraps the client chat
import { requireTenantSession } from "@repo/auth/server";
import { detectPrimaryRole } from "@/app/actions/safe-copilot/roles/detect-role";
import { headers } from "next/headers";

// ...inside the async Server Component:
const ctx = await requireTenantSession(await headers());
const role = detectPrimaryRole(ctx.roles ?? []);
// Pass role={role} to the Client Component Copilot
```

- [ ] **Step 2: Inject role system prompt in Copilot thread creation**

In the server action that creates a Copilot thread (e.g., `apps/app/app/actions/safe-copilot/`), add role prelude before existing surface prelude:

```typescript
import { detectPrimaryRole } from "./roles/detect-role";
import { buildRoleSystemPrompt } from "./roles/role-prompts";

// When building the system prompt array:
const rolePrompt = buildRoleSystemPrompt(detectPrimaryRole(ctx.roles ?? []));
const systemPrompt = [rolePrompt, surfacePrelude, existingInstructions]
  .filter(Boolean)
  .join("\n\n");
```

- [ ] **Step 3: Show badge in Copilot header**

In `copilot-chat.tsx` or `copilot-fullscreen.tsx`, render `<CopilotRoleBadge role={role} />` next to the Copilot title/header area.

- [ ] **Step 4: Show chips above input**

In the Copilot input area, render `<CopilotRoleChips role={role} onSelect={(p) => setInput(p)} />` when thread is empty (no messages yet).

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/\(authenticated\)/components/copilot/ \
        apps/app/app/actions/safe-copilot/
git commit -m "feat(copilot): wire role detection into system prompt + badge + chips"
```

---

## Done When

- [ ] `detectPrimaryRole(["RTE", "MEMBER"])` returns `"RTE"`
- [ ] Each role produces a distinct, non-empty system prompt with role-specific keywords
- [ ] Copilot header shows role badge matching session user
- [ ] Suggested chips appear in empty thread and pre-fill input on click
- [ ] Role system prompt is prepended to every Copilot session for this user
- [ ] Tests passing: `detect-role.test.ts`, `role-prompts.test.ts`

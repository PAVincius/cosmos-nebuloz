# Story 013 — Epic Lean Business Case & AI Copilot Drafting

**Epic:** 006 — Enhanced Portfolio & ART
**Feature:** F-003 Epic Value Definition
**WSJF:** 5.25 (userValue=5, timeValue=3, riskReduction=3, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Product Manager,
**I want** a structured Lean Business Case form with autosave, version history, and AI-assisted drafting,
**so that** I can build and refine a compelling business case for my epic without losing work and with AI assistance to accelerate hypothesis construction.

---

## Acceptance Criteria

### AC-001: Autosave with 800ms debounce
Given a PM is editing any field in the Lean Business Case form,
When they stop typing,
Then:
- The form auto-saves after 800ms of inactivity
- A "Saved" indicator appears within 200ms of the save completing
- The `Epic.updatedAt` timestamp is updated in the DB
- No explicit "Save" button press is required

### AC-002: Version snapshot stored on Copilot draft
Given a Copilot-drafted hypothesis is applied to the hypothesis field,
When the Copilot result is saved (either auto-save or explicit),
Then:
- A version snapshot is stored in `Epic.descriptionVersions` (ring buffer, last 50)
- The snapshot includes `{field: "hypothesis", prev: "...", next: "...", savedAt, savedBy: "COPILOT"}`
- The history panel shows the diff between current and prior with timestamp

### AC-003: DONE epic requires hypothesis resolution
Given a PM tries to close/navigate away from a DONE epic detail page without setting `hypothesisResolution`,
When the page closes or the breadcrumb is clicked,
Then:
- A blocking modal appears: "Before closing, please indicate the hypothesis resolution: Validated / Partially Validated / Invalidated"
- The epic cannot be marked DONE without this field set
- Setting it closes the modal and navigates away

### AC-004: Progress panel accuracy
Given an epic with 3 linked features (1 DONE, 2 IMPLEMENTING),
When the progress panel renders,
Then:
- Feature completion shows 33% (1/3 DONE)
- Per-feature status rows are visible with status badges
- If `leanBudgetAllocation` is set, an "Allocated Budget" figure is shown
- PI Objective count shows "0/3 Objectives with Achieved Value" until sprint review adds achievedValue

### AC-005: Business outcomes CRUD (max 5)
Given the PM adds 5 business outcomes,
When they attempt to add a 6th,
Then:
- The "Add Outcome" button is disabled
- A tooltip says "Maximum 5 business outcomes per epic"

Given 3 outcomes exist and the PM deletes one,
When the list re-renders,
Then:
- Only 2 outcomes remain, re-indexed
- Autosave fires and the DB reflects the deletion

### AC-006: Leading indicators CRUD (max 5)
Same as AC-005 but for leading indicators.

### AC-007: Hypothesis structure soft validation
Given the hypothesis field contains < 50 characters,
When the form renders the hypothesis field,
Then:
- An amber warning appears: "A strong hypothesis should describe what you believe will happen and how you'll measure it (aim for 50+ characters)"
- Save is NOT blocked (soft validation only)
- The INVEST score gate (Story-014) may block the ANALYZING → PORTFOLIO_BACKLOG transition based on length

### AC-008: Copilot "Draft for me" hypothesis generation
Given a PM opens the hypothesis Copilot assist panel,
When they click "Draft for me" (requires >= 100 chars description),
Then:
- A streaming `streamText` call renders the hypothesis in real time
- The user can Accept (replaces field + triggers version snapshot), Edit, or Discard
- If description < 100 chars, the button is disabled with "Add more description to generate a hypothesis"
- If rate limit is exceeded, a 429 banner appears with a retry-after timer

### AC-009: MVP field with size estimate
Given the PM fills the MVP field and selects size estimate "M",
When the form saves,
Then:
- Both `mvp` and `sizeEstimate` are persisted
- The size estimate feeds into WSJF jobSize suggestion (Story-015, not required here, but the field is present and linked)

---

## Technical Notes

### Form Architecture

```typescript
// apps/app/app/(authenticated)/portfolio/[epicId]/business-case/page.tsx
// Server component fetches epic data
// Client component handles form state + debounced autosave

'use client'
import { useDebounce } from '@repo/ui/hooks/use-debounce'

export function BusinessCaseForm({ epic }: { epic: Epic }) {
  const [form, setForm] = useState(toFormState(epic))
  const debouncedForm = useDebounce(form, 800)

  useEffect(() => {
    if (isDirty(form, epic)) {
      autosaveBusinessCase({ epicId: epic.id, ...debouncedForm })
    }
  }, [debouncedForm])

  // Ring buffer: last 50 versions in Epic.descriptionVersions (JSONB)
  // On Copilot apply: add snapshot before applying
}
```

### Version History Ring Buffer

```typescript
// Ring buffer implementation (immutable)
const pushVersion = (versions: Version[], newVersion: Version): Version[] => {
  const next = [...versions, newVersion]
  return next.length > 50 ? next.slice(next.length - 50) : next
}
```

### Terminal State Guard

```typescript
// TERMINAL_STATE block: if epic.status === 'DONE' || epic.status === 'REJECTED'
// Copilot actions return 422 { code: "TERMINAL_STATE" }
// Form fields render as read-only
```

### Hypothesis AI Drafting

```typescript
// apps/app/app/actions/ai-prompt/index.ts
export const draftHypothesisAction = withSecureAction(
  { schema: DraftHypothesisSchema, auditAction: 'ai.hypothesis_draft', auditResourceType: 'Epic' },
  async ({ epicId, description, businessContext }, ctx) => {
    // Rate limit check (Upstash)
    // Content-hash cache check (24h)
    // streamText via Vercel AI SDK
    // Audit log: model, tokens, latency, cached
    const result = streamText({
      model: openai('claude-sonnet-4-6'),
      system: buildHypothesisSystemPrompt(ctx.orgId),
      prompt: buildHypothesisPrompt({ description, businessContext }),
    })
    return result.toDataStreamResponse()
  }
)
```

---

## Schema Fields Used

From `Epic` model (extended in Story-011 migration):
- `hypothesis` — string, soft min 50 chars
- `businessOutcomes` — JSON array, max 5 items
- `leadingIndicators` — JSON array, max 5 items
- `nfrs` — string (optional)
- `mvp` — string (optional)
- `sizeEstimate` — enum XS|S|M|L|XL
- `descriptionVersions` — JSON ring buffer (last 50)
- `hypothesisResolution` — enum VALIDATED|PARTIALLY_VALIDATED|INVALIDATED

---

## Dependencies

- Story-011 (schema with new Epic fields)
- Story-022 (AI infra — Upstash rate limit, cache, Vercel AI SDK)
- `withSecureAction` HOF
- `@repo/ai` (shared AI utilities)

---

## Definition of Done

- [ ] Form with all LBC fields (hypothesis, outcomes ×5, indicators ×5, NFRs, MVP, size)
- [ ] 800ms debounce autosave with "Saved" indicator
- [ ] Version snapshot ring buffer (last 50) with diff viewer
- [ ] Copilot hypothesis drafting with streaming + Accept/Edit/Discard flow
- [ ] Terminal-state guard (read-only + 422 on AI actions)
- [ ] DONE epic hypothesis-resolution blocking modal
- [ ] Progress panel (features, budget, objectives)
- [ ] `hypothesisResolution` guard checked at DONE transition (Story-011)
- [ ] PT-BR + ES form labels
- [ ] Unit tests: autosave debounce, version ring buffer, terminal state guard

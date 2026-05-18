# Design Spec – Onboarding & Migration Assistant (COSMOS)

**Date:** 2026-05-17  
**Status:** Approved  
**Scope:** V1 – company_setup (7 steps) + migration_setup (6 steps, 4 sources)

---

## 1. Context

New tenants land in an empty COSMOS app with no SAFe structure. Without guidance they either abandon the tool or configure it incorrectly. The Onboarding & Migration Assistant solves both:

- **company_setup**: greenfield wizard that takes a new tenant from zero to "ready for first PI Planning" (Portfolio → VS → ART → Teams → PI).
- **migration_setup**: structured import wizard from Jira Cloud, Azure DevOps, Trello, or generic CSV.

Both flows use the same lightweight progress-tracking model (Approach B).

---

## 2. Architecture

### 2.1 DB Model (2 new tables)

```prisma
model OnboardingProgress {
  id             String   @id @default(cuid())
  tenantId       String
  flowType       String   // "company_setup" | "migration_setup"
  currentStep    Int      @default(0)
  completedSteps String[]
  data           Json     @default("{}")  // draft/accumulated step data
  status         String   @default("in_progress") // "in_progress" | "completed"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, flowType])
  @@index([tenantId])
}

model MigrationConnection {
  id            String   @id @default(cuid())
  tenantId      String
  source        String   // "csv" | "jira" | "azure" | "trello"
  config        Json     // { baseUrl?, apiToken?, pat?, projectKeys?, ... }
  status        String   @default("pending")  // "pending"|"connected"|"error"
  errorMessage  String?
  discoveryData Json?    // cached list of projects/boards/issue types
  mappingData   Json?    // user-approved source → COSMOS mapping
  importReport  Json?    // { created, updated, errors[] } after real import
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
}
```

**`OnboardingProgress.data` shape:**
```json
{
  "company_profile":  { "name": "Acme", "timezone": "America/Sao_Paulo", ... },
  "safe_structure":   { "portfolios": [...], "valueStreams": [...], "arts": [...] },
  "sectors":          { "departments": [...], "businessUnits": [...] },
  "org_chart":        { "nodes": [...] },
  "users_teams":      { "invites": [...], "teams": [...] },
  "pis_sprints":      { "pis": [...] }
}
```

### 2.2 Route Structure

```
app/(authenticated)/
  onboarding/
    page.tsx                  ← hub: redirect to active flow or show choice
    company/
      page.tsx                ← company_setup wizard (7 steps)
      complete/page.tsx       ← health-check completion screen
      components/
        company-wizard.tsx    ← stepper + state manager
        steps/
          step-company-profile.tsx
          step-safe-structure.tsx
          step-sectors.tsx
          step-org-chart.tsx
          step-users-teams.tsx
          step-pis-sprints.tsx
          step-health-check.tsx
    migration/
      page.tsx                ← migration_setup wizard (6 steps)
      complete/page.tsx       ← import report completion screen
      components/
        migration-wizard.tsx
        steps/
          step-source-select.tsx
          step-connect-integration.tsx
          step-discovery.tsx
          step-dry-run.tsx
          step-import.tsx
          step-post-migration.tsx

  app/api/
    migration/
      [source]/
        connect/route.ts      ← test connection + save credentials
        discover/route.ts     ← list projects/boards/issues
        dry-run/route.ts      ← simulate import
        import/route.ts       ← execute real import job
```

### 2.3 Auto-redirect

In `authenticated/layout.tsx`:
- After resolving `currentUser()`, call `getOrCreateOnboardingProgress(tenantId, "company_setup")`.
- If `status === "in_progress"` AND user has `org_admin` role AND current path is NOT under `/onboarding`, `/settings`, `/api`, or `/auth` → `redirect("/onboarding")`.
- This runs server-side so no flash.

### 2.4 State Management (client)

Each wizard is a `"use client"` component holding:
```typescript
interface WizardState {
  currentStep: number;
  completedSteps: Set<string>;
  stepData: Record<string, unknown>;  // accumulated across steps
  isSaving: boolean;
}
```

On "Save and advance":
1. Validate current step (Zod schema).
2. Call server action `saveOnboardingStep({ flowType, stepKey, data })`.
3. Server merges into `OnboardingProgress.data`, increments `currentStep`, appends to `completedSteps`.
4. Client advances to next step.

Steps that create real entities (SAFe structure, teams, PIs) call their respective existing server actions in addition to saving progress.

### 2.5 Wizard UI Shell (reuse existing)

`components/wizard-ui.tsx` already exists — use it for the stepper progress bar. Each step is a `WizardStep` component with:
- `onComplete(data: unknown): Promise<void>` — called with validated form data
- `onBack(): void`
- `defaultValues` — from `progress.data[stepKey]` so the form re-hydrates

---

## 3. company_setup — Step Details

| # | Key | Tipo | Responsável | Cria entidades |
|---|-----|------|------------|---------------|
| 1 | `company_profile` | form | org_admin | updates `Tenant` |
| 2 | `safe_structure` | form | lpm/sa | `Portfolio`, `ValueStream`, `ART` |
| 3 | `sectors` | form | org_admin | `Department`, `BusinessUnit` |
| 4 | `org_chart` | form | hr_admin | `OrgNode` (minimal) |
| 5 | `users_teams` | form | org_admin | invites, `Team`, `TeamMembership` |
| 6 | `pis_sprints` | form | rte | `PIPlan`, `Iteration` |
| 7 | `health_check` | review | org_admin | sets `status = "completed"` |

Steps 3 (sectors) and 4 (org chart) are `soft` required — user can skip with warning.

### Step 2 – safe_structure UI
Dynamic list: user adds N Portfolios, each with M Value Streams, each with K ARTs. Saved as nested JSON; entity creation happens on step `onComplete`.

### Step 7 – Health Check
Reads back from DB and shows:
- ✅/❌ At least 1 Portfolio, 1 VS, 1 ART
- ✅/❌ At least 1 PI configured
- ✅/❌ At least 1 Team with members
- ✅/❌ Users invited

If all ✅: "Complete Setup" button → sets `status = "completed"`.
If any ❌: shows which step to go back to fix.

---

## 4. migration_setup — Step Details

| # | Key | Tipo | What happens |
|---|-----|------|-------------|
| 1 | `source_select` | form | Choose source (csv/jira/azure/trello), select scope |
| 2 | `connect` | integration | Enter credentials, test connection, save `MigrationConnection` |
| 3 | `discovery` | integration | Call `/api/migration/[source]/discover`, show projects → suggest mapping |
| 4 | `dry_run` | preview | Call `/api/migration/[source]/dry-run`, show item counts + conflicts |
| 5 | `import` | integration | Call `/api/migration/[source]/import`, stream progress, save report |
| 6 | `post_migration` | review | Show `importReport`, gaps, "Accept migration" → status = "completed" |

### Integration Routes

Each source handler lives in `app/api/migration/[source]/`:

**`connect/route.ts`** — POST `{ source, config }`:
- Jira: `GET /rest/api/2/myself` with Basic auth (email:apiToken)
- Azure: `GET /_apis/projects?api-version=7.0` with Basic auth (any:PAT)
- Trello: `GET /1/members/me` with query params `?key=&token=`
- CSV: parse first 5 rows to validate headers

**`discover/route.ts`** — POST `{ connectionId }`:
- Jira: fetch projects, issue types (Epic/Story/Task), sprints
- Azure: fetch projects, work item types, iterations
- Trello: fetch boards, lists, cards
- CSV: parse full file, infer columns

**`dry-run/route.ts`** — POST `{ connectionId, mappingData }`:
- Apply mapping rules against discovered data
- Return `{ counts: { epics, features, stories, teams }, conflicts: [...] }`

**`import/route.ts`** — POST `{ connectionId, mappingData }`:
- Create COSMOS entities in correct order: Portfolio → VS → ART → Team → Epic → Feature → Story
- Return `importReport: { created, updated, errors }`

### Credential Security
- `config` JSON stored in `MigrationConnection` — should be encrypted at rest using `@repo/security` or env-based AES if available; at minimum, never expose raw credentials in client-facing API responses.
- `/api/migration/**` routes are authenticated (require tenant session).

### CSV Format (accepted columns)
```
type (epic|feature|story), title, description, status,
team, sprint, storyPoints, parentTitle
```
Parser: `csv-parse` npm package.

---

## 5. Component Architecture

```
company-wizard.tsx (Client)
├── WizardShell (from wizard-ui.tsx) — stepper, prev/next, progress %
└── steps/
    step-company-profile.tsx  ← react-hook-form + Zod
    step-safe-structure.tsx   ← dynamic list (add/remove portfolios)
    step-sectors.tsx          ← department/BU list
    step-org-chart.tsx        ← minimal tree input
    step-users-teams.tsx      ← invite emails + team builder
    step-pis-sprints.tsx      ← date pickers + iteration generator
    step-health-check.tsx     ← read-only check list

migration-wizard.tsx (Client)
├── WizardShell
└── steps/
    step-source-select.tsx     ← source type + scope radio/checkbox
    step-connect-integration.tsx ← source-specific credential form
    step-discovery.tsx         ← mapping table (source → COSMOS)
    step-dry-run.tsx           ← impact table + conflict list
    step-import.tsx            ← progress indicator + streaming
    step-post-migration.tsx    ← report + gap analysis
```

---

## 6. Server Actions

```
actions/onboarding/
  index.ts         — getOrCreateProgress, saveStep, completeFlow, getProgress
  company.ts       — createSAFeStructure, inviteUsers, createPIsForOnboarding
  migration.ts     — saveMigrationConnection, approveMigrationMapping
```

---

## 7. Error Handling

- Step save failures → toast error, step state reverts to `isSaving: false`, user can retry.
- Migration connection failures → step enters `error` state with message from server.
- Import partial failures → items with errors appear in `importReport.errors[]`; user can export error list and fix manually.

---

## 8. Out of Scope (V1)

- `OnboardingEvent` / `NotificationTemplate` tables (can be added in V2).
- Email notifications when steps become active for other roles.
- Rollback of migration (manual process, documented in UI).
- Jira OAuth flow (API token only for V1).
- Real-time import progress streaming (polling every 2s instead).

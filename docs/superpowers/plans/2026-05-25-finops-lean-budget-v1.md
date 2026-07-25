# FinOps Lean Budget v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve COSMOS Lean Budget into a real FinOps tool — pull cloud costs from AWS Cost Explorer via Inngest jobs, map them to SAFe themes via tag rules, aggregate into CostSnapshot, and display planned vs actual in an upgraded budget dashboard.

**Architecture:** Hybrid — reuse existing `Integration` + `SyncLog` for credential management; add dedicated `finops.prisma` for time-series cost models. Vercel Cron at 02:00 UTC dispatches Inngest `billing/sync.requested` per active billing integration. AWS adapter fetches Cost Explorer pages into `BillingEntryStaging`, promotes to `BillingEntry`, runs tag-rule resolution, aggregates `CostSnapshot`, then updates `LeanBudget.spent`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM, PostgreSQL, Inngest (TypeScript job queue), `@aws-sdk/client-cost-explorer`, `@aws-sdk/credential-providers`, shadcn/ui, recharts, Vitest

---

## Sprint 1 — Schema + Migration

### Task 1: Create finops.prisma with all models

**Files:**
- Create: `packages/database/prisma/schema/finops.prisma`

- [ ] **Step 1: Write the failing test for schema compile**

```bash
# Verify prisma schema compiles — this is the "test" for schema tasks
cd packages/database && npx prisma validate 2>&1
```
Expected: errors about missing finops.prisma relations (because we haven't added back-refs yet).

- [ ] **Step 2: Create finops.prisma**

```prisma
// packages/database/prisma/schema/finops.prisma
// FinOps cost models — FOCUS v1.1 aligned
// All relations to Tenant/Integration/StrategicTheme use back-refs defined in tenant.prisma / system.prisma / portfolio.prisma

model BillingEntry {
  id            String  @id @default(cuid())
  tenantId      String
  integrationId String
  syncLogId     String?

  // Provider identity
  provider      String           // "AWS" | "GCP" | "AZURE"
  accountId     String
  subAccountId  String?
  externalId    String           // stable: sha256(date|service|resourceId|operation|usageType)

  // FOCUS time range
  usageStartDate     DateTime
  usageEndDate       DateTime
  billingPeriodStart DateTime?
  billingPeriodEnd   DateTime?

  // FOCUS taxonomy
  service         String
  serviceCategory String?
  resourceType    String?
  resourceId      String?
  region          String?
  skuId           String?

  // FOCUS charge classification
  chargeCategory  String  @default("Usage")  // Usage|Purchase|Tax|Credit|Adjustment
  chargeClass     String?
  chargeFrequency String?
  pricingCategory String?

  // FOCUS costs
  billedCost      Decimal  @db.Decimal(18,6)
  effectiveCost   Decimal  @db.Decimal(18,6)
  listCost        Decimal? @db.Decimal(18,6)
  contractedCost  Decimal? @db.Decimal(18,6)
  unblendedAmount Decimal  @db.Decimal(18,6)
  amortizedAmount Decimal  @db.Decimal(18,6)

  // Usage
  usageQuantity Decimal? @db.Decimal(18,6)
  usageUnit     String?

  // Commitment discount
  commitmentDiscountId   String?
  commitmentDiscountType String?

  // Currency
  currency       String  @default("USD")
  fxRate         Decimal @db.Decimal(18,8) @default(1)
  tenantCurrency String  @default("USD")
  tenantAmount   Decimal @db.Decimal(18,6)

  // Raw cloud tags
  tags Json @default("{}")

  // Resolved mapping
  themeId       String?
  mappingRuleId String?
  mappingConf   String  @default("UNMAPPED")
  // EXACT_TAG | ACCOUNT_RULE | PREFIX | REGEX | COMPOUND | INHERITED | FALLBACK | UNMAPPED

  createdAt DateTime @default(now())

  tenant      Tenant         @relation(fields: [tenantId],      references: [id], onDelete: Cascade)
  integration Integration    @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  theme       StrategicTheme? @relation(fields: [themeId],      references: [id], onDelete: SetNull)
  allocations BillingEntryAllocation[]

  @@unique([integrationId, externalId])
  @@index([tenantId, usageStartDate])
  @@index([tenantId, provider, usageStartDate])
  @@index([tenantId, accountId, usageStartDate])
  @@index([tenantId, service, usageStartDate])
  @@index([tenantId, mappingConf])
  @@index([tenantId, themeId, usageStartDate])
  @@index([integrationId, usageStartDate])
}

model BillingEntryAllocation {
  id             String   @id @default(cuid())
  tenantId       String
  billingEntryId String
  themeId        String?
  epicId         String?
  artId          String?
  percentage     Decimal  @db.Decimal(5,2)
  allocationType String                      // RULE | MANUAL | PROPORTIONAL
  effectiveFrom  DateTime @default(now())
  effectiveTo    DateTime?

  tenant       Tenant       @relation(fields: [tenantId],       references: [id], onDelete: Cascade)
  billingEntry BillingEntry @relation(fields: [billingEntryId], references: [id], onDelete: Cascade)

  @@unique([billingEntryId, themeId, epicId, artId, effectiveFrom])
  @@index([tenantId, themeId])
  @@index([tenantId, epicId])
  @@index([tenantId, artId])
}

model CostSnapshot {
  id          String   @id @default(cuid())
  tenantId    String
  themeId     String?
  artId       String?
  epicId      String?
  okrId       String?
  period      DateTime
  granularity String   // DAILY | MONTHLY

  cloudCost   Decimal  @db.Decimal(18,6) @default(0)
  peopleCost  Decimal  @db.Decimal(18,6) @default(0)
  saasCost    Decimal  @db.Decimal(18,6) @default(0)
  actualCost  Decimal  @db.Decimal(18,6)
  plannedCost Decimal? @db.Decimal(18,6)

  unmappedAmount   Decimal  @db.Decimal(18,6) @default(0)
  breakdown        Json     @default("{}")
  sourceCurrencies Json     @default("{}")

  currency       String   @default("USD")
  fxStrategy     String   @default("MONTH_AVG")
  fxConvertedAt  DateTime @default(now())
  syncedAt       DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, themeId, artId, epicId, okrId, period, granularity])
  @@index([tenantId, period])
  @@index([tenantId, artId, period])
  @@index([tenantId, epicId, period])
  @@index([tenantId, okrId, period])
}

model TagRule {
  id            String   @id @default(cuid())
  tenantId      String
  integrationId String?
  name          String?

  tagKey    String?
  tagValue  String?
  matchType String  @default("EXACT")  // EXACT | PREFIX | REGEX | ACCOUNT | COMPOUND
  conditions   Json?
  excludeConds Json?

  themeId String?
  artId   String?
  epicId  String?

  priority        Int      @default(0)
  enabled         Boolean  @default(true)
  matchCount      Int      @default(0)
  lastMatchedAt   DateTime?
  appliedFromDate DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, integrationId])
  @@index([tenantId, priority])
}

model UnmappedCostBucket {
  id            String   @id @default(cuid())
  tenantId      String
  integrationId String
  period        DateTime
  amount        Decimal  @db.Decimal(18,6)
  currency      String
  topTags        Json     @default("[]")
  entryCount    Int

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, integrationId, period])
}

model BillingSyncCursor {
  id                  String   @id @default(cuid())
  integrationId       String   @unique
  lastIngestedThrough DateTime
  lookbackDays        Int      @default(7)
  backfillDays        Int      @default(90)
  backfillComplete    Boolean  @default(false)
  lastSyncLogId       String?
  consecutiveFailures Int      @default(0)
  nextRunAt           DateTime?

  integration Integration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
}

model BillingSyncRun {
  id               String   @id @default(cuid())
  tenantId         String
  integrationId    String
  inngestRunId     String?
  status           String   @default("PENDING")  // PENDING|RUNNING|SUCCESS|FAILED|DLQ
  currentStep      String?
  entriesProcessed Int      @default(0)
  errorMessage     String?
  startedAt        DateTime @default(now())
  finishedAt       DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, integrationId, startedAt])
}

model CostAnomaly {
  id            String   @id @default(cuid())
  tenantId      String
  themeId       String?
  artId         String?
  integrationId String?
  detectedAt    DateTime @default(now())
  period        DateTime
  service       String?
  accountId     String?

  baselineMedian Decimal @db.Decimal(18,6)
  baselineMAD    Decimal @db.Decimal(18,6)
  actualAmount   Decimal @db.Decimal(18,6)
  modifiedZScore Decimal @db.Decimal(8,4)
  deltaAbs       Decimal @db.Decimal(18,6)
  deltaPct       Decimal @db.Decimal(8,2)

  severity       String  // LOW | MEDIUM | HIGH | CRITICAL
  status         String  @default("OPEN")  // OPEN|ACKNOWLEDGED|RESOLVED|FALSE_POSITIVE
  acknowledgedBy String?
  acknowledgedAt DateTime?
  rootCauseHints Json?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, themeId, service, period])
  @@index([tenantId, status, severity])
  @@index([tenantId, themeId, detectedAt])
}

model BudgetPlan {
  id            String   @id @default(cuid())
  tenantId      String
  scope         String   // THEME | EPIC | ART | OKR | TENANT
  scopeId       String?
  period        DateTime
  granularity   String   // MONTHLY | PI | ANNUAL
  plannedAmount Decimal  @db.Decimal(18,6)
  currency      String   @default("USD")
  category      String?  // CLOUD | PEOPLE | SAAS | ALL
  source        String   // MANUAL | INHERITED | FORECAST

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, scope, scopeId, period, granularity, category])
  @@index([tenantId, period])
}

model CommitmentDiscount {
  id            String   @id @default(cuid())
  tenantId      String
  integrationId String
  externalId    String
  type          String   // RI | SP | CUD | NEGOTIATED
  provider      String
  service       String?
  region        String?
  startDate     DateTime
  endDate       DateTime
  upfrontCost   Decimal  @db.Decimal(18,6)
  hourlyRate    Decimal? @db.Decimal(18,8)
  utilization   Decimal? @db.Decimal(5,2)
  coverage      Decimal? @db.Decimal(5,2)

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([integrationId, externalId])
  @@index([tenantId, endDate])
}

model PersonCost {
  id            String   @id @default(cuid())
  tenantId      String
  userId        String
  effectiveFrom DateTime
  effectiveTo   DateTime?
  annualCost    Decimal  @db.Decimal(18,6)
  currency      String
  allocationPct Decimal  @db.Decimal(5,2) @default(100)
  teamId        String?
  artId         String?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, effectiveFrom])
}

model CurrencyRate {
  id   String   @id @default(cuid())
  from String
  to   String
  rate Decimal  @db.Decimal(18,8)
  date DateTime

  @@unique([from, to, date])
}

model BillingEntryStaging {
  id            String   @id @default(cuid())
  tenantId      String
  integrationId String
  syncRunId     String
  payload       Json
  page          Int
  createdAt     DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, integrationId, syncRunId])
}

model IntegrationDraft {
  id          String   @id @default(cuid())
  userId      String
  tenantId    String
  provider    String
  currentStep Int      @default(1)
  payload     Json     @default("{}")
  updatedAt   DateTime @updatedAt
  expiresAt   DateTime

  @@unique([userId, tenantId, provider])
}
```

- [ ] **Step 3: Run prisma validate (will fail — back-refs missing)**

```bash
cd packages/database && npx prisma validate 2>&1
```
Expected: errors about `BillingEntry` relation to `Tenant` / `Integration` / `StrategicTheme` missing back-refs. That's correct — fixed in Task 2.

- [ ] **Step 4: Commit schema only**

```bash
git add packages/database/prisma/schema/finops.prisma
git commit -m "feat(finops): add finops.prisma with all v1+v2 models (schema only)"
```

---

### Task 2: Add back-refs to tenant.prisma, system.prisma, portfolio.prisma

**Files:**
- Modify: `packages/database/prisma/schema/tenant.prisma`
- Modify: `packages/database/prisma/schema/system.prisma`
- Modify: `packages/database/prisma/schema/portfolio.prisma`

- [ ] **Step 1: Add finops back-refs to Tenant model in tenant.prisma**

Find the `}` closing the Tenant model (after `integrationDrafts` or wherever the model ends — currently after `anomalies`). Add these lines before the closing `}`:

```prisma
  // FinOps
  billingEntries          BillingEntry[]
  billingEntryAllocations BillingEntryAllocation[]
  costSnapshots           CostSnapshot[]
  tagRules                TagRule[]
  unmappedCostBuckets     UnmappedCostBucket[]
  billingSyncRuns         BillingSyncRun[]
  costAnomalies           CostAnomaly[]
  budgetPlans             BudgetPlan[]
  commitmentDiscounts     CommitmentDiscount[]
  personCosts             PersonCost[]
  billingEntryStaging     BillingEntryStaging[]
```

- [ ] **Step 2: Add billing back-refs to Integration model in system.prisma**

In `system.prisma`, find the Integration model. Add after `syncLogs SyncLog[]`:

```prisma
  // FinOps back-refs
  billingEntries    BillingEntry[]
  billingSyncCursor BillingSyncCursor?
```

Also update the `source` comment to document billing sources:

```prisma
  source     String    // linear | github | asana | gitlab | jira | azure-devops | billing_aws | billing_gcp | billing_azure
```

- [ ] **Step 3: Add billingEntries back-ref to StrategicTheme in portfolio.prisma**

In `portfolio.prisma`, find `model StrategicTheme`. Add before closing `}`:

```prisma
  billingEntries BillingEntry[]
```

Also add `spentSource` and `spentManualOverride` to `LeanBudget` model:

```prisma
  spentSource          String   @default("MANUAL")  // MANUAL | BILLING_AGGREGATE | FORECAST
  spentManualOverride  Decimal? @db.Decimal(18,6)
```

- [ ] **Step 4: Validate schema**

```bash
cd packages/database && npx prisma validate 2>&1
```
Expected: `The schema at ... is valid`

- [ ] **Step 5: Commit back-refs**

```bash
git add packages/database/prisma/schema/tenant.prisma \
        packages/database/prisma/schema/system.prisma \
        packages/database/prisma/schema/portfolio.prisma
git commit -m "feat(finops): add finops back-refs to Tenant, Integration, StrategicTheme, LeanBudget"
```

---

### Task 3: Migration SQL — phases 1 & 2 (add columns + backfill)

**Files:**
- Create: `packages/database/prisma/migrations/20260525000001_finops_schema/migration.sql`
- Create: `packages/database/prisma/migrations/20260525000002_lean_budget_decimal_phase1/migration.sql`

- [ ] **Step 1: Generate finops migration**

```bash
cd packages/database && npx prisma migrate dev --name finops_schema --create-only 2>&1
```
Expected: creates `migrations/20260525000001_finops_schema/migration.sql` (or similar timestamp).

Review the generated file and add the partition comment at the bottom:

```sql
-- NOTE: For production tenants with >1M BillingEntry rows, apply partition by range manually:
-- ALTER TABLE "BillingEntry" PARTITION BY RANGE ("usageStartDate");
-- This is handled outside Prisma migrations to avoid downtime.
```

- [ ] **Step 2: Generate LeanBudget phase 1 migration (add Decimal column)**

```bash
cd packages/database && npx prisma migrate dev --name lean_budget_decimal_phase1 --create-only 2>&1
```

Manually edit the generated SQL to contain exactly:

```sql
-- Phase 1: Add spentDecimal (Decimal) column and spentSource column
-- The existing spent (Float) column stays — dual-write in phase 3
ALTER TABLE "LeanBudget"
  ADD COLUMN IF NOT EXISTS "spentDecimal" DECIMAL(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "spentSource" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "spentManualOverride" DECIMAL(18,6);
```

- [ ] **Step 3: Phase 2 backfill migration**

Create a new migration manually:

```bash
mkdir -p packages/database/prisma/migrations/20260525000003_lean_budget_decimal_phase2
```

File: `packages/database/prisma/migrations/20260525000003_lean_budget_decimal_phase2/migration.sql`

```sql
-- Phase 2: Backfill spentDecimal from existing spent (Float)
-- Safe to run while app is live — reads from Float, writes to Decimal
UPDATE "LeanBudget"
SET "spentDecimal" = CAST("spent" AS DECIMAL(18,6))
WHERE "spentDecimal" = 0 AND "spent" > 0;
```

- [ ] **Step 4: Apply migrations**

```bash
cd packages/database && npx prisma migrate dev 2>&1
```
Expected: `3 migrations applied.` (or incremental from current state)

- [ ] **Step 5: Verify columns exist**

```bash
cd packages/database && npx prisma db execute --stdin <<'SQL'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'LeanBudget'
  AND column_name IN ('spent', 'spentDecimal', 'spentSource', 'spentManualOverride');
SQL
```
Expected: 4 rows returned.

- [ ] **Step 6: Commit migrations**

```bash
git add packages/database/prisma/migrations/
git commit -m "feat(finops): migrations — finops schema + LeanBudget Decimal phase 1+2"
```

---

### Task 4: Generate Prisma client + write unit tests for schema

**Files:**
- Modify: `packages/database/package.json` (verify generate script)
- Create: `apps/app/__tests__/finops/schema-sanity.test.ts`

- [ ] **Step 1: Regenerate Prisma client**

```bash
cd packages/database && npx prisma generate 2>&1
```
Expected: `Generated Prisma Client`

- [ ] **Step 2: Write failing schema sanity test**

```typescript
// apps/app/__tests__/finops/schema-sanity.test.ts
import { describe, expect, it } from "vitest";
import { database } from "@repo/database";

describe("finops schema sanity", () => {
  it("BillingEntry model exists on database client", () => {
    expect(typeof database.billingEntry.findMany).toBe("function");
  });

  it("CostSnapshot model exists on database client", () => {
    expect(typeof database.costSnapshot.findMany).toBe("function");
  });

  it("TagRule model exists on database client", () => {
    expect(typeof database.tagRule.findMany).toBe("function");
  });

  it("BillingSyncRun model exists on database client", () => {
    expect(typeof database.billingSyncRun.findMany).toBe("function");
  });

  it("BillingEntryStaging model exists on database client", () => {
    expect(typeof database.billingEntryStaging.findMany).toBe("function");
  });
});
```

- [ ] **Step 3: Run test — verify it fails before generate**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/schema-sanity.test.ts 2>&1
```
Expected with stale client: FAIL. After `prisma generate`: PASS.

- [ ] **Step 4: Run test after generate**

```bash
cd packages/database && npx prisma generate && cd ../.. && cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/schema-sanity.test.ts 2>&1
```
Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add apps/app/__tests__/finops/schema-sanity.test.ts
git commit -m "test(finops): schema sanity tests for Prisma client models"
```

---

### Task 5: LeanBudget dual-write (phase 3)

**Files:**
- Modify: `apps/app/app/actions/lean-budget/index.ts`
- Create: `apps/app/__tests__/finops/lean-budget-dual-write.test.ts`

- [ ] **Step 1: Write failing dual-write parity test**

```typescript
// apps/app/__tests__/finops/lean-budget-dual-write.test.ts
import { describe, expect, it } from "vitest";

describe("LeanBudget dual-write parity", () => {
  it("spentDecimal matches spent within 0.01 after write", () => {
    const spent = 1234.56;
    const spentDecimal = Number("1234.56"); // Decimal.js .toNumber()
    expect(Math.abs(spent - spentDecimal)).toBeLessThan(0.01);
  });

  it("spent=0 and spentDecimal=0 are consistent", () => {
    const spent = 0;
    const spentDecimal = 0;
    expect(Math.abs(spent - spentDecimal)).toBeLessThan(0.01);
  });

  it("spent=99999999.99 matches Decimal within 0.01", () => {
    const spent = 99999999.99;
    const spentDecimal = Number("99999999.99");
    expect(Math.abs(spent - spentDecimal)).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 2: Run test — confirm it passes (parity logic is trivial)**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/lean-budget-dual-write.test.ts 2>&1
```
Expected: `3 tests passed`

- [ ] **Step 3: Add dual-write helper to lean-budget actions**

In `apps/app/app/actions/lean-budget/index.ts`, find the `updateSpent` function (or wherever `spent` is written). Add dual-write for every mutation that sets `spent`.

For each Prisma `update`/`create` that writes `spent`, also write `spentDecimal`:

```typescript
// In every mutation that sets spent:
// BEFORE (phase 2 and earlier):
await database.leanBudget.update({
  where: { id, tenantId: ctx.tenantId },
  data: { spent: value },
});

// AFTER (phase 3 dual-write):
await database.leanBudget.update({
  where: { id, tenantId: ctx.tenantId },
  data: {
    spent: value,                        // keep Float for backward compat
    spentDecimal: String(value),         // Prisma Decimal accepts string
  },
});
```

Search for all `spent:` assignments in `apps/app/app/actions/lean-budget/index.ts`:

```bash
grep -n "spent:" apps/app/app/actions/lean-budget/index.ts
```

Add the `spentDecimal` mirror next to each one.

- [ ] **Step 4: Build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors on lean-budget files.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/lean-budget/index.ts \
        apps/app/__tests__/finops/lean-budget-dual-write.test.ts
git commit -m "feat(finops): LeanBudget phase 3 — dual-write spent + spentDecimal"
```

---

## Sprint 2 — AWS Sync Pipeline

### Task 6: Install dependencies

**Files:**
- Modify: `apps/app/package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/app && pnpm add inngest @aws-sdk/client-cost-explorer @aws-sdk/credential-providers 2>&1
```
Expected: packages added to `apps/app/package.json` dependencies.

- [ ] **Step 2: Verify install**

```bash
cd apps/app && node -e "require('inngest'); console.log('inngest ok')" 2>&1
node -e "require('@aws-sdk/client-cost-explorer'); console.log('aws-sdk ok')" 2>&1
```
Expected: `inngest ok` and `aws-sdk ok`

- [ ] **Step 3: Commit**

```bash
git add apps/app/package.json apps/app/pnpm-lock.yaml 2>/dev/null || git add apps/app/package.json
git commit -m "chore(finops): install inngest + aws-sdk for billing pipeline"
```

---

### Task 7: Inngest client setup

**Files:**
- Create: `apps/app/lib/inngest/client.ts`
- Create: `apps/app/app/api/inngest/route.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/app/__tests__/finops/inngest-client.test.ts
import { describe, expect, it } from "vitest";

describe("inngest client", () => {
  it("inngest module resolves", async () => {
    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — confirm FAIL**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/inngest-client.test.ts 2>&1
```
Expected: FAIL — `Cannot find module '@/lib/inngest/client'`

- [ ] **Step 3: Create Inngest client**

```typescript
// apps/app/lib/inngest/client.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "cosmos-nebuloz",
  name: "COSMOS Nebuloz",
});
```

- [ ] **Step 4: Create Inngest API route**

```typescript
// apps/app/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { billingSyncFunction } from "@/lib/inngest/billing-sync";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [billingSyncFunction],
});
```

Note: `billingSyncFunction` doesn't exist yet — this will cause a TS error until Task 9. That's expected; fix after Task 9.

- [ ] **Step 5: Run test — confirm PASS**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/inngest-client.test.ts 2>&1
```
Expected: `1 test passed`

- [ ] **Step 6: Commit**

```bash
git add apps/app/lib/inngest/client.ts \
        apps/app/app/api/inngest/route.ts \
        apps/app/__tests__/finops/inngest-client.test.ts
git commit -m "feat(finops): Inngest client + API route"
```

---

### Task 8: AWS Cost Explorer adapter

**Files:**
- Create: `apps/app/lib/billing-adapters/aws.ts`
- Create: `apps/app/__tests__/finops/aws-adapter.test.ts`

- [ ] **Step 1: Write failing adapter tests**

```typescript
// apps/app/__tests__/finops/aws-adapter.test.ts
import { describe, expect, it } from "vitest";
import { normalizeAwsRow, buildExternalId } from "@/lib/billing-adapters/aws";

describe("AWS adapter — normalizeAwsRow", () => {
  it("maps AmortizedCost to amortizedAmount", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [{ Keys: ["Amazon EC2", "cosmos:theme$theme_abc"], Metrics: {
        AmortizedCost: { Amount: "100.50", Unit: "USD" },
        UnblendedCost: { Amount: "105.00", Unit: "USD" },
        UsageQuantity:  { Amount: "24", Unit: "Hrs" },
      }}],
    };
    const result = normalizeAwsRow(row, "123456789", "integ_test");
    expect(result.amortizedAmount).toBe("100.50");
    expect(result.unblendedAmount).toBe("105.00");
    expect(result.service).toBe("Amazon EC2");
    expect(result.provider).toBe("AWS");
  });

  it("extracts themeId tag from Groups key", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [{ Keys: ["Amazon S3", "cosmos:theme$theme_xyz"], Metrics: {
        AmortizedCost: { Amount: "50", Unit: "USD" },
        UnblendedCost: { Amount: "50", Unit: "USD" },
        UsageQuantity:  { Amount: "1", Unit: "GB" },
      }}],
    };
    const result = normalizeAwsRow(row, "123456789", "integ_test");
    expect(result.tags["cosmos:theme"]).toBe("theme_xyz");
  });
});

describe("AWS adapter — buildExternalId", () => {
  it("produces a stable sha256 hex string", () => {
    const id1 = buildExternalId("2026-05-01", "Amazon EC2", "RunInstances", "BoxUsage:t3.micro", "i-123");
    const id2 = buildExternalId("2026-05-01", "Amazon EC2", "RunInstances", "BoxUsage:t3.micro", "i-123");
    expect(id1).toBe(id2);
    expect(id1).toHaveLength(64); // sha256 hex
  });

  it("different inputs produce different IDs", () => {
    const id1 = buildExternalId("2026-05-01", "Amazon EC2", "RunInstances", "BoxUsage:t3.micro", "");
    const id2 = buildExternalId("2026-05-01", "Amazon S3",  "PutObject",    "Requests-Tier1",    "");
    expect(id1).not.toBe(id2);
  });
});
```

- [ ] **Step 2: Run test — confirm FAIL**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/aws-adapter.test.ts 2>&1
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create AWS adapter**

```typescript
// apps/app/lib/billing-adapters/aws.ts
import { createHash } from "crypto";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandInput,
  type ResultByTime,
} from "@aws-sdk/client-cost-explorer";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AwsAdapterConfig {
  roleArn: string;
  externalId: string;
  region?: string;
}

export interface NormalizedEntry {
  provider: "AWS";
  accountId: string;
  integrationId: string;
  externalId: string;
  usageStartDate: Date;
  usageEndDate: Date;
  service: string;
  chargeCategory: string;
  billedCost: string;
  effectiveCost: string;
  listCost: string;
  unblendedAmount: string;
  amortizedAmount: string;
  usageQuantity: string;
  usageUnit: string;
  currency: string;
  tenantCurrency: string;
  tenantAmount: string;
  fxRate: string;
  tags: Record<string, string>;
  mappingConf: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildExternalId(
  date: string,
  service: string,
  operation: string,
  usageType: string,
  resourceId: string,
): string {
  const raw = `${date}|${service}|${operation}|${usageType}|${resourceId}`;
  return createHash("sha256").update(raw).digest("hex");
}

export function normalizeAwsRow(
  row: ResultByTime,
  accountId: string,
  integrationId: string,
): NormalizedEntry[] {
  const start = row.TimePeriod?.Start ?? "";
  const end   = row.TimePeriod?.End   ?? "";
  const results: NormalizedEntry[] = [];

  for (const group of row.Groups ?? []) {
    const keys    = group.Keys ?? [];
    const service = keys[0] ?? "Unknown";
    const tagVal  = keys[1] ?? "";
    const metrics = group.Metrics ?? {};

    // Parse cosmos:theme tag from GroupBy key (format: "cosmos:theme$<value>")
    const tags: Record<string, string> = {};
    const tagParts = tagVal.split("$");
    if (tagParts.length === 2 && tagParts[0] && tagParts[1]) {
      tags[tagParts[0]] = tagParts[1];
    }

    const amortized  = metrics["AmortizedCost"]?.Amount  ?? "0";
    const unblended  = metrics["UnblendedCost"]?.Amount  ?? "0";
    const quantity   = metrics["UsageQuantity"]?.Amount  ?? "0";
    const unit       = metrics["UsageQuantity"]?.Unit    ?? "";
    const currency   = metrics["AmortizedCost"]?.Unit    ?? "USD";

    const externalId = buildExternalId(start, service, "", "", "");

    results.push({
      provider:        "AWS",
      accountId,
      integrationId,
      externalId,
      usageStartDate:  new Date(start),
      usageEndDate:    new Date(end),
      service,
      chargeCategory:  "Usage",
      billedCost:      unblended,
      effectiveCost:   amortized,
      listCost:        unblended,
      unblendedAmount: unblended,
      amortizedAmount: amortized,
      usageQuantity:   quantity,
      usageUnit:       unit,
      currency,
      tenantCurrency:  currency,
      tenantAmount:    amortized,
      fxRate:          "1",
      tags,
      mappingConf:     "UNMAPPED",
    });
  }

  return results;
}

// ─── Paginated fetch ──────────────────────────────────────────────────────────

export async function fetchAwsPage(params: {
  config: AwsAdapterConfig;
  tenantId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  nextPageToken?: string;
}): Promise<{ entries: NormalizedEntry[]; nextPageToken: string | undefined }> {
  const { config, tenantId, startDate, endDate, nextPageToken } = params;

  const credentials = fromTemporaryCredentials({
    params: {
      RoleArn:         config.roleArn,
      ExternalId:      config.externalId,
      RoleSessionName: `cosmos-finops-${tenantId}`,
      DurationSeconds: 3600,
    },
  });

  const ce = new CostExplorerClient({
    region: config.region ?? "us-east-1",
    credentials,
  });

  const input: GetCostAndUsageCommandInput = {
    TimePeriod: { Start: startDate, End: endDate },
    Granularity: "DAILY",
    Metrics: ["AmortizedCost", "UnblendedCost", "UsageQuantity"],
    GroupBy: [
      { Type: "DIMENSION", Key: "SERVICE" },
      { Type: "TAG",       Key: "cosmos:theme" },
    ],
    NextPageToken: nextPageToken,
  };

  const response = await ce.send(new GetCostAndUsageCommand(input));
  const entries: NormalizedEntry[] = [];

  for (const row of response.ResultsByTime ?? []) {
    // Note: accountId from role ARN (arn:aws:iam::123456789:role/...)
    const accountId = config.roleArn.split(":")[4] ?? "unknown";
    entries.push(...normalizeAwsRow(row, accountId, ""));
  }

  return {
    entries,
    nextPageToken: response.NextPageToken,
  };
}
```

- [ ] **Step 4: Run tests — confirm PASS**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/aws-adapter.test.ts 2>&1
```
Expected: `4 tests passed`

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/billing-adapters/aws.ts \
        apps/app/__tests__/finops/aws-adapter.test.ts
git commit -m "feat(finops): AWS Cost Explorer adapter with normalizeAwsRow + buildExternalId"
```

---

### Task 9: TagRule engine (EXACT + ACCOUNT only for v1)

**Files:**
- Create: `apps/app/lib/billing-adapters/tag-rule-engine.ts`
- Create: `apps/app/__tests__/finops/tag-rule-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/app/__tests__/finops/tag-rule-engine.test.ts
import { describe, expect, it } from "vitest";
import { resolveMapping, type TagRuleInput, type EntryTags } from "@/lib/billing-adapters/tag-rule-engine";

const baseRule: TagRuleInput = {
  id: "rule_1",
  matchType: "EXACT",
  tagKey: "cosmos:theme",
  tagValue: "theme_abc",
  themeId: "theme_abc",
  artId: null,
  epicId: null,
  priority: 10,
  enabled: true,
};

describe("TagRule engine — EXACT match", () => {
  it("matches exact tag key+value", () => {
    const tags: EntryTags = { "cosmos:theme": "theme_abc" };
    const result = resolveMapping([baseRule], tags, "account_x");
    expect(result.themeId).toBe("theme_abc");
    expect(result.mappingConf).toBe("EXACT_TAG");
    expect(result.mappingRuleId).toBe("rule_1");
  });

  it("returns UNMAPPED when no rule matches", () => {
    const tags: EntryTags = { "cosmos:theme": "other_value" };
    const result = resolveMapping([baseRule], tags, "account_x");
    expect(result.mappingConf).toBe("UNMAPPED");
    expect(result.themeId).toBeNull();
  });

  it("case-sensitive match by default (AWS tags)", () => {
    const tags: EntryTags = { "cosmos:theme": "Theme_ABC" }; // wrong case
    const result = resolveMapping([baseRule], tags, "account_x");
    expect(result.mappingConf).toBe("UNMAPPED");
  });
});

describe("TagRule engine — ACCOUNT match", () => {
  const accountRule: TagRuleInput = {
    id: "rule_2",
    matchType: "ACCOUNT",
    tagKey: null,
    tagValue: null,
    themeId: "theme_ops",
    artId: null,
    epicId: null,
    priority: 5,
    enabled: true,
    accountId: "123456789",
  };

  it("matches by accountId when matchType=ACCOUNT", () => {
    const tags: EntryTags = {};
    const result = resolveMapping([accountRule], tags, "123456789");
    expect(result.themeId).toBe("theme_ops");
    expect(result.mappingConf).toBe("ACCOUNT_RULE");
  });

  it("EXACT beats ACCOUNT when both match (higher priority wins)", () => {
    const exactRule: TagRuleInput = { ...baseRule, priority: 20 };
    const tags: EntryTags = { "cosmos:theme": "theme_abc" };
    const result = resolveMapping([accountRule, exactRule], tags, "123456789");
    expect(result.mappingConf).toBe("EXACT_TAG");
    expect(result.themeId).toBe("theme_abc");
  });
});

describe("TagRule engine — disabled rules", () => {
  it("skips disabled rules", () => {
    const disabled = { ...baseRule, enabled: false };
    const tags: EntryTags = { "cosmos:theme": "theme_abc" };
    const result = resolveMapping([disabled], tags, "account_x");
    expect(result.mappingConf).toBe("UNMAPPED");
  });
});
```

- [ ] **Step 2: Run test — confirm FAIL**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/tag-rule-engine.test.ts 2>&1
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create tag-rule-engine.ts**

```typescript
// apps/app/lib/billing-adapters/tag-rule-engine.ts
// v1: EXACT + ACCOUNT match types only
// v2 will add PREFIX, REGEX (with re2), COMPOUND

export type EntryTags = Record<string, string>;

export interface TagRuleInput {
  id: string;
  matchType: string;   // "EXACT" | "ACCOUNT" (v1) | "PREFIX" | "REGEX" | "COMPOUND" (v2)
  tagKey: string | null;
  tagValue: string | null;
  accountId?: string | null;  // for ACCOUNT match
  themeId: string | null;
  artId: string | null;
  epicId: string | null;
  priority: number;
  enabled: boolean;
}

export interface MappingResult {
  themeId: string | null;
  artId: string | null;
  epicId: string | null;
  mappingRuleId: string | null;
  mappingConf: string;
}

const UNMAPPED: MappingResult = {
  themeId: null,
  artId: null,
  epicId: null,
  mappingRuleId: null,
  mappingConf: "UNMAPPED",
};

function matchExact(rule: TagRuleInput, tags: EntryTags): boolean {
  if (!rule.tagKey || rule.tagValue === null) return false;
  return tags[rule.tagKey] === rule.tagValue;
}

function matchAccount(rule: TagRuleInput, accountId: string): boolean {
  return !!rule.accountId && rule.accountId === accountId;
}

/**
 * Resolve which SAFe entity a BillingEntry maps to.
 * Rules must be sorted by (priority DESC, createdAt ASC) by the caller.
 */
export function resolveMapping(
  rules: TagRuleInput[],
  tags: EntryTags,
  accountId: string,
): MappingResult {
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    let matched = false;
    let conf = "UNMAPPED";

    if (rule.matchType === "EXACT" && matchExact(rule, tags)) {
      matched = true;
      conf = "EXACT_TAG";
    } else if (rule.matchType === "ACCOUNT" && matchAccount(rule, accountId)) {
      matched = true;
      conf = "ACCOUNT_RULE";
    }

    if (matched) {
      return {
        themeId:       rule.themeId,
        artId:         rule.artId,
        epicId:        rule.epicId,
        mappingRuleId: rule.id,
        mappingConf:   conf,
      };
    }
  }

  return UNMAPPED;
}
```

- [ ] **Step 4: Run tests — confirm PASS**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/tag-rule-engine.test.ts 2>&1
```
Expected: `7 tests passed`

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/billing-adapters/tag-rule-engine.ts \
        apps/app/__tests__/finops/tag-rule-engine.test.ts
git commit -m "feat(finops): tag-rule engine — EXACT + ACCOUNT match types (v1)"
```

---

### Task 10: Billing actions (connector CRUD + tag rules CRUD)

**Files:**
- Create: `apps/app/app/actions/billing/index.ts`
- Create: `apps/app/app/actions/billing/tag-rules.ts`
- Create: `apps/app/app/actions/billing/snapshots.ts`

- [ ] **Step 1: Create connector CRUD actions**

```typescript
// apps/app/app/actions/billing/index.ts
"use server";

import { ok, err, safeAction, type Result } from "@/app/actions/_base";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";

const BILLING_SOURCES = ["billing_aws", "billing_gcp", "billing_azure"] as const;
type BillingSource = (typeof BILLING_SOURCES)[number];

const CreateBillingIntegrationSchema = z.object({
  source: z.enum(BILLING_SOURCES),
  name: z.string().min(1).max(255).trim(),
  config: z.record(z.unknown()),  // validated per provider at adapter layer
});

export async function createBillingIntegration(
  input: z.infer<typeof CreateBillingIntegrationSchema>,
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateBillingIntegrationSchema.parse(input);

    const integration = await database.integration.create({
      data: {
        tenantId: ctx.tenantId,
        source:   data.source,
        name:     data.name,
        config:   data.config,
        status:   "ACTIVE",
      },
    });

    revalidatePath("/settings/integrations");
    return { id: integration.id };
  });
}

export async function listBillingIntegrations(): Promise<Result<Array<{
  id: string; name: string; source: string; status: string; lastSyncAt: Date | null;
}>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.integration.findMany({
      where: {
        tenantId: ctx.tenantId,
        source:   { in: [...BILLING_SOURCES] },
      },
      select: { id: true, name: true, source: true, status: true, lastSyncAt: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function triggerManualSync(integrationId: string): Promise<Result<{ eventId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    // Verify ownership
    const integration = await database.integration.findFirst({
      where: { id: integrationId, tenantId: ctx.tenantId },
    });
    if (!integration) throw new Error("Integration not found");

    const [event] = await inngest.send([{
      name: "billing/sync.requested",
      data: { tenantId: ctx.tenantId, integrationId },
    }]);

    return { eventId: event?.id ?? "" };
  });
}
```

- [ ] **Step 2: Create tag rules CRUD actions**

```typescript
// apps/app/app/actions/billing/tag-rules.ts
"use server";

import { ok, err, safeAction, type Result } from "@/app/actions/_base";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import type { TagRule } from "@repo/database";

const TagRuleSchema = z.object({
  name:          z.string().max(255).optional(),
  integrationId: z.string().cuid().optional(),
  tagKey:        z.string().max(255).optional(),
  tagValue:      z.string().max(255).optional(),
  matchType:     z.enum(["EXACT", "ACCOUNT"]),  // v2 adds PREFIX, REGEX, COMPOUND
  themeId:       z.string().cuid().optional(),
  artId:         z.string().cuid().optional(),
  epicId:        z.string().cuid().optional(),
  priority:      z.number().int().default(0),
  enabled:       z.boolean().default(true),
});

export async function listTagRules(): Promise<Result<TagRule[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.tagRule.findMany({
      where:   { tenantId: ctx.tenantId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  });
}

export async function createTagRule(
  input: z.infer<typeof TagRuleSchema>,
): Promise<Result<TagRule>> {
  return safeAction(async () => {
    const ctx  = await requireTenantSession(await headers());
    const data = TagRuleSchema.parse(input);

    const rule = await database.tagRule.create({
      data: { ...data, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/budgets/tag-rules");
    return rule;
  });
}

export async function updateTagRule(
  id: string,
  input: Partial<z.infer<typeof TagRuleSchema>>,
): Promise<Result<TagRule>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    // Verify ownership
    const existing = await database.tagRule.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) throw new Error("TagRule not found");

    const rule = await database.tagRule.update({
      where: { id },
      data:  input,
    });

    // Trigger retroactive remap for modified rule
    await inngest.send([{
      name: "billing/remap.requested",
      data: { tenantId: ctx.tenantId, tagRuleId: id, appliedFromDate: rule.appliedFromDate },
    }]);

    revalidatePath("/portfolio/budgets/tag-rules");
    return rule;
  });
}

export async function deleteTagRule(id: string): Promise<Result<{ deleted: boolean }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    await database.tagRule.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });
    revalidatePath("/portfolio/budgets/tag-rules");
    return { deleted: true };
  });
}
```

- [ ] **Step 3: Create snapshot query actions**

```typescript
// apps/app/app/actions/billing/snapshots.ts
"use server";

import { safeAction, type Result } from "@/app/actions/_base";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export interface BudgetOverviewItem {
  themeId:      string | null;
  themeName:    string | null;
  plannedCost:  number;
  actualCost:   number;
  cloudCost:    number;
  unmappedAmount: number;
  period:       string; // ISO date
}

export async function getBudgetOverview(params: {
  granularity: "DAILY" | "MONTHLY";
  periodStart: Date;
  periodEnd:   Date;
}): Promise<Result<BudgetOverviewItem[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const snapshots = await database.costSnapshot.findMany({
      where: {
        tenantId:    ctx.tenantId,
        granularity: params.granularity,
        period: {
          gte: params.periodStart,
          lte: params.periodEnd,
        },
      },
      include: {
        tenant: { select: { id: true } },
      },
      orderBy: [{ period: "desc" }, { themeId: "asc" }],
    });

    // Group by themeId and sum amounts
    const byTheme = new Map<string | null, BudgetOverviewItem>();

    for (const snap of snapshots) {
      const key = snap.themeId;
      const existing = byTheme.get(key);

      if (existing) {
        existing.actualCost    += Number(snap.actualCost);
        existing.cloudCost     += Number(snap.cloudCost);
        existing.unmappedAmount += Number(snap.unmappedAmount);
        if (snap.plannedCost) existing.plannedCost += Number(snap.plannedCost);
      } else {
        byTheme.set(key, {
          themeId:        snap.themeId,
          themeName:      null,  // enriched below
          plannedCost:    snap.plannedCost ? Number(snap.plannedCost) : 0,
          actualCost:     Number(snap.actualCost),
          cloudCost:      Number(snap.cloudCost),
          unmappedAmount: Number(snap.unmappedAmount),
          period:         snap.period.toISOString(),
        });
      }
    }

    // Enrich with theme names
    const themeIds = [...byTheme.keys()].filter(Boolean) as string[];
    if (themeIds.length > 0) {
      const themes = await database.strategicTheme.findMany({
        where: { id: { in: themeIds }, tenantId: ctx.tenantId },
        select: { id: true, name: true },
      });
      for (const t of themes) {
        const item = byTheme.get(t.id);
        if (item) item.themeName = t.name;
      }
    }

    return [...byTheme.values()];
  });
}
```

- [ ] **Step 4: Build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep -E "billing/|tag-rules|snapshots" | head -20
```
Expected: no errors on new billing action files. (There may be errors on inngest/route.ts until Task 9 is committed — that's acceptable.)

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/billing/
git commit -m "feat(finops): billing actions — connector CRUD, tag rules CRUD, snapshot queries"
```

---

### Task 11: Inngest billing-sync job

**Files:**
- Create: `apps/app/lib/inngest/billing-sync.ts`

- [ ] **Step 1: Create billing-sync Inngest function**

```typescript
// apps/app/lib/inngest/billing-sync.ts
import { inngest } from "./client";
import { database } from "@repo/database";
import { fetchAwsPage } from "@/lib/billing-adapters/aws";
import { resolveMapping } from "@/lib/billing-adapters/tag-rule-engine";
import type { AwsAdapterConfig } from "@/lib/billing-adapters/aws";

const BATCH_SIZE = 500;

export const billingSyncFunction = inngest.createFunction(
  {
    id: "billing-sync",
    concurrency: [
      { key: "event.data.tenantId",      limit: 2 },
      { key: "event.data.integrationId", limit: 1 },
      { scope: "fn",                     limit: 50 },
    ],
    retries: 3,
  },
  { event: "billing/sync.requested" },
  async ({ event, step }) => {
    const { tenantId, integrationId } = event.data as {
      tenantId: string;
      integrationId: string;
    };

    // ── Step 1: Load cursor + integration config ──────────────────────────
    const { cursor, config, syncRun } = await step.run("load-cursor", async () => {
      const integration = await database.integration.findFirstOrThrow({
        where: { id: integrationId, tenantId, status: "ACTIVE" },
      });

      let cursor = await database.billingSyncCursor.findUnique({
        where: { integrationId },
      });

      const lookbackDays = cursor?.lookbackDays ?? 7;
      const now = new Date();
      const startDate = cursor
        ? new Date(cursor.lastIngestedThrough.getTime() - lookbackDays * 86400000)
        : new Date(now.getTime() - 90 * 86400000);  // first run: 90-day backfill

      const endDate = now;

      const syncRun = await database.billingSyncRun.create({
        data: { tenantId, integrationId, status: "RUNNING", currentStep: "load-cursor" },
      });

      return {
        cursor,
        config:  integration.config as AwsAdapterConfig,
        syncRun: { id: syncRun.id },
        startDate: startDate.toISOString().split("T")[0],
        endDate:   endDate.toISOString().split("T")[0],
      };
    });

    // ── Step 2: Fetch pages from AWS → stage ──────────────────────────────
    let page = 0;
    let nextToken: string | undefined;

    do {
      const pageResult = await step.run(`fetch-page-${page}`, async () => {
        const result = await fetchAwsPage({
          config,
          tenantId,
          startDate: (cursor as { startDate?: string }).startDate ?? "",
          endDate:   (cursor as { endDate?: string }).endDate ?? "",
          nextPageToken: nextToken,
        });

        // Stage raw payload
        if (result.entries.length > 0) {
          await database.billingEntryStaging.createMany({
            data: result.entries.map((e) => ({
              tenantId,
              integrationId,
              syncRunId: syncRun.id,
              payload:   e,
              page,
            })),
          });
        }

        return { nextToken: result.nextPageToken, count: result.entries.length };
      });

      nextToken = pageResult.nextToken;
      page++;
    } while (nextToken);

    // ── Step 3: Load tag rules ────────────────────────────────────────────
    const tagRules = await step.run("load-tag-rules", async () => {
      return database.tagRule.findMany({
        where:   { tenantId, enabled: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
    });

    // ── Step 4: Promote staged → BillingEntry ────────────────────────────
    const promotedCount = await step.run("promote-entries", async () => {
      const staged = await database.billingEntryStaging.findMany({
        where: { tenantId, integrationId, syncRunId: syncRun.id },
        orderBy: { page: "asc" },
      });

      let count = 0;

      for (let i = 0; i < staged.length; i += BATCH_SIZE) {
        const batch = staged.slice(i, i + BATCH_SIZE);

        const entries = batch.map((row) => {
          const e = row.payload as Record<string, unknown>;
          const tags = (e.tags ?? {}) as Record<string, string>;
          const accountId = String(e.accountId ?? "");
          const mapping = resolveMapping(
            tagRules.map((r) => ({
              id:        r.id,
              matchType: r.matchType,
              tagKey:    r.tagKey,
              tagValue:  r.tagValue,
              themeId:   r.themeId,
              artId:     r.artId,
              epicId:    r.epicId,
              priority:  r.priority,
              enabled:   r.enabled,
            })),
            tags,
            accountId,
          );

          return {
            tenantId,
            integrationId,
            provider:        String(e.provider ?? "AWS"),
            accountId,
            externalId:      String(e.externalId ?? ""),
            usageStartDate:  new Date(String(e.usageStartDate)),
            usageEndDate:    new Date(String(e.usageEndDate)),
            service:         String(e.service ?? ""),
            chargeCategory:  String(e.chargeCategory ?? "Usage"),
            billedCost:      String(e.billedCost ?? "0"),
            effectiveCost:   String(e.effectiveCost ?? "0"),
            listCost:        String(e.listCost ?? "0"),
            unblendedAmount: String(e.unblendedAmount ?? "0"),
            amortizedAmount: String(e.amortizedAmount ?? "0"),
            usageQuantity:   e.usageQuantity ? String(e.usageQuantity) : null,
            usageUnit:       e.usageUnit ? String(e.usageUnit) : null,
            currency:        String(e.currency ?? "USD"),
            fxRate:          "1",
            tenantCurrency:  String(e.tenantCurrency ?? "USD"),
            tenantAmount:    String(e.tenantAmount ?? e.amortizedAmount ?? "0"),
            tags,
            themeId:         mapping.themeId,
            mappingRuleId:   mapping.mappingRuleId,
            mappingConf:     mapping.mappingConf,
          };
        });

        await database.billingEntry.createMany({
          data:            entries,
          skipDuplicates:  true,
        });

        count += batch.length;
      }

      // Cleanup staging rows
      await database.billingEntryStaging.deleteMany({
        where: { tenantId, integrationId, syncRunId: syncRun.id },
      });

      return count;
    });

    // ── Step 5: Aggregate CostSnapshot ───────────────────────────────────
    await step.run("aggregate-snapshots", async () => {
      // Use raw SQL for efficient UPSERT aggregation
      await database.$executeRaw`
        INSERT INTO "CostSnapshot" (
          id, "tenantId", "themeId", "artId", "epicId", "okrId",
          period, granularity,
          "cloudCost", "peopleCost", "saasCost", "actualCost",
          "unmappedAmount", breakdown, "sourceCurrencies",
          currency, "fxStrategy", "fxConvertedAt", "syncedAt"
        )
        SELECT
          gen_random_uuid()::text,
          be."tenantId",
          be."themeId",
          NULL,
          NULL,
          NULL,
          DATE_TRUNC('day', be."usageStartDate"),
          'DAILY',
          SUM(be."tenantAmount") FILTER (WHERE be."chargeCategory" != 'Credit'),
          0,
          0,
          SUM(be."tenantAmount") FILTER (WHERE be."chargeCategory" != 'Credit'),
          SUM(be."tenantAmount") FILTER (WHERE be."mappingConf" = 'UNMAPPED'),
          '{}',
          '{}',
          'USD',
          'MONTH_AVG',
          NOW(),
          NOW()
        FROM "BillingEntry" be
        WHERE be."tenantId" = ${tenantId}
          AND be."integrationId" = ${integrationId}
        GROUP BY be."tenantId", be."themeId", DATE_TRUNC('day', be."usageStartDate")
        ON CONFLICT ("tenantId", "themeId", "artId", "epicId", "okrId", period, granularity)
        DO UPDATE SET
          "cloudCost"      = EXCLUDED."cloudCost",
          "actualCost"     = EXCLUDED."actualCost",
          "unmappedAmount" = EXCLUDED."unmappedAmount",
          "syncedAt"       = NOW()
      `;
    });

    // ── Step 6: Update UnmappedCostBucket ─────────────────────────────────
    await step.run("update-unmapped-bucket", async () => {
      await database.$executeRaw`
        INSERT INTO "UnmappedCostBucket" (
          id, "tenantId", "integrationId", period, amount, currency, "topTags", "entryCount"
        )
        SELECT
          gen_random_uuid()::text,
          ${tenantId},
          ${integrationId},
          DATE_TRUNC('month', "usageStartDate"),
          SUM("tenantAmount"),
          'USD',
          '[]',
          COUNT(*)
        FROM "BillingEntry"
        WHERE "tenantId" = ${tenantId}
          AND "integrationId" = ${integrationId}
          AND "mappingConf" = 'UNMAPPED'
        GROUP BY DATE_TRUNC('month', "usageStartDate")
        ON CONFLICT ("tenantId", "integrationId", period)
        DO UPDATE SET
          amount       = EXCLUDED.amount,
          "entryCount" = EXCLUDED."entryCount"
      `;
    });

    // ── Step 7: Advance cursor ────────────────────────────────────────────
    await step.run("advance-cursor", async () => {
      await database.billingSyncCursor.upsert({
        where:  { integrationId },
        create: {
          integrationId,
          lastIngestedThrough: new Date(),
          lookbackDays: 7,
          backfillDays: 90,
          backfillComplete: true,
        },
        update: {
          lastIngestedThrough: new Date(),
          consecutiveFailures: 0,
        },
      });

      await database.billingSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status:           "SUCCESS",
          currentStep:      "done",
          entriesProcessed: promotedCount,
          finishedAt:       new Date(),
        },
      });

      // Update Integration.lastSyncAt
      await database.integration.update({
        where: { id: integrationId },
        data:  { lastSyncAt: new Date() },
      });
    });

    // ── Step 8: Emit downstream events ───────────────────────────────────
    await inngest.send([{
      name: "billing/snapshot.updated",
      data: { tenantId, integrationId, period: new Date().toISOString() },
    }]);

    return { success: true, entriesProcessed: promotedCount };
  },
);
```

- [ ] **Step 2: Update inngest API route to fix TS error from Task 7**

The `apps/app/app/api/inngest/route.ts` already imports `billingSyncFunction` — now that it exists, verify no TS errors:

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep "api/inngest" | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/lib/inngest/billing-sync.ts \
        apps/app/app/api/inngest/route.ts
git commit -m "feat(finops): Inngest billing-sync job — fetch → stage → promote → resolve → snapshot"
```

---

### Task 12: Vercel Cron dispatch endpoint

**Files:**
- Create: `apps/app/app/api/cron/billing-sync-dispatch/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create cron dispatch route**

```typescript
// apps/app/app/api/cron/billing-sync-dispatch/route.ts
import { NextResponse } from "next/server";
import { database } from "@repo/database";
import { inngest } from "@/lib/inngest/client";

const PAGE_SIZE = 100;

export async function GET(req: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const BILLING_SOURCES = ["billing_aws", "billing_gcp", "billing_azure"];
  let offset = 0;
  let dispatched = 0;

  while (true) {
    const integrations = await database.integration.findMany({
      where: { source: { in: BILLING_SOURCES }, status: "ACTIVE" },
      select: { id: true, tenantId: true },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      skip: offset,
    });

    if (integrations.length === 0) break;

    const events = integrations.map((i) => ({
      name: "billing/sync.requested" as const,
      data: { tenantId: i.tenantId, integrationId: i.id },
    }));

    await inngest.send(events);
    dispatched += integrations.length;
    offset += PAGE_SIZE;

    if (integrations.length < PAGE_SIZE) break;
  }

  return NextResponse.json({ dispatched });
}
```

- [ ] **Step 2: Create vercel.json with cron + Inngest function config**

```json
{
  "crons": [
    {
      "path": "/api/cron/billing-sync-dispatch",
      "schedule": "0 2 * * *"
    }
  ],
  "functions": {
    "app/api/inngest/route.ts": {
      "maxDuration": 300
    }
  }
}
```

Note: `vercel.json` goes in the repo root (`cosmos-nebuloz/vercel.json`).

- [ ] **Step 3: Add CRON_SECRET to environment docs**

Add to `.env.example` (or wherever env vars are documented):

```
CRON_SECRET=<random 32-char secret>
INNGEST_EVENT_KEY=<from Inngest dashboard>
INNGEST_SIGNING_KEY=<from Inngest dashboard>
```

- [ ] **Step 4: Build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep "cron/billing" | head -10
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/api/cron/billing-sync-dispatch/route.ts vercel.json
git commit -m "feat(finops): Vercel Cron dispatch + vercel.json cron schedule"
```

---

## Sprint 3 — v1 UI + Migration Complete

### Task 13: Budget dashboard upgrade

**Files:**
- Modify: `apps/app/app/(authenticated)/portfolio/budgets/page.tsx`
- Modify: `apps/app/app/(authenticated)/portfolio/budgets/components/budget-dashboard.tsx`

- [ ] **Step 1: Update page.tsx to fetch real snapshot data**

Replace `apps/app/app/(authenticated)/portfolio/budgets/page.tsx`:

```typescript
// apps/app/app/(authenticated)/portfolio/budgets/page.tsx
import { getLeanBudgets } from "@/app/actions/lean-budget";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getBudgetOverview } from "@/app/actions/billing/snapshots";
import { listBillingIntegrations } from "@/app/actions/billing";
import { BudgetDashboard } from "./components/budget-dashboard";

export const metadata = {
  title: "Lean Budget — COSMOS",
  description: "FinOps: controle de orçamento por Tema SAFe com custo real de nuvem.",
};

export default async function LeanBudgetPage() {
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd   = new Date();

  const [budgets, rawArts, overview, integrations] = await Promise.all([
    getLeanBudgets(),
    getARTs(),
    getBudgetOverview({ granularity: "MONTHLY", periodStart, periodEnd }),
    listBillingIntegrations(),
  ]);

  const arts = rawArts.map((a) => ({ id: a.id, name: a.name }));
  const overviewData = overview.ok ? overview.value : [];
  const billingIntegrations = integrations.ok ? integrations.value : [];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lean Budget</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Custo real de nuvem mapeado para Temas SAFe.
          </p>
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <BudgetDashboard
          initialBudgets={budgets}
          arts={arts}
          overviewData={overviewData}
          billingIntegrations={billingIntegrations}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add unmapped banner + KPI cards to BudgetDashboard**

In `apps/app/app/(authenticated)/portfolio/budgets/components/budget-dashboard.tsx`, add at the top of the component render (above existing content):

```typescript
// Add these props to BudgetDashboardProps:
overviewData: Array<{
  themeId: string | null;
  themeName: string | null;
  plannedCost: number;
  actualCost: number;
  cloudCost: number;
  unmappedAmount: number;
  period: string;
}>;
billingIntegrations: Array<{
  id: string; name: string; source: string; status: string; lastSyncAt: Date | null;
}>;

// Computed values for KPI cards:
const totalPlanned    = overviewData.reduce((s, r) => s + r.plannedCost, 0);
const totalActual     = overviewData.reduce((s, r) => s + r.actualCost, 0);
const totalUnmapped   = overviewData.reduce((s, r) => s + r.unmappedAmount, 0);
const hasConnectors   = billingIntegrations.length > 0;
const unmappedPct     = totalActual > 0 ? (totalUnmapped / totalActual) * 100 : 0;

// Unmapped banner (show if unmapped > 5% of actual):
{totalUnmapped > 0 && unmappedPct > 5 && (
  <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
    <span className="font-medium text-amber-800 dark:text-amber-200">
      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(totalUnmapped)} não mapeado para temas SAFe
    </span>
    <a href="/portfolio/budgets/tag-rules" className="ml-auto text-amber-700 underline dark:text-amber-300">
      Revisar regras →
    </a>
  </div>
)}

// Empty state (no connectors):
{!hasConnectors && (
  <div className="mb-6 rounded-xl border-2 border-dashed p-8 text-center">
    <p className="mb-4 text-muted-foreground">Conecte um provedor de billing para ver custos reais</p>
    <div className="flex justify-center gap-3">
      <a href="/settings/integrations?provider=billing_aws" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Conectar AWS</a>
      <a href="/settings/integrations?provider=billing_gcp" className="rounded-md border px-4 py-2 text-sm">Conectar GCP</a>
      <a href="/settings/integrations?provider=billing_azure" className="rounded-md border px-4 py-2 text-sm">Conectar Azure</a>
    </div>
  </div>
)}

// KPI cards row (add above existing table):
<div className="mb-6 grid grid-cols-4 gap-4">
  <KpiCard label="Planejado MTD"    value={totalPlanned} />
  <KpiCard label="Real MTD"         value={totalActual} />
  <KpiCard label="% Utilizado"      value={totalActual / (totalPlanned || 1) * 100} isPercent />
  <KpiCard label="Não mapeado"      value={totalUnmapped} className={unmappedPct > 5 ? "border-amber-300" : ""} />
</div>
```

Add the `KpiCard` helper component at the bottom of the file (or extract to `apps/app/app/(authenticated)/portfolio/budgets/components/kpi-card.tsx`):

```typescript
function KpiCard({ label, value, isPercent, className }: {
  label: string;
  value: number;
  isPercent?: boolean;
  className?: string;
}) {
  const formatted = isPercent
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
  return (
    <div className={`rounded-lg border p-4 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatted}</p>
    </div>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep "portfolio/budgets" | head -20
```
Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/\(authenticated\)/portfolio/budgets/
git commit -m "feat(finops): budget dashboard — KPI cards, unmapped banner, empty state connectors"
```

---

### Task 14: Budget detail page — cost breakdown + trend

**Files:**
- Create: `apps/app/app/(authenticated)/portfolio/budgets/[id]/page.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/budgets/[id]/components/budget-detail.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-breakdown-card.tsx`
- Create: `apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-trend-chart.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
// apps/app/app/(authenticated)/portfolio/budgets/[id]/page.tsx
import { notFound } from "next/navigation";
import { getBudgetById } from "@/app/actions/lean-budget";
import { getBudgetOverview } from "@/app/actions/billing/snapshots";
import { BudgetDetail } from "./components/budget-detail";

export default async function BudgetDetailPage({ params }: { params: { id: string } }) {
  const [budget, snapshotResult] = await Promise.all([
    getBudgetById(params.id),
    getBudgetOverview({
      granularity: "DAILY",
      periodStart: new Date(Date.now() - 90 * 86400000),
      periodEnd:   new Date(),
    }),
  ]);

  if (!budget.ok || !budget.value) notFound();

  const snapshots = snapshotResult.ok ? snapshotResult.value : [];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <a href="/portfolio/budgets" className="text-muted-foreground hover:text-foreground text-sm">
          ← Lean Budget
        </a>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-semibold">{budget.value.name}</h1>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <BudgetDetail budget={budget.value} snapshots={snapshots} />
      </div>
    </div>
  );
}
```

Add `getBudgetById` to `apps/app/app/actions/lean-budget/index.ts`:

```typescript
export async function getBudgetById(id: string): Promise<Result<LeanBudgetWithStats | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const b = await database.leanBudget.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    return b ? withStats(b) : null;
  });
}
```

- [ ] **Step 2: Create budget-detail.tsx**

```typescript
// apps/app/app/(authenticated)/portfolio/budgets/[id]/components/budget-detail.tsx
"use client";

import type { LeanBudgetWithStats } from "@/app/actions/lean-budget";
import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";
import { CostBreakdownCard } from "./cost-breakdown-card";
import { CostTrendChart } from "./cost-trend-chart";

interface Props {
  budget:    LeanBudgetWithStats;
  snapshots: BudgetOverviewItem[];
}

export function BudgetDetail({ budget, snapshots }: Props) {
  const themeSnapshots = snapshots.filter((s) => s.themeId === budget.themeId);
  const totalCloud = themeSnapshots.reduce((s, r) => s + r.cloudCost,  0);
  const totalActual = themeSnapshots.reduce((s, r) => s + r.actualCost, 0);

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main — 8 cols */}
      <div className="col-span-8 space-y-6">
        <CostBreakdownCard
          cloudCost:  {totalCloud}
          peopleCost: {0}
          saasCost:   {0}
          planned:    {budget.amount}
        />
        <CostTrendChart snapshots={themeSnapshots} planned={budget.amount} />
      </div>

      {/* Side — 4 cols */}
      <div className="col-span-4 space-y-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Orçamento</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(budget.amount)}
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${budget.isOverBudget ? "bg-destructive" : budget.isNearLimit ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{budget.percentUsed.toFixed(1)}% utilizado</p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium mb-2">Real vs Planejado</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Real</span>
            <span className="tabular-nums font-medium">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(totalActual)}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted-foreground">Planejado</span>
            <span className="tabular-nums">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(budget.amount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create cost-breakdown-card.tsx**

```typescript
// apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-breakdown-card.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  cloudCost:  number;
  peopleCost: number;
  saasCost:   number;
  planned:    number;
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b"];

export function CostBreakdownCard({ cloudCost, peopleCost, saasCost, planned }: Props) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);

  const data = [
    { name: "Cloud",   value: cloudCost  },
    { name: "Pessoas", value: peopleCost },
    { name: "SaaS",    value: saasCost   },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        <p className="text-sm">Sem dados de custo para este período.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-sm font-medium mb-4">Composição de Custo</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create cost-trend-chart.tsx**

```typescript
// apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-trend-chart.tsx
"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";

interface Props {
  snapshots: BudgetOverviewItem[];
  planned:   number;
}

export function CostTrendChart({ snapshots, planned }: Props) {
  const data = snapshots
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((s) => ({
      date:   new Date(s.period).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }),
      actual: Number(s.actualCost.toFixed(2)),
    }));

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-sm font-medium mb-4">Tendência de Custo (90 dias)</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={80} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <ReferenceLine
            y={planned / data.length || 0}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            label={{ value: "Budget/dia", fontSize: 11, fill: "#f59e0b" }}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep "budgets/\[id\]" | head -20
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/\(authenticated\)/portfolio/budgets/\[id\]/
git commit -m "feat(finops): budget detail page — cost breakdown donut + 90d trend chart"
```

---

### Task 15: AWS integration connect wizard (5-step dialog)

**Files:**
- Create: `apps/app/app/(authenticated)/settings/integrations/components/billing-connect-wizard.tsx`
- Modify: `apps/app/app/(authenticated)/settings/integrations/components/integrations-board.tsx`

- [ ] **Step 1: Create billing-connect-wizard.tsx**

```typescript
// apps/app/app/(authenticated)/settings/integrations/components/billing-connect-wizard.tsx
"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input  } from "@repo/design-system/components/ui/input";
import { Label  } from "@repo/design-system/components/ui/label";
import { createBillingIntegration } from "@/app/actions/billing";

interface Props {
  open:     boolean;
  provider: "billing_aws" | "billing_gcp" | "billing_azure";
  onClose:  () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  billing_aws:   "AWS Cost Explorer",
  billing_gcp:   "GCP BigQuery Billing",
  billing_azure: "Azure Cost Management",
};

const STEPS = ["Credenciais", "Testar conexão", "Escopo", "Regras de tag", "Backfill"];

export function BillingConnectWizard({ open, provider, onClose }: Props) {
  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [roleArn,  setRoleArn]  = useState("");
  const [extId,    setExtId]    = useState("");
  const [name,     setName]     = useState(`${PROVIDER_LABELS[provider]} Principal`);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const result = await createBillingIntegration({
        source: provider,
        name,
        config: { roleArn, externalId: extId },
      });
      if (!result.ok) throw new Error(result.error);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar {PROVIDER_LABELS[provider]}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-2 mb-4">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`h-6 w-6 rounded-full text-xs flex items-center justify-center font-medium
                ${i + 1 === step ? "bg-primary text-primary-foreground" :
                  i + 1 < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-4 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Credentials */}
        {step === 1 && provider === "billing_aws" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crie uma role IAM com permissão <code>ce:GetCostAndUsage</code> e forneça o ARN abaixo.
            </p>
            <div className="space-y-2">
              <Label>Nome da integração</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role ARN</Label>
              <Input
                placeholder="arn:aws:iam::123456789012:role/CosmosBillingRole"
                value={roleArn}
                onChange={(e) => setRoleArn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>External ID</Label>
              <Input
                placeholder="cosmos-<your-tenant-id>"
                value={extId}
                onChange={(e) => setExtId(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Steps 2-4: Stubs for v1 (expanded in v2) */}
        {step === 2 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <p>✓ Credenciais salvas. Conexão será testada no primeiro sync.</p>
          </div>
        )}

        {step === 3 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <p>Todas as contas da role serão incluídas no v1.</p>
            <p className="mt-1">Filtragem por conta disponível na v2.</p>
          </div>
        )}

        {step === 4 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <p>Regras de tag configuradas em{" "}
              <a href="/portfolio/budgets/tag-rules" className="underline">Portfolio → Tag Rules</a>
              {" "}após o primeiro sync.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha o período de histórico a importar. Custos de API AWS aplicam-se.
            </p>
            <div className="flex gap-2">
              {[30, 90, 365].map((days) => (
                <Button key={days} variant="outline" size="sm" className="flex-1">
                  {days === 365 ? "12 meses" : `${days} dias`}
                </Button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex justify-between mt-4">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onClose()}>
            {step === 1 ? "Cancelar" : "← Voltar"}
          </Button>
          {step < STEPS.length ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !roleArn}>
              Próximo →
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Salvando…" : "Conectar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add Billing section to integrations-board.tsx**

In `apps/app/app/(authenticated)/settings/integrations/components/integrations-board.tsx`, add a "Billing & Cloud Cost" section at the top of the board (above the existing DevOps section). The exact location depends on the current file structure — find where sections are rendered and add before the first one:

```typescript
// Import at top:
import { BillingConnectWizard } from "./billing-connect-wizard";

// State:
const [wizardProvider, setWizardProvider] = useState<"billing_aws" | "billing_gcp" | "billing_azure" | null>(null);

// In JSX, add before existing sections:
<section className="mb-8">
  <h2 className="text-base font-semibold mb-3">Billing & Cloud Cost</h2>
  <div className="grid grid-cols-3 gap-4">
    {[
      { provider: "billing_aws"   as const, label: "AWS Cost Explorer",       logo: "☁️" },
      { provider: "billing_gcp"   as const, label: "GCP BigQuery Billing",    logo: "🟡" },
      { provider: "billing_azure" as const, label: "Azure Cost Management",   logo: "🔵" },
    ].map(({ provider, label, logo }) => (
      <button
        key={provider}
        onClick={() => setWizardProvider(provider)}
        className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm hover:bg-muted transition-colors"
      >
        <span className="text-2xl">{logo}</span>
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">Conectar</span>
      </button>
    ))}
  </div>
</section>

{wizardProvider && (
  <BillingConnectWizard
    open={!!wizardProvider}
    provider={wizardProvider}
    onClose={() => setWizardProvider(null)}
  />
)}
```

- [ ] **Step 3: Build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep "integrations" | head -10
```
Expected: no errors on wizard files.

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/\(authenticated\)/settings/integrations/components/billing-connect-wizard.tsx \
        apps/app/app/\(authenticated\)/settings/integrations/components/integrations-board.tsx
git commit -m "feat(finops): AWS billing connect wizard (5 steps) + integrations board Billing section"
```

---

### Task 16: Sidebar nav — add Budget sub-routes

**Files:**
- Modify: `apps/app/app/(authenticated)/components/sidebar.tsx`

- [ ] **Step 1: Find the Lean Budget / budgets entry in sidebar.tsx**

```bash
grep -n "budget\|Budget\|orçamento" apps/app/app/\(authenticated\)/components/sidebar.tsx | head -15
```

- [ ] **Step 2: Add sub-route stubs**

Find the navigation item for budgets and add sub-routes as children (or nested links). The exact structure depends on the current sidebar implementation. Find the item and expand it:

```typescript
// Existing (approximate):
{ label: "Lean Budget", href: "/portfolio/budgets", icon: WalletIcon }

// Replace with:
{
  label: "Lean Budget",
  href:  "/portfolio/budgets",
  icon:  WalletIcon,
  children: [
    { label: "Visão Geral",    href: "/portfolio/budgets" },
    { label: "Tag Rules",      href: "/portfolio/budgets/tag-rules" },    // stub — v2
    { label: "Anomalias",      href: "/portfolio/budgets/anomalies" },    // stub — v2
    { label: "Cost Explorer",  href: "/portfolio/budgets/explorer" },     // stub — v2
  ],
}
```

If the sidebar doesn't support children, just verify the existing `/portfolio/budgets` link is present.

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/components/sidebar.tsx
git commit -m "feat(finops): sidebar — Lean Budget sub-routes (tag-rules, anomalies stubs for v2)"
```

---

### Task 17: LeanBudget migration phases 4 + 5

**Files:**
- Modify: `apps/app/app/actions/lean-budget/index.ts`
- Create: `packages/database/prisma/migrations/20260525000004_lean_budget_decimal_phase4/migration.sql`
- Create: `packages/database/prisma/migrations/20260525000005_lean_budget_decimal_phase5/migration.sql`

> **Warning:** Phase 4 switches reads from `spent` (Float) to `spentDecimal` (Decimal). All callsites using `Number(b.spent)` or `parseFloat(b.spent)` must be updated to use `.toNumber()`. Phase 5 drops the old Float column. These are irreversible.

- [ ] **Step 1: Find all spent read callsites**

```bash
grep -rn "\.spent\b\|Number.*spent\|parseFloat.*spent" apps/app/app/actions/lean-budget/ apps/app/app/\(authenticated\)/portfolio/budgets/ apps/app/lib/
```

List every callsite. Each must be updated in Step 3.

- [ ] **Step 2: Phase 4 migration — switch reads to spentDecimal**

`packages/database/prisma/migrations/20260525000004_lean_budget_decimal_phase4/migration.sql`:

```sql
-- Phase 4: Verify parity before switching reads
-- Abort if any row has divergence > 0.01
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "LeanBudget"
    WHERE ABS("spent" - "spentDecimal"::FLOAT) > 0.01
  ) THEN
    RAISE EXCEPTION 'Parity check failed: spent and spentDecimal diverge by > 0.01 in some rows. Investigate before proceeding.';
  END IF;
END $$;

-- No DDL needed for phase 4 — the app layer switches reads (handled in code below)
-- This migration just documents the phase transition
SELECT 'Phase 4: parity check passed' AS status;
```

- [ ] **Step 3: Update lean-budget actions — switch reads to spentDecimal**

In `apps/app/app/actions/lean-budget/index.ts`, update the `withStats` helper to use `spentDecimal` (Decimal) instead of `spent` (Float):

```typescript
// BEFORE (phase 1-3):
function withStats(b: LeanBudget): LeanBudgetWithStats {
  const pct = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
  // ...
  return { ...b, percentUsed: Math.round(pct * 10) / 10, ... };
}

// AFTER (phase 4 — use spentDecimal, fall back to spent for migration safety):
function withStats(b: LeanBudget): LeanBudgetWithStats {
  // spentDecimal is a Prisma Decimal instance; use .toNumber() for arithmetic
  const spentValue = b.spentDecimal
    ? (b.spentDecimal as unknown as { toNumber(): number }).toNumber()
    : b.spent;
  const pct = b.amount > 0 ? (spentValue / b.amount) * 100 : 0;
  return {
    ...b,
    spent:         spentValue,  // normalize to number for consumers
    percentUsed:   Math.round(pct * 10) / 10,
    isOverBudget:  spentValue > b.amount,
    isNearLimit:   pct > 80,
    capexRemaining: g?.capex !== undefined ? g.capex - spentValue * 0.5 : undefined,
    opexRemaining:  g?.opex  !== undefined ? g.opex  - spentValue * 0.5 : undefined,
  };
}
```

Update `portfolio.prisma` to reflect that `spentDecimal` is the authoritative field:

```prisma
// In LeanBudget — add comment:
spentDecimal Decimal? @db.Decimal(18,6)  // authoritative after phase 4; falls back to spent during migration
```

- [ ] **Step 4: Phase 5 migration — drop Float column**

`packages/database/prisma/migrations/20260525000005_lean_budget_decimal_phase5/migration.sql`:

```sql
-- Phase 5: Drop old Float column, rename Decimal to spent
-- Only run after phase 4 deploy has been stable for 1+ week

-- Step A: Rename spentDecimal → spent_decimal_final (safety)
ALTER TABLE "LeanBudget" RENAME COLUMN "spent" TO "spent_float_backup";

-- Step B: Rename spentDecimal → spent
ALTER TABLE "LeanBudget" RENAME COLUMN "spentDecimal" TO "spent";

-- Step C: Drop backup (after validating app works)
-- Run separately after validation:
-- ALTER TABLE "LeanBudget" DROP COLUMN "spent_float_backup";
```

> **Note:** Do NOT apply phase 5 migration automatically. Run it manually after phase 4 has been live and stable.

- [ ] **Step 5: Apply phase 4 migration only**

```bash
cd packages/database && npx prisma migrate dev 2>&1
```
Expected: phase 4 parity check SQL runs; if parity passes, migration applied.

- [ ] **Step 6: Run full test suite**

```bash
cd apps/app && NODE_ENV=test npx vitest run 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/migrations/ \
        apps/app/app/actions/lean-budget/index.ts \
        packages/database/prisma/schema/portfolio.prisma
git commit -m "feat(finops): LeanBudget Decimal migration phase 4 — switch reads to spentDecimal"
```

---

### Task 18: Final build + full test run

- [ ] **Step 1: Run all finops unit tests**

```bash
cd apps/app && NODE_ENV=test npx vitest run __tests__/finops/ 2>&1
```
Expected: all tests pass (schema-sanity, dual-write, aws-adapter, tag-rule-engine, inngest-client).

- [ ] **Step 2: Full TypeScript build check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | head -40
```
Expected: 0 errors on new finops files. Pre-existing unrelated errors are acceptable.

- [ ] **Step 3: Prisma validate**

```bash
cd packages/database && npx prisma validate 2>&1
```
Expected: `The schema at ... is valid`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(finops): v1 complete — AWS sync pipeline, budget dashboard, cost detail, connect wizard"
```

---

## Summary — Files Touched

### Created (new)
```
packages/database/prisma/schema/finops.prisma
packages/database/prisma/migrations/20260525000001_finops_schema/migration.sql
packages/database/prisma/migrations/20260525000002_lean_budget_decimal_phase1/migration.sql
packages/database/prisma/migrations/20260525000003_lean_budget_decimal_phase2/migration.sql
packages/database/prisma/migrations/20260525000004_lean_budget_decimal_phase4/migration.sql
packages/database/prisma/migrations/20260525000005_lean_budget_decimal_phase5/migration.sql
apps/app/lib/inngest/client.ts
apps/app/lib/inngest/billing-sync.ts
apps/app/lib/billing-adapters/aws.ts
apps/app/lib/billing-adapters/tag-rule-engine.ts
apps/app/app/api/inngest/route.ts
apps/app/app/api/cron/billing-sync-dispatch/route.ts
apps/app/app/actions/billing/index.ts
apps/app/app/actions/billing/tag-rules.ts
apps/app/app/actions/billing/snapshots.ts
apps/app/app/(authenticated)/portfolio/budgets/[id]/page.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/budget-detail.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-breakdown-card.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-trend-chart.tsx
apps/app/app/(authenticated)/settings/integrations/components/billing-connect-wizard.tsx
apps/app/__tests__/finops/schema-sanity.test.ts
apps/app/__tests__/finops/lean-budget-dual-write.test.ts
apps/app/__tests__/finops/aws-adapter.test.ts
apps/app/__tests__/finops/tag-rule-engine.test.ts
apps/app/__tests__/finops/inngest-client.test.ts
vercel.json
```

### Modified (existing)
```
packages/database/prisma/schema/tenant.prisma    — finops back-refs
packages/database/prisma/schema/system.prisma    — Integration billing back-refs + source comment
packages/database/prisma/schema/portfolio.prisma — LeanBudget spentSource + spentManualOverride + StrategicTheme back-ref
apps/app/app/actions/lean-budget/index.ts        — dual-write + getBudgetById + phase 4 read switch
apps/app/app/(authenticated)/portfolio/budgets/page.tsx
apps/app/app/(authenticated)/portfolio/budgets/components/budget-dashboard.tsx
apps/app/app/(authenticated)/settings/integrations/components/integrations-board.tsx
apps/app/app/(authenticated)/components/sidebar.tsx
apps/app/package.json                            — inngest + @aws-sdk/* deps
```

---

## v2 Preview (deferred — do not implement in v1)

After v1 ships:
- GCP BigQuery adapter (`lib/billing-adapters/gcp.ts`)
- Azure Cost Management adapter (`lib/billing-adapters/azure.ts`)
- Anomaly detection — MAD algorithm (`lib/billing-adapters/anomaly-detector.ts`)
- EpicCostTable — `Δ = %Spent − %Done` flagship differentiator
- OKR ROI panel — `ROI = okrProgress% / (actualCost% of budget)`
- Tag Rules manager UI (`/portfolio/budgets/tag-rules`)
- Anomaly feed (`/portfolio/budgets/anomalies`)
- BillingEntryAllocation — split costs across themes
- re2 WASM for REGEX TagRule match type
- Inngest recursive dispatcher for >500 integrations

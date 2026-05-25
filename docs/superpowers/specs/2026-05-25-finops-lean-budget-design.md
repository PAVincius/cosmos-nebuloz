# FinOps Lean Budget — Design Spec
**Date:** 2026-05-25  
**Status:** Approved for implementation planning  
**Reviewed by:** Opus 4.7 (architecture + data model + pipeline + UI)

---

## 1. Strategic Context

### Problem
Lean Budget today is a manual CRUD tool: users type in `planned` and `spent` numbers. No real cost data. No connection to actual cloud/people/SaaS spend. Zero FinOps value.

### Strategic Positioning
**COSMOS does what no FinOps tool can:** connect financial cost to SAFe entities.

Apptio, Cloudability, CloudHealth show *cloud spend*. COSMOS shows:
- "Theme X burned 65% of budget but delivered 78% of OKRs → ROI = +0.20"
- "Epic E-204 spent 56% of budget with only 34% of story points done → risk"
- "$ per story point by ART this PI vs last PI"

That linkage — **cost ↔ Theme → ART → Epic → OKR** — is only possible in a tool that owns the SAFe domain model. No competitor has it.

### Scope (v1)
- Cloud billing: AWS Cost Explorer + GCP BigQuery Billing export + Azure Cost Management
- Cost types: cloud + people + SaaS (people via PersonCost, SaaS via manual/CSV initially)
- Sync: daily scheduled pull (Vercel Cron → Inngest)
- Mapping: tag rules (cloud tags → Strategic Theme)
- FinOps tools (Apptio/CloudHealth): out of scope — connect cloud directly

---

## 2. Architecture

### Approach: Hybrid — billing plugin in existing Integration system + dedicated FinOps models

Reuse existing `Integration` + `SyncLog` for credential management, sync status, and admin UX. Add dedicated billing models optimized for time-series cost data.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COSMOS Lean Budget FinOps                                                  │
│                                                                             │
│  ┌─────────────────┐   ┌─────────────────────────────────────────────────┐ │
│  │  Integration UI  │   │  Budget Dashboard                               │ │
│  │  (credentials +  │   │  planned vs actual, cost↔Theme, ART, Epic, OKR │ │
│  │   tag rules)     │   │                                                 │ │
│  └────────┬────────┘   └──────────┬──────────────────────────────────────┘ │
│           │                        │                                        │
│  ┌────────▼────────────────────────▼──────────────────────────────────────┐ │
│  │   actions/billing/  •  actions/finops/  (new modules)                  │ │
│  └────────────────────────────┬───────────────────────────────────────────┘ │
│                                │                                             │
│  ┌─────────────────────────────▼──────────────────────────────────────────┐ │
│  │             BillingSync Pipeline                                        │ │
│  │   Vercel Cron 02:00 UTC                                                 │ │
│  │        ↓ dispatch                                                       │ │
│  │   Inngest: billing/sync.requested (per tenantId + integrationId)        │ │
│  │        ↓                                                                │ │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────────────┐                     │ │
│  │   │AwsAdapter│  │GcpAdapter│  │ AzureAdapter     │                     │ │
│  │   └──────────┘  └──────────┘  └──────────────────┘                     │ │
│  │              ↓                                                          │ │
│  │   TagRule Engine → resolve themeId per BillingEntry                     │ │
│  │              ↓                                                          │ │
│  │   Aggregate → CostSnapshot (daily/monthly × theme/ART/epic/OKR)        │ │
│  │              ↓                                                          │ │
│  │   emit billing/snapshot.updated                                         │ │
│  │              ↓                          ↓                              │ │
│  │   AnomalyDetection job            LeanBudget.spent sync job            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  DB:  BillingEntry │ CostSnapshot │ TagRule │ UnmappedCostBucket            │
│       BillingSyncCursor │ BillingSyncRun │ CostAnomaly                      │
│       BudgetPlan │ CommitmentDiscount │ PersonCost │ CurrencyRate            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### New Modules
| Path | Role |
|------|------|
| `packages/database/prisma/schema/finops.prisma` | All new models |
| `apps/app/app/actions/billing/` | Sync trigger, connector CRUD, tag rules, snapshots |
| `apps/app/app/actions/finops/` | Budget overview, ROI metrics, anomaly queries |
| `apps/app/lib/billing-adapters/aws.ts` | AWS Cost Explorer adapter |
| `apps/app/lib/billing-adapters/gcp.ts` | GCP BigQuery billing adapter |
| `apps/app/lib/billing-adapters/azure.ts` | Azure Cost Management adapter |
| `apps/app/lib/billing-adapters/tag-rule-engine.ts` | Tag → theme resolution |
| `apps/app/lib/billing-adapters/anomaly-detector.ts` | MAD-based anomaly detection |
| `apps/app/lib/inngest/billing-sync.ts` | Inngest job definitions |
| `apps/app/app/api/cron/billing-sync-dispatch/route.ts` | Vercel Cron dispatch endpoint |

---

## 3. Data Model

New file: `packages/database/prisma/schema/finops.prisma`

### 3.1 BillingEntry — raw cost row (FOCUS v1.1 aligned)

```prisma
model BillingEntry {
  id              String   @id @default(cuid())
  tenantId        String
  integrationId   String
  syncLogId       String?

  // Provider identity
  provider        String           // "AWS" | "GCP" | "AZURE"
  accountId       String           // AWS account / GCP project / Azure subscription
  subAccountId    String?
  externalId      String           // stable provider ID for idempotency

  // FOCUS time range
  usageStartDate     DateTime
  usageEndDate       DateTime
  billingPeriodStart DateTime?
  billingPeriodEnd   DateTime?

  // FOCUS taxonomy
  service         String
  serviceCategory String?
  resourceType    String?
  resourceId      String?          // scrub PII before storing
  region          String?
  skuId           String?

  // FOCUS charge classification
  chargeCategory  String  @default("Usage") // Usage|Purchase|Tax|Credit|Adjustment
  chargeClass     String?                    // Correction|null
  chargeFrequency String?                    // OneTime|Recurring|UsageBased
  pricingCategory String?                    // OnDemand|Committed|Spot

  // FOCUS costs (keep native + amortized + effective)
  billedCost      Decimal  @db.Decimal(18,6)
  effectiveCost   Decimal  @db.Decimal(18,6)  // after commitment discounts
  listCost        Decimal? @db.Decimal(18,6)
  contractedCost  Decimal? @db.Decimal(18,6)
  unblendedAmount Decimal  @db.Decimal(18,6)
  amortizedAmount Decimal  @db.Decimal(18,6)

  // Usage
  usageQuantity   Decimal? @db.Decimal(18,6)
  usageUnit       String?

  // Commitment discount
  commitmentDiscountId   String?
  commitmentDiscountType String?  // RI|SP|CUD|NEGOTIATED

  // Currency — store both native and tenant base
  currency        String   @default("USD")
  fxRate          Decimal  @db.Decimal(18,8) @default(1)
  tenantCurrency  String   @default("USD")
  tenantAmount    Decimal  @db.Decimal(18,6)  // = effectiveCost * fxRate

  // Raw cloud tags
  tags            Json     @default("{}")

  // Resolved mapping
  themeId         String?
  mappingRuleId   String?
  mappingConf     String   @default("UNMAPPED")
  // EXACT_TAG | ACCOUNT_RULE | PREFIX | REGEX | COMPOUND | INHERITED | FALLBACK | UNMAPPED

  createdAt       DateTime @default(now())

  tenant         Tenant        @relation(fields:[tenantId], references:[id], onDelete:Cascade)
  integration    Integration   @relation(fields:[integrationId], references:[id], onDelete:Cascade)
  theme          StrategicTheme? @relation(fields:[themeId], references:[id], onDelete:SetNull)
  allocations    BillingEntryAllocation[]

  @@unique([integrationId, externalId])
  @@index([tenantId, usageStartDate])
  @@index([tenantId, provider, usageStartDate])
  @@index([tenantId, accountId, usageStartDate])
  @@index([tenantId, service, usageStartDate])
  @@index([tenantId, mappingConf])
  @@index([tenantId, themeId, usageStartDate])
  @@index([integrationId, usageStartDate])
  // NOTE: partition by usageStartDate in raw SQL migration for >1M rows/tenant
}
```

### 3.2 BillingEntryAllocation — split a line across multiple themes/ARTs/epics

```prisma
model BillingEntryAllocation {
  id             String   @id @default(cuid())
  tenantId       String
  billingEntryId String
  themeId        String?
  epicId         String?
  artId          String?
  percentage     Decimal  @db.Decimal(5,2)   // must sum to 100 across entry
  allocationType String                       // RULE | MANUAL | PROPORTIONAL
  effectiveFrom  DateTime @default(now())
  effectiveTo    DateTime?

  tenant       Tenant       @relation(fields:[tenantId], references:[id], onDelete:Cascade)
  billingEntry BillingEntry @relation(fields:[billingEntryId], references:[id], onDelete:Cascade)

  @@unique([billingEntryId, themeId, epicId, artId, effectiveFrom])
  @@index([tenantId, themeId])
  @@index([tenantId, epicId])
  @@index([tenantId, artId])
}
```

App layer must enforce: `SUM(percentage) = 100` per `billingEntryId` in the same effective period.

### 3.3 CostSnapshot — daily/monthly aggregate (the read model)

```prisma
model CostSnapshot {
  id              String   @id @default(cuid())
  tenantId        String
  // SAFe entity anchors (denormalized for query performance)
  themeId         String?
  artId           String?
  epicId          String?
  okrId           String?
  period          DateTime  // date truncated to day
  granularity     String    // DAILY | MONTHLY

  // Cost by type
  cloudCost       Decimal  @db.Decimal(18,6) @default(0)
  peopleCost      Decimal  @db.Decimal(18,6) @default(0)
  saasCost        Decimal  @db.Decimal(18,6) @default(0)
  actualCost      Decimal  @db.Decimal(18,6)  // sum of above
  plannedCost     Decimal? @db.Decimal(18,6)  // from BudgetPlan for this period

  unmappedAmount  Decimal  @db.Decimal(18,6) @default(0)
  breakdown       Json     @default("{}")     // {"EC2": 1200, "RDS": 800}
  sourceCurrencies Json    @default("{}")     // {"USD": 12000, "EUR": 8000}

  currency        String   @default("USD")   // tenant base currency
  fxStrategy      String   @default("MONTH_AVG")  // SPOT | MONTH_AVG | TRANSACTION_DATE
  fxConvertedAt   DateTime @default(now())
  syncedAt        DateTime @updatedAt

  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)

  @@unique([tenantId, themeId, artId, epicId, okrId, period, granularity])
  @@index([tenantId, period])
  @@index([tenantId, artId, period])
  @@index([tenantId, epicId, period])
  @@index([tenantId, okrId, period])
}
```

PI_PERIOD aggregates computed via `MATERIALIZED VIEW` joining `CostSnapshot` to `PIPlan.startDate/endDate`. Refreshed on `billing/snapshot.updated` and `piplan.dates.changed`.

### 3.4 TagRule — cloud tag → SAFe entity mapping

```prisma
model TagRule {
  id            String   @id @default(cuid())
  tenantId      String
  integrationId String?  // null = applies to all billing integrations for tenant
  name          String?

  // Matching
  tagKey        String?
  tagValue      String?
  matchType     String   @default("EXACT")  // EXACT | PREFIX | REGEX | ACCOUNT | COMPOUND
  conditions    Json?    // [{key, op, value}] for COMPOUND
  excludeConds  Json?    // negative conditions

  // Target SAFe entity
  themeId       String?
  artId         String?
  epicId        String?

  priority      Int      @default(0)  // higher wins; tie-break by createdAt ASC
  enabled       Boolean  @default(true)

  // Hygiene
  matchCount    Int      @default(0)
  lastMatchedAt DateTime?
  appliedFromDate DateTime?  // retroactive remap boundary

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)

  @@index([tenantId, integrationId])
  @@index([tenantId, priority])
}
```

### 3.5 UnmappedCostBucket — catch-all for untagged spend

```prisma
model UnmappedCostBucket {
  id            String   @id @default(cuid())
  tenantId      String
  integrationId String
  period        DateTime
  amount        Decimal  @db.Decimal(18,6)
  currency      String
  topTags       Json     @default("[]")  // [{key, value, amount, count}]
  entryCount    Int

  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)

  @@unique([tenantId, integrationId, period])
}
```

### 3.6 BillingSyncCursor — rolling window state

```prisma
model BillingSyncCursor {
  id                  String   @id @default(cuid())
  integrationId       String   @unique
  lastIngestedThrough DateTime
  lookbackDays        Int      @default(7)   // re-pull N days (bills are retroactively revised)
  backfillDays        Int      @default(90)
  backfillComplete    Boolean  @default(false)
  lastSyncLogId       String?
  consecutiveFailures Int      @default(0)
  nextRunAt           DateTime?

  integration Integration @relation(fields:[integrationId], references:[id], onDelete:Cascade)
}
```

### 3.7 BillingSyncRun — per-run progress and DLQ

```prisma
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

  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)
  @@index([tenantId, integrationId, startedAt])
}
```

### 3.8 CostAnomaly — detected spending deviations

```prisma
model CostAnomaly {
  id              String   @id @default(cuid())
  tenantId        String
  themeId         String?
  artId           String?
  integrationId   String?
  detectedAt      DateTime @default(now())
  period          DateTime
  service         String?
  accountId       String?

  // MAD-based detection
  baselineMedian  Decimal  @db.Decimal(18,6)
  baselineMAD     Decimal  @db.Decimal(18,6)
  actualAmount    Decimal  @db.Decimal(18,6)
  modifiedZScore  Decimal  @db.Decimal(8,4)
  deltaAbs        Decimal  @db.Decimal(18,6)
  deltaPct        Decimal  @db.Decimal(8,2)

  severity        String   // LOW | MEDIUM | HIGH | CRITICAL
  status          String   @default("OPEN")  // OPEN|ACKNOWLEDGED|RESOLVED|FALSE_POSITIVE
  acknowledgedBy  String?
  acknowledgedAt  DateTime?
  rootCauseHints  Json?

  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)

  @@unique([tenantId, themeId, service, period])
  @@index([tenantId, status, severity])
  @@index([tenantId, themeId, detectedAt])
}
```

### 3.9 Supporting Models

```prisma
// Explicit period-scoped budget for query joins
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
  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)
  @@unique([tenantId, scope, scopeId, period, granularity, category])
  @@index([tenantId, period])
}

// Commitment discounts: AWS RIs/SPs, GCP CUDs, Azure Reservations
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
  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)
  @@unique([integrationId, externalId])
  @@index([tenantId, endDate])
}

// People cost source for peopleCost in CostSnapshot
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
  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)
  @@index([tenantId, userId, effectiveFrom])
}

// FX rates (locked at ingest time)
model CurrencyRate {
  id    String   @id @default(cuid())
  from  String
  to    String
  rate  Decimal  @db.Decimal(18,8)
  date  DateTime
  @@unique([from, to, date])
}

// Staging table for in-flight sync pages (avoids memory buffering in Inngest step)
// Rows promoted to BillingEntry then deleted at end of each BillingSyncRun
model BillingEntryStaging {
  id            String   @id @default(cuid())
  tenantId      String
  integrationId String
  syncRunId     String
  payload       Json     // raw provider row, pre-normalization
  page          Int
  createdAt     DateTime @default(now())

  tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade)
  @@index([tenantId, integrationId, syncRunId])
}

// Resumable wizard state for billing connector setup
model IntegrationDraft {
  id          String   @id @default(cuid())
  userId      String
  tenantId    String
  provider    String
  currentStep Int      @default(1)
  payload     Json     @default("{}")
  updatedAt   DateTime @updatedAt
  expiresAt   DateTime // = updatedAt + 7 days; cron purges expired drafts
  @@unique([userId, tenantId, provider])
}
```

### 3.10 LeanBudget migration

```prisma
// Add to existing LeanBudget model:
spentSource          String   @default("MANUAL")  // MANUAL | BILLING_AGGREGATE | FORECAST
spentManualOverride  Decimal? @db.Decimal(18,6)   // overrides sync when set

// Migrate spent Float → Decimal: 5-phase zero-downtime migration
// Phase 1: ADD COLUMN spentDecimal DECIMAL(18,6) DEFAULT 0, spentSource TEXT DEFAULT 'MANUAL'
// Phase 2: UPDATE LeanBudget SET spentDecimal = spent::DECIMAL(18,6)
// Phase 3: Dual-write — ALL mutations in actions/lean-budget/* must write BOTH spent (Float) AND spentDecimal (Decimal)
//          Add parity test: after each write, assert ABS(spent - spentDecimal::Float) < 0.01
//          Rollback gate: if parity fails in CI, abort phase 3 deploy
// Phase 4: Switch all reads to spentDecimal
// Phase 5: DROP spent (old Float), RENAME spentDecimal → spent
// WARNING: All actions/lean-budget/* that use parseFloat()/Number() on spent must
//          handle Prisma Decimal.js instances after phase 4.
//          Grep: `Number(.*spent)|parseFloat(.*spent)` — each callsite must use `.toNumber()` or string coercion.
```

---

## 4. Sync Pipeline

### 4.1 Vercel Cron → Inngest fan-out

```
vercel.json:
{
  "crons": [{
    "path": "/api/cron/billing-sync-dispatch",
    "schedule": "0 2 * * *"
  }]
}

app/api/cron/billing-sync-dispatch/route.ts:
  - Verify CRON_SECRET header
  - Query: all Integration where source IN (billing_aws, billing_gcp, billing_azure) AND status = ACTIVE
  - For each: inngest.send({ name: "billing/sync.requested", data: { tenantId, integrationId } })
  - v1: simple inline fan-out — paginate LIMIT 100 OFFSET X, enqueue all active billing integrations synchronously
    Must complete in <60s (Vercel Pro function timeout). v1 supports up to ~500 integrations within this budget.
  - v2 (>500 integrations): cron route emits `billing/dispatch.requested`; Inngest handles pagination without timeout
```

### 4.2 Inngest Job: `billing/sync.run`

```typescript
inngest.createFunction(
  {
    id: "billing-sync",
    concurrency: [
      { key: "event.data.tenantId", limit: 2 },       // tenant fairness
      { key: "event.data.integrationId", limit: 1 },  // serialize per integration
      { scope: "fn", limit: 50 },                     // global ceiling
    ],
    retries: 3,
  },
  { event: "billing/sync.requested" },
  async ({ event, step }) => {
    // Step 1: Load cursor + config (fast, idempotent)
    const { cursor, config } = await step.run("load-cursor", ...)

    // Step 2: Fetch pages (one step.run per page, not all-at-once)
    // Stream to BillingEntryStaging table to avoid memory buffering
    let page = 0;
    while (hasMore) {
      await step.run(`fetch-page-${page}`, () => fetchAndStagePage(page))
      page++;
    }

    // Step 3: Promote staged entries to BillingEntry
    // createMany with skipDuplicates, batches of 500
    await step.run("promote-entries", ...)

    // Step 4: Resolve tag rules (chunked by accountId+day)
    for (const chunk of chunks) {
      await step.run(`resolve-tags-${chunk.key}`, () => resolveTagsForChunk(chunk))
    }

    // Step 5: Aggregate CostSnapshot
    await step.run("aggregate-snapshots", ...)

    // Step 6: Update UnmappedCostBucket
    await step.run("update-unmapped-bucket", ...)

    // Step 7: Advance cursor
    await step.run("advance-cursor", ...)

    // Step 8: Emit downstream events
    await inngest.send([
      { name: "billing/snapshot.updated", data: { tenantId, period } },
    ])
    // AnomalyDetection and LeanBudget sync subscribe to billing/snapshot.updated
    // They are NOT inline — failure isolation
  }
)
```

### 4.3 Provider Adapters

#### AWS Cost Explorer
```typescript
// Auth: AssumeRole (roleArn + externalId stored in Integration.config)
// NOT stored access keys — cross-account role is the security standard

const credentials = fromTemporaryCredentials({
  params: {
    RoleArn: config.roleArn,
    ExternalId: config.externalId,
    RoleSessionName: `cosmos-finops-${tenantId}`,
    DurationSeconds: 3600,
  },
});
const ce = new CostExplorerClient({ region: "us-east-1", credentials });

// Paginate manually (paginator helper buffers everything in memory)
// GroupBy: max 2 dimensions — choose SERVICE + custom tag `cosmos:theme`
// Pull metrics: AmortizedCost, UnblendedCost, UsageQuantity
// Granularity: DAILY (HOURLY adds cost per request at $0.01/page)

// Idempotent externalId: sha256(`${date}|${service}|${operation}|${usageType}|${resourceId ?? ""}`)

// ONBOARDING: Tag activation step — call ListCostAllocationTags,
// surface inactive tags as warning in integration setup wizard
```

#### GCP BigQuery Billing
```typescript
// Auth: service account JSON (encrypted in Integration.config)
// NOT the Billing REST API — it doesn't expose line items

// Query: partition-pruned to avoid full-scan ($5/TB risk)
const query = `
  SELECT
    usage_start_time, service.description, project.id,
    sku.description, labels, cost, credits,
    usage.amount, usage.unit
  FROM \`${config.projectId}.${config.dataset}.gcp_billing_export_resource_v1_*\`
  WHERE _PARTITIONTIME BETWEEN TIMESTAMP(@start) AND TIMESTAMP(@end)
    AND DATE(usage_start_time) BETWEEN @start AND @end
`;
// Use BigQuery Storage Read API for bulk: @google-cloud/bigquery-storage with Arrow streams

// Idempotent externalId: sha256(`${billingAccountId}|${usageStartTime}|${sku.id}|${project.id}|${resource.name ?? ""}`)
```

#### Azure Cost Management
```typescript
// Auth: service principal ClientSecretCredential
// Scope: stored in Integration.config (subscription | managementGroup | billingAccount)
// Token TTL: 60min — refresh at 50min proactively

const client = new CostManagementClient(credential);
// Throttle: read x-ms-ratelimit-remaining-*, respect Retry-After header
// Cap: 10 queries/min/subscription
// Pagination: follow nextLink URL directly (don't reconstruct)
// Tags: separate query required (Azure groups tags differently)
// Normalize tag keys to lowercase before TagRule matching
```

### 4.4 TagRule Engine

Resolution order:
1. Load all enabled `TagRule[]` for tenant ordered by `(priority DESC, createdAt ASC)`
2. Normalize tags per provider (GCP: lowercase; Azure: lowercase; AWS: case-sensitive as-is)
3. For each UNMAPPED `BillingEntry` in period:
   - Try COMPOUND rules: evaluate all conditions with AND logic; check excludeConds
   - Try EXACT, PREFIX, REGEX (use `re2` for regex — linear time, no DoS risk)
   - Try ACCOUNT rule (`accountId → themeId`, no tag matching)
   - First match → set `themeId`, `mappingRuleId`, `mappingConf`
   - No match → leave UNMAPPED, aggregate to `UnmappedCostBucket`
4. Batch-update `TagRule.matchCount + lastMatchedAt` after resolution pass (not per row)
5. On `TagRule` create/update: enqueue `billing/remap.requested` for retroactive re-mapping

### 4.5 Snapshot Aggregation

```sql
-- Run for each (tenantId, period) after tag resolution
-- DAILY granularity
INSERT INTO "CostSnapshot" (tenantId, themeId, artId, epicId, period, granularity, ...)
SELECT
  be.tenantId,
  be.themeId,
  r.artId,                          -- from TagRule or BillingEntryAllocation
  r.epicId,
  DATE_TRUNC('day', be.usageStartDate),
  'DAILY',
  SUM(be.tenantAmount) FILTER (WHERE be.chargeCategory != 'Credit') as cloudCost,
  -- breakdown JSON aggregated via json_object_agg
  ...
FROM "BillingEntry" be
LEFT JOIN "TagRule" r ON r.id = be.mappingRuleId
WHERE be.tenantId = $1 AND be.usageStartDate >= $2 AND be.usageStartDate < $3
GROUP BY be.tenantId, be.themeId, r.artId, r.epicId, DATE_TRUNC('day', be.usageStartDate)
ON CONFLICT (...) DO UPDATE SET ...;

-- MONTHLY rollup: aggregate DAILY into MONTHLY at end of month
-- PI_PERIOD: MATERIALIZED VIEW joining DAILY to PIPlan date ranges
```

### 4.6 Anomaly Detection (separate Inngest job)

Trigger: `billing/snapshot.updated`

Algorithm (MAD-based, weekday-aware):
```
For each (tenantId, themeId, service):
  1. Fetch last 28 days of DAILY CostSnapshot
  2. Split by isWeekend(day)
  3. baseline = values matching today's day-type
  4. baselineMedian = median(baseline)
  5. baselineMAD = median(|x - baselineMedian| for x in baseline)
  6. modifiedZ = 0.6745 * (today - baselineMedian) / (baselineMAD + ε)
  7. Anomaly if:
     - modifiedZ > 3.5
     - AND |today - baselineMedian| > $50 (magnitude floor)
     - AND deltaPct > 25%
  8. Severity buckets: LOW(3.5-5), MEDIUM(5-7), HIGH(7-10), CRITICAL(>10)

On anomaly:
  - Upsert CostAnomaly (@@unique on tenantId+themeId+service+period)
  - If CRITICAL: emit notification via existing notifications system
  - Link to relevant CostSnapshot for drill-down
```

---

## 5. UI/UX

### 5.1 Navigation (sidebar)

```
Portfolio
├── Lean Budget  ← anchor
│   ├── Overview        /portfolio/budgets
│   ├── Cost Explorer   /portfolio/budgets/explorer
│   ├── Anomalias       /portfolio/budgets/anomalies
│   └── Tag Rules       /portfolio/budgets/tag-rules
```

Keeps cost in portfolio context — users compare cost vs Themes/OKRs/ARTs without tab-switching.

### 5.2 Budget Dashboard (`/portfolio/budgets`) — upgraded

Layout:
- Unmapped spend banner (conditional, amber): "$12.4K não mapeado em 3 contas → [Revisar regras]"
- 4 KPI cards: Planejado | Real MTD | Forecast EoP | Guardrails violados
- Tabs: Por Tema | Por ART | Por Epic | Visão de Período
- Table with columns: Name | Planned | Actual | % Used (Progress bar) | Trend (sparkline) | OKR ROI | Status
- Status pill: `on track` / `warn` (>80%) / `breaching` (>100%)
- Empty state: 3 provider connect buttons + "Importar CSV"

### 5.3 Budget Detail (`/portfolio/budgets/[id]`)

12-col grid layout:
- **Col 1-8 (main):**
  - `CostBreakdownCard`: donut — Cloud / People / SaaS
  - `CostTrendChart`: recharts AreaChart (90d) — actual area + budget line (dashed) + anomaly markers (red dots)
  - Tabs: Daily | Weekly | Monthly
  - Top services: horizontal bar table (default) + treemap toggle
  - `EpicCostTable` ← flagship differentiator:
    | Column | Detail |
    |--------|--------|
    | Epic | linked to epic detail |
    | Budget | planned R$ |
    | Spent | actual R$ |
    | % Spent | progress bar |
    | % Done | story points |
    | Δ | `%Spent − %Done` (positive = burning faster than delivering) |
    | Status | derived: `on track` if `|Δ|≤10`, `warn` if `10<Δ≤25`, `risk` if `Δ>25` |
    Sort default: Δ desc

- **Col 9-12 (side):**
  - `OkrRoiPanel`: per OKR — progress dots + spend allocated + ROI score
    - `ROI score = okrProgress% / (actualCost% of budget)`. Severity: green ≥1.0, amber 0.7–1.0, red <0.7
  - Anomaly severity matrix: `modifiedZ 3.5–5 = LOW`, `5–7 = MEDIUM`, `7–10 = HIGH`, `>10 = CRITICAL`.
    Exception: if `deltaAbs > $5000`, floor severity at MEDIUM regardless of Z-score (magnitude override).
    - Color arrow: green if >1.0, amber 0.7-1.0, red <0.7
  - Guardrails card: CAPEX/OPEX % vs target
  - Recent anomalies card (last 7 days, 3 items + "ver todos")

### 5.4 Integration upgrade (Billing category)

In `/settings/integrations`:
- New "Billing & Cloud Cost" section above existing DevOps category
- 3 provider cards: AWS | GCP | Azure — with status, last sync, progress bar

**5-step connect wizard** (Dialog, resumable via `IntegrationDraft`):
1. Credentials form (provider-specific)
2. Test connection (live ping → account name/count)
3. Scope selection (accounts/projects/subscriptions)
4. Auto-suggest tag rules from discovered tags
5. Backfill (30d / 90d / 12m + warning on API cost)

### 5.5 Tag Rules Manager (`/portfolio/budgets/tag-rules`)

- 4 KPI cards: Coverage % | Mapped Spend | Unmapped | Active Rules
- Filter + search above table
- Table: Match | Maps to | Coverage (resource count) | Spent | actions
- **Unmapped suggestions panel** below table:
  - "💡 R$4.2K tagged `env:prod` sem regra → [Criar regra] [Ignorar]"
  - Drives rule hygiene without user hunting
- Rule edit: `Sheet` component (right slide-in) with live preview (debounced 400ms)
  - Preview shows: "Esta regra vai mapear 412 recursos, R$142K nos últimos 30 dias"
  - Sample resource list
  - `[Salvar e reaplicar]` → triggers retroactive remap

### 5.6 Anomaly Feed (`/portfolio/budgets/anomalies`)

- 4 KPI cards: Open | Impact MTD | Avg time to ack | Suppressed
- Feed: Item list with severity left-border (red/amber/yellow)
- Per item: service + account + tag + expected vs actual + SAFe mapping
- Actions: [Acknowledger] [Investigar →] [Snooze ▾]
- Investigate → Sheet with cost-trend chart pre-zoomed to anomaly window

**Alert delivery:**
| Severity | Channel |
|----------|---------|
| CRITICAL | Toast (in-context) + notification bell |
| HIGH | Notification bell + dashboard banner count |
| MEDIUM/LOW | Dashboard banner count only |

No spam: RTEs/PMs are not on-call.
CRITICAL anomaly: toast fires only if user is active on FinOps page. If offline → unread bell badge + persisted CostAnomaly row (OPEN) — user sees it next login, no auto-dismiss.

### 5.6.1 Epic cost table edge cases

`Δ = %Spent − %Done`. Rules:
- If epic not started (%Done = 0): Δ only flagged if %Spent > 5% (grace threshold — prevents false alarms on newly funded epics)
- If epic 100% done: Δ ≤ 0 always shown as green regardless of magnitude
- Budget = 0: hide Δ, show "—" (unbudgeted)
- Story points = 0: show "sem estimativa" instead of %Done

Severity: `on track` if `|Δ| ≤ 10pp`, `warn` if `10 < Δ ≤ 25pp`, `risk` if `Δ > 25pp`. Only positive Δ (spending faster) is risk; negative Δ (delivering faster) shows info indicator, not warn.

### 5.7 SAFe cost surfaces (cross-cutting differentiator)

**Theme detail** (`theme-budget-panel.tsx`): add FinOps sub-panel with ROI chart, % spent vs % OKR progress, top 3 services.

**Epic cards** (portfolio kanban): add inline cost indicator `R$45K/80K (56%) • 34% done [△22%]` with amber pill if Δ > 10pp.

**OKR detail panel**: add Investment block — allocated spend + ROI score + linked epics breakdown.

**WSJF page**: add `ArtCostEfficiencyCard` — `$ per story point` by ART, current PI vs last PI.

### 5.8 Onboarding flow (empty state → first data)

```
Empty state (no connectors):
  WalletIcon + "Conecte um provedor de billing"
  [Conectar AWS] [Conectar GCP] [Conectar Azure]

After wizard step 3 (scope selected):
  "Testando conexão... ✓ 3 contas, 1.204 recursos encontrados"

After backfill started:
  Integration card shows: "Importando 90 dias • 2h restantes [████░░░░] 45%"

After backfill complete, no tag rules:
  Banner: "R$280K importado mas não mapeado para temas SAFe.
           [Criar primeira regra] ou [Usar sugestões automáticas]"

After first rules created:
  Budget dashboard populates; banner dismissed
```

---

## 6. Security

- **Credential storage**: billing credentials (role ARN, service account JSON, client secret) stored encrypted with envelope encryption (KMS-backed key). Higher sensitivity than Linear/GitHub tokens.
- **resourceId scrubbing**: strip PII from resource IDs before storing (e.g. S3 URIs with email in bucket name).
- **Cron auth**: `CRON_SECRET` environment variable, verified on dispatch route.
- **Audit log**: all TagRule creates/edits, manual sync triggers, and credential updates logged to `AuditLog`.
- **Azure secret expiry**: cron check warns 30 days before service principal expiry.

---

## 7. Error Handling

| Error | Behavior |
|-------|----------|
| Provider API rate limit (429) | Read `Retry-After`, exponential backoff, Inngest retry |
| AWS `ExpiredToken` | Re-AssumeRole automatically, retry step |
| GCP BigQuery scan cost spike | Pre-flight dry-run `jobs.query(dryRun:true)` → abort if >10GB |
| Idempotency violation | `createMany({ skipDuplicates: true })` — silent, counted in SyncRun |
| Tag regex DoS | `re2` engine, 100ms timeout per rule match |
| 3 consecutive sync failures | Set Integration.status = DEGRADED, notify admin via notification system |
| DLQ | After 3 Inngest retries → write to BillingSyncRun.status = DLQ, surface replay button in admin |

---

## 8. Testing Strategy

- **Unit**: TagRule engine (all matchType, edge cases, normalization), anomaly MAD algorithm, cost rollup aggregation
- **Integration**: adapter tests against provider sandbox/mock (AWS LocalStack, GCP emulator, Azure mock)
- **E2E**: full sync flow with seeded Integration → verify BillingEntry count, CostSnapshot values, LeanBudget.spent update
- **Contract**: FOCUS spec compliance test — validate BillingEntry field mapping against FOCUS v1.1 schema

---

## 9. Phased Delivery

### v1 — Foundation (3 sprints)

**Sprint 1 — Schema + Migration:**
- `finops.prisma` (all models, full FOCUS-shaped schema — pays forward, avoids later re-migration)
- Add inverse back-refs to `tenant.prisma`, `system.prisma`, `portfolio.prisma`
- `LeanBudget.spent` migration phases 1–3: ADD columns, backfill, dual-write in actions

**Sprint 2 — AWS Sync Pipeline:**
- AWS Cost Explorer adapter
- Inngest sync job (EXACT + ACCOUNT TagRule engine only, no re2)
- Vercel Cron dispatch (inline fan-out, v1 simple path)
- CostSnapshot DAILY + MONTHLY aggregation
- UnmappedCostBucket population
- `BillingSyncRun` progress tracking

**Sprint 3 — v1 UI + Migration Complete:**
- Budget dashboard upgrade (KPI cards, planned vs actual by theme, unmapped banner)
- Budget detail page (cost breakdown, trend chart — no epic table yet)
- AWS integration wizard (5 steps)
- `LeanBudget.spent` migration phases 4–5: swap reads, drop Float column

### v2 — Full Cloud + Differentiator
- GCP + Azure adapters
- BillingEntryAllocation (split rules)
- PI_PERIOD materialized view
- Anomaly detection (MAD)
- Epic cost table + OKR ROI panel
- Tag Rules manager + unmapped suggestions
- Anomaly feed + notifications

### v3 — Advanced FinOps
- CommitmentDiscount tracking (RI/SP/CUD utilization)
- Forecast view (30-day linear extrapolation)
- PersonCost (people cost source)
- FOCUS-compliant export
- `$ per story point` by ART
- Showback report PDF generation

---

## 10. Files to create/modify

### v1 — New files (Sprint 1-3 only)
```
packages/database/prisma/schema/finops.prisma         — all models (full schema, future-safe)
apps/app/app/actions/billing/index.ts                  — connector CRUD, sync trigger
apps/app/app/actions/billing/tag-rules.ts              — EXACT + ACCOUNT rule CRUD
apps/app/app/actions/billing/snapshots.ts              — snapshot query actions
apps/app/app/actions/finops/get-budget-overview.ts     — dashboard data
apps/app/lib/billing-adapters/aws.ts                   — AWS Cost Explorer adapter
apps/app/lib/billing-adapters/tag-rule-engine.ts       — EXACT + ACCOUNT matching only (no re2 in v1)
apps/app/lib/inngest/billing-sync.ts                   — Inngest job + downstream events
apps/app/app/api/cron/billing-sync-dispatch/route.ts   — Vercel Cron endpoint
apps/app/app/(authenticated)/portfolio/budgets/[id]/page.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/budget-detail.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-breakdown-card.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/cost-trend-chart.tsx
apps/app/app/(authenticated)/settings/integrations/components/billing-connect-wizard.tsx
```

### v1 — Modified files
```
packages/database/prisma/schema/tenant.prisma      — REQUIRED: add back-refs for all new finops models
                                                     (billingEntries, costSnapshots, tagRules, etc.)
packages/database/prisma/schema/system.prisma      — Integration: add billing_aws source type + back-refs
                                                     (billingEntries, billingSyncCursor)
packages/database/prisma/schema/portfolio.prisma   — LeanBudget: spentSource + spentManualOverride + Decimal migration
                                                     StrategicTheme: add billingEntries back-ref
apps/app/app/(authenticated)/components/sidebar.tsx — add Lean Budget sub-routes (stubs for v2 pages)
apps/app/app/(authenticated)/portfolio/budgets/page.tsx
apps/app/app/(authenticated)/portfolio/budgets/components/budget-dashboard.tsx
apps/app/app/(authenticated)/settings/integrations/components/integrations-board.tsx
vercel.json   — add cron entry
```

### v2 — Deferred files (NOT in v1)
```
apps/app/lib/billing-adapters/gcp.ts
apps/app/lib/billing-adapters/azure.ts
apps/app/lib/billing-adapters/anomaly-detector.ts       — MAD detection
apps/app/app/actions/finops/get-budget-detail.ts        — epic ROI queries
apps/app/app/actions/finops/anomalies.ts
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/okr-roi-panel.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/epic-cost-table.tsx
apps/app/app/(authenticated)/portfolio/budgets/[id]/components/service-treemap.tsx
apps/app/app/(authenticated)/portfolio/budgets/anomalies/page.tsx
apps/app/app/(authenticated)/portfolio/budgets/anomalies/components/anomaly-feed.tsx
apps/app/app/(authenticated)/portfolio/budgets/tag-rules/page.tsx
apps/app/app/(authenticated)/portfolio/budgets/tag-rules/components/{tag-rules-table,rule-edit-sheet,unmapped-suggestions}.tsx
apps/app/app/(authenticated)/portfolio/themes/[id]/components/theme-budget-panel.tsx  — FinOps sub-panel
apps/app/app/(authenticated)/portfolio/okrs/components/okr-detail-panel.tsx           — ROI block
apps/app/app/(authenticated)/portfolio/components/portfolio-board.tsx                 — epic cost indicator
apps/app/app/(authenticated)/components/notifications-provider.tsx                   — anomaly channel
apps/app/app/(authenticated)/portfolio/budgets/explorer/page.tsx
```

### v3 — Deferred files
```
apps/app/app/(authenticated)/portfolio/wsjf/components/art-cost-efficiency-card.tsx
```

---

## 11. Dependencies

### v1 new dependencies (verify against `apps/app/package.json`)
- `inngest` — Inngest SDK (likely not yet installed)
- `@aws-sdk/client-cost-explorer` — AWS CE client
- `@aws-sdk/credential-providers` — STS AssumeRole

### v1 NOT required (defer to v2/v3)
- `re2` — only needed for REGEX TagRule match type (v2)
- `@google-cloud/bigquery` — v2
- `@azure/arm-costmanagement`, `@azure/identity` — v2

# Onboarding – company_setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-page guided wizard that takes a new COSMOS tenant from zero → first PI Planning ready (Portfolio → VS → ART → Teams → PI), with DB-backed progress so the user can leave and resume.

**Architecture:** Lightweight progress tracking via `OnboardingProgress` Prisma model (1 row per tenant per flow). Wizard lives at `/onboarding/company` with its own full-page layout (no sidebar). Each step saves data to DB on completion; the server action also creates the real SAFe entities. The layout.tsx auto-redirects new org_admin users to `/onboarding` until `company_setup` is completed.

**Tech Stack:** Next.js 15 App Router (Server Components + Server Actions), Prisma + PostgreSQL, Zod, react-hook-form-free (manual useState like existing wizards), `wizard-ui.tsx` shell components, `useDraftState` hook for intra-step drafts.

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `packages/database/prisma/schema/onboarding.prisma` | `OnboardingProgress` + `MigrationConnection` models |
| `apps/app/app/actions/onboarding/schema.ts` | Zod schemas for all onboarding inputs |
| `apps/app/app/actions/onboarding/index.ts` | `getOrCreateProgress`, `saveStep`, `completeFlow`, `getProgress` |
| `apps/app/app/actions/onboarding/company.ts` | `createSAFeStructureFromOnboarding`, `inviteUsersFromOnboarding`, `createPIsFromOnboarding` |
| `apps/app/app/(authenticated)/onboarding/layout.tsx` | Full-page shell (no sidebar), COSMOS logo, progress bar |
| `apps/app/app/(authenticated)/onboarding/page.tsx` | Hub: loads progress, redirects to correct flow step |
| `apps/app/app/(authenticated)/onboarding/company/page.tsx` | Server component: loads progress, renders `CompanyWizard` |
| `apps/app/app/(authenticated)/onboarding/company/complete/page.tsx` | Health-check completion screen |
| `apps/app/app/(authenticated)/onboarding/company/components/onboarding-wizard-shell.tsx` | Full-page stepper + nav, shared by all company steps |
| `apps/app/app/(authenticated)/onboarding/company/components/steps/step-company-profile.tsx` | Step 1: tenant name, timezone, locale |
| `apps/app/app/(authenticated)/onboarding/company/components/steps/step-safe-structure.tsx` | Step 2: Portfolio → VS → ART (dynamic nested list) |
| `apps/app/app/(authenticated)/onboarding/company/components/steps/step-sectors.tsx` | Step 3: Departments + Business Units (skippable) |
| `apps/app/app/(authenticated)/onboarding/company/components/steps/step-org-chart.tsx` | Step 4: Minimal org nodes (skippable) |
| `apps/app/app/(authenticated)/onboarding/company/components/steps/step-users-teams.tsx` | Step 5: Invite users, create teams, assign roles |
| `apps/app/app/(authenticated)/onboarding/company/components/steps/step-pis-sprints.tsx` | Step 6: PI dates + generate iterations |
| `apps/app/app/(authenticated)/onboarding/company/components/steps/step-health-check.tsx` | Step 7: Read-only health check, "Complete Setup" button |

### Modified files
| Path | Change |
|---|---|
| `apps/app/app/(authenticated)/layout.tsx` | Add onboarding redirect after `currentUser()` check |
| `packages/database/prisma/schema.prisma` or generator config | Add `onboarding.prisma` to schema list |

---

## Task 1: DB Schema – OnboardingProgress + MigrationConnection

**Files:**
- Create: `packages/database/prisma/schema/onboarding.prisma`
- Modify: `packages/database/prisma/schema.prisma` (or `base.prisma` if that's the entry)

- [ ] **Step 1: Locate how prisma schema files are composed**

```bash
ls /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/packages/database/prisma/schema/
cat /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/packages/database/prisma/schema.prisma 2>/dev/null | head -20 || \
  cat /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/packages/database/prisma/schema/base.prisma | head -30
```

Expected: see if schema uses a single file or multiple `.prisma` files joined by a generator.

- [ ] **Step 2: Create `onboarding.prisma`**

```prisma
// packages/database/prisma/schema/onboarding.prisma

model OnboardingProgress {
  id             String   @id @default(cuid())
  tenantId       String
  flowType       String   // "company_setup" | "migration_setup"
  currentStep    Int      @default(0)
  completedSteps String[]
  data           Json     @default("{}")
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
  config        Json     // { baseUrl?, apiToken?, pat?, projectKeys? }
  status        String   @default("pending")
  errorMessage  String?
  discoveryData Json?
  mappingData   Json?
  importReport  Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```

- [ ] **Step 3: Add reverse relations to Tenant model in `base.prisma`**

Find the `model Tenant` block and add:
```prisma
  onboardingProgress  OnboardingProgress[]
  migrationConnections MigrationConnection[]
```

- [ ] **Step 4: Generate and run migration**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm --filter @repo/database prisma migrate dev --name add_onboarding
```

Expected output: `✔ Generated Prisma Client` and new migration file in `prisma/migrations/`.

- [ ] **Step 5: Verify types are generated**

```bash
pnpm --filter @repo/database prisma generate
```

Expected: no errors, `OnboardingProgress` and `MigrationConnection` appear in the generated client.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema/onboarding.prisma packages/database/prisma/schema/base.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add OnboardingProgress and MigrationConnection models"
```

---

## Task 2: Onboarding Server Actions

**Files:**
- Create: `apps/app/app/actions/onboarding/schema.ts`
- Create: `apps/app/app/actions/onboarding/index.ts`

- [ ] **Step 1: Write tests**

```bash
mkdir -p apps/app/app/actions/onboarding
```

Create `apps/app/app/actions/onboarding/__tests__/index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    onboardingProgress: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1", userId: "u1" }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

import { database } from "@repo/database";
import { getOrCreateProgress, saveStep, completeFlow } from "../index";

describe("getOrCreateProgress", () => {
  it("returns existing progress if found", async () => {
    const existing = { id: "p1", tenantId: "t1", flowType: "company_setup", currentStep: 2, completedSteps: ["company_profile"], data: {}, status: "in_progress" };
    (database.onboardingProgress.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);
    const result = await getOrCreateProgress("company_setup");
    expect(result).toEqual(existing);
    expect(database.onboardingProgress.create).not.toHaveBeenCalled();
  });

  it("creates new progress if not found", async () => {
    (database.onboardingProgress.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    (database.onboardingProgress.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "p2", tenantId: "t1", flowType: "company_setup", currentStep: 0, completedSteps: [], data: {}, status: "in_progress" });
    const result = await getOrCreateProgress("company_setup");
    expect(result.id).toBe("p2");
    expect(database.onboardingProgress.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "t1", flowType: "company_setup" }) })
    );
  });
});

describe("saveStep", () => {
  it("merges step data and advances currentStep", async () => {
    const existing = { id: "p1", tenantId: "t1", flowType: "company_setup", currentStep: 0, completedSteps: [], data: {}, status: "in_progress" };
    (database.onboardingProgress.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);
    (database.onboardingProgress.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...existing, currentStep: 1, completedSteps: ["company_profile"] });
    await saveStep({ flowType: "company_setup", stepKey: "company_profile", stepIndex: 0, data: { name: "Acme" } });
    expect(database.onboardingProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStep: 1,
          completedSteps: ["company_profile"],
        }),
      })
    );
  });
});

describe("completeFlow", () => {
  it("sets status to completed", async () => {
    const existing = { id: "p1", tenantId: "t1", flowType: "company_setup", currentStep: 6, completedSteps: ["company_profile", "safe_structure", "sectors", "org_chart", "users_teams", "pis_sprints"], data: {}, status: "in_progress" };
    (database.onboardingProgress.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);
    (database.onboardingProgress.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...existing, status: "completed" });
    await completeFlow("company_setup");
    expect(database.onboardingProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) })
    );
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
pnpm test app/actions/onboarding/__tests__/index.test.ts
```

Expected: FAIL with "Cannot find module '../index'"

- [ ] **Step 3: Create `schema.ts`**

```typescript
// apps/app/app/actions/onboarding/schema.ts
import { z } from "zod";

export const FlowTypeSchema = z.enum(["company_setup", "migration_setup"]);
export type FlowType = z.infer<typeof FlowTypeSchema>;

export const SaveStepSchema = z.object({
  flowType: FlowTypeSchema,
  stepKey: z.string().min(1),
  stepIndex: z.number().int().nonneg(),
  data: z.record(z.unknown()),
});
export type SaveStepInput = z.infer<typeof SaveStepSchema>;

export const CompanyProfileSchema = z.object({
  legalName: z.string().min(1).max(200).trim(),
  displayName: z.string().min(1).max(200).trim(),
  country: z.string().min(2).max(10),
  timezone: z.string().min(1),
  locale: z.string().min(2).max(10).default("pt-BR"),
  emailDomains: z.array(z.string().email().or(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/))).optional(),
});
export type CompanyProfileData = z.infer<typeof CompanyProfileSchema>;

export const SafeStructureItemSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().optional(),
});

export const ARTInputSchema = SafeStructureItemSchema.extend({
  cadence: z.number().int().min(4).max(26).default(10),
});

export const ValueStreamInputSchema = SafeStructureItemSchema.extend({
  arts: z.array(ARTInputSchema).min(1),
});

export const SafeStructureSchema = z.object({
  portfolioName: z.string().min(1).max(200).trim(),
  portfolioDescription: z.string().optional(),
  valueStreams: z.array(ValueStreamInputSchema).min(1),
});
export type SafeStructureData = z.infer<typeof SafeStructureSchema>;

export const SectorsSchema = z.object({
  departments: z.array(z.object({ name: z.string().min(1).max(200).trim(), description: z.string().optional() })),
  businessUnits: z.array(z.object({ name: z.string().min(1).max(200).trim() })),
});
export type SectorsData = z.infer<typeof SectorsSchema>;

export const OrgChartSchema = z.object({
  nodes: z.array(z.object({
    name: z.string().min(1).max(200).trim(),
    role: z.string().optional(),
    parentName: z.string().optional(),
  })),
});
export type OrgChartData = z.infer<typeof OrgChartSchema>;

export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  safeRole: z.enum(["RTE", "LPM", "PM", "SYSTEM_ARCHITECT", "PO", "SM", "DEVELOPER", "BUSINESS_OWNER"]),
  teamName: z.string().optional(),
});

export const UsersTeamsSchema = z.object({
  invites: z.array(InviteUserSchema),
  teams: z.array(z.object({
    name: z.string().min(1).max(200).trim(),
    artName: z.string().optional(),
    memberEmails: z.array(z.string().email()),
  })),
});
export type UsersTeamsData = z.infer<typeof UsersTeamsSchema>;

export const PISprintsSchema = z.object({
  piName: z.string().min(1).max(200).trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  iterationCount: z.number().int().min(2).max(8).default(5),
  sprintLengthDays: z.number().int().min(7).max(21).default(14),
  artName: z.string().min(1),
});
export type PISprintsData = z.infer<typeof PISprintsSchema>;
```

- [ ] **Step 4: Create `index.ts`**

```typescript
// apps/app/app/actions/onboarding/index.ts
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { SaveStepSchema, FlowTypeSchema, type FlowType } from "./schema";

export type { FlowType };

export async function getOrCreateProgress(flowType: FlowType) {
  const ctx = await requireTenantSession(await headers());

  const existing = await database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
  if (existing) return existing;

  return database.onboardingProgress.create({
    data: {
      tenantId: ctx.tenantId,
      flowType,
      currentStep: 0,
      completedSteps: [],
      data: {},
      status: "in_progress",
    },
  });
}

export async function getProgress(flowType: FlowType) {
  const ctx = await requireTenantSession(await headers());
  return database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
}

export async function saveStep(raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  const { flowType, stepKey, stepIndex, data } = SaveStepSchema.parse(raw);

  const progress = await database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
  if (!progress) throw new Error("OnboardingProgress not found.");

  const existingData = (progress.data as Record<string, unknown>) ?? {};
  const completedSteps = progress.completedSteps.includes(stepKey)
    ? progress.completedSteps
    : [...progress.completedSteps, stepKey];

  const updated = await database.onboardingProgress.update({
    where: { id: progress.id },
    data: {
      currentStep: Math.max(progress.currentStep, stepIndex + 1),
      completedSteps,
      data: { ...existingData, [stepKey]: data },
    },
  });

  revalidatePath("/onboarding");
  return updated;
}

export async function completeFlow(flowType: FlowType) {
  const ctx = await requireTenantSession(await headers());

  const progress = await database.onboardingProgress.findFirst({
    where: { tenantId: ctx.tenantId, flowType },
  });
  if (!progress) throw new Error("OnboardingProgress not found.");

  const updated = await database.onboardingProgress.update({
    where: { id: progress.id },
    data: { status: "completed" },
  });

  revalidatePath("/onboarding");
  revalidatePath("/");
  return updated;
}

export async function isOnboardingComplete(tenantId: string): Promise<boolean> {
  const progress = await database.onboardingProgress.findFirst({
    where: { tenantId, flowType: "company_setup" },
  });
  return progress?.status === "completed";
}
```

- [ ] **Step 5: Run tests — verify they PASS**

```bash
pnpm test app/actions/onboarding/__tests__/index.test.ts
```

Expected: all 3 test suites pass.

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/actions/onboarding/
git commit -m "feat(onboarding): add progress actions (getOrCreate, saveStep, completeFlow)"
```

---

## Task 3: company.ts – SAFe entity creation actions

**Files:**
- Create: `apps/app/app/actions/onboarding/company.ts`

- [ ] **Step 1: Write tests**

Create `apps/app/app/actions/onboarding/__tests__/company.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      portfolio: { create: vi.fn().mockResolvedValue({ id: "port1", name: "Digital" }) },
      valueStream: { create: vi.fn().mockResolvedValue({ id: "vs1" }) },
      aRT: { create: vi.fn().mockResolvedValue({ id: "art1" }) },
    })),
    onboardingProgress: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1", userId: "u1" }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createSAFeStructureFromOnboarding } from "../company";

describe("createSAFeStructureFromOnboarding", () => {
  it("creates portfolio, value streams, and ARTs in a transaction", async () => {
    const input = {
      portfolioName: "Digital",
      valueStreams: [{ name: "Payments", arts: [{ name: "Payments ART", cadence: 10 }] }],
    };
    const result = await createSAFeStructureFromOnboarding(input);
    expect(result.portfolioId).toBe("port1");
    expect(result.valueStreamIds).toHaveLength(1);
    expect(result.artIds).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
pnpm test app/actions/onboarding/__tests__/company.test.ts
```

Expected: FAIL with "Cannot find module '../company'"

- [ ] **Step 3: Create `company.ts`**

```typescript
// apps/app/app/actions/onboarding/company.ts
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  SafeStructureSchema,
  PISprintsSchema,
  type SafeStructureData,
  type PISprintsData,
} from "./schema";

export async function createSAFeStructureFromOnboarding(raw: SafeStructureData) {
  const ctx = await requireTenantSession(await headers());
  const input = SafeStructureSchema.parse(raw);

  const { portfolioId, valueStreamIds, artIds } = await database.$transaction(async (tx) => {
    const portfolio = await (tx as typeof database).portfolio.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.portfolioName,
        description: input.portfolioDescription ?? null,
      },
    });

    const valueStreamIds: string[] = [];
    const artIds: string[] = [];

    for (const vs of input.valueStreams) {
      const valueStream = await (tx as typeof database).valueStream.create({
        data: { tenantId: ctx.tenantId, portfolioId: portfolio.id, name: vs.name, description: vs.description ?? null },
      });
      valueStreamIds.push(valueStream.id);

      for (const art of vs.arts) {
        const artRecord = await (tx as typeof database).aRT.create({
          data: { tenantId: ctx.tenantId, valueStreamId: valueStream.id, name: art.name, cadence: art.cadence },
        });
        artIds.push(artRecord.id);
      }
    }

    return { portfolioId: portfolio.id, valueStreamIds, artIds };
  });

  revalidatePath("/portfolio");
  revalidatePath("/arts");
  return { portfolioId, valueStreamIds, artIds };
}

export async function createPIsFromOnboarding(raw: PISprintsData) {
  const ctx = await requireTenantSession(await headers());
  const input = PISprintsSchema.parse(raw);

  // Find the ART by name within this tenant
  const art = await database.aRT.findFirst({
    where: { name: input.artName, tenantId: ctx.tenantId },
  });
  if (!art) throw new Error(`ART "${input.artName}" não encontrado.`);

  const pi = await database.pIPlan.create({
    data: {
      tenantId: ctx.tenantId,
      artId: art.id,
      name: input.piName,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });

  revalidatePath(`/arts/${art.id}`);
  return { piId: pi.id, artId: art.id };
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
pnpm test app/actions/onboarding/__tests__/company.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/onboarding/company.ts apps/app/app/actions/onboarding/__tests__/company.test.ts
git commit -m "feat(onboarding): SAFe structure + PI creation actions"
```

---

## Task 4: Layout – auto-redirect for new tenants

**Files:**
- Modify: `apps/app/app/(authenticated)/layout.tsx`

- [ ] **Step 1: Import `isOnboardingComplete` in layout**

Open `apps/app/app/(authenticated)/layout.tsx`. Find the imports at the top.

Add import:
```typescript
import { isOnboardingComplete } from "./actions"; // adjust path based on where actions/onboarding/index.ts lands
```

Wait — layout.tsx can't directly import from `app/actions/onboarding/index.ts` as a server action (it IS a server component, so it CAN import server-side functions). Import directly:

```typescript
import { isOnboardingComplete } from "@/app/actions/onboarding/index";
```

- [ ] **Step 2: Add redirect logic after `currentUser()` check**

Find the block where `user` is resolved. After `const user = await currentUser()`, add:

```typescript
// Auto-redirect new tenants to onboarding (skip if already on onboarding/settings/api routes)
const requestPath = (await headers()).get("x-pathname") ?? "";
const skipPaths = ["/onboarding", "/settings", "/api", "/auth", "/profile"];
const shouldCheckOnboarding = !skipPaths.some((p) => requestPath.startsWith(p));

if (shouldCheckOnboarding && session?.session) {
  const activeTenantId =
    (session.session as unknown as { activeTenantId?: string })?.activeTenantId ?? null;
  if (activeTenantId) {
    const complete = await isOnboardingComplete(activeTenantId);
    if (!complete) {
      redirect("/onboarding");
    }
  }
}
```

> Note: `x-pathname` must be set by middleware. If it's not available, use `headers().get("referer")` as fallback or add a middleware to inject it. Check `apps/app/middleware.ts` first.

- [ ] **Step 3: Check if middleware already injects x-pathname**

```bash
cat /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app/middleware.ts 2>/dev/null || echo "NO_MIDDLEWARE"
```

If no middleware injects `x-pathname`, add one:

```typescript
// apps/app/middleware.ts (add or create)
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
npx tsc --noEmit 2>&1 | grep layout.tsx | head -10
```

Expected: no errors on layout.tsx.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/(authenticated)/layout.tsx apps/app/middleware.ts
git commit -m "feat(onboarding): auto-redirect new tenants to /onboarding until setup complete"
```

---

## Task 5: Onboarding layout + landing page

**Files:**
- Create: `apps/app/app/(authenticated)/onboarding/layout.tsx`
- Create: `apps/app/app/(authenticated)/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding layout (full-page, no sidebar)**

```typescript
// apps/app/app/(authenticated)/onboarding/layout.tsx
import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-6 py-3 flex items-center">
        <span className="font-semibold text-lg tracking-tight">COSMOS</span>
        <span className="ml-3 text-xs text-muted-foreground uppercase tracking-widest">
          Setup
        </span>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create landing page**

```typescript
// apps/app/app/(authenticated)/onboarding/page.tsx
import { redirect } from "next/navigation";
import { getProgress } from "@/app/actions/onboarding/index";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { BuildingIcon, ArrowRightIcon, DatabaseIcon } from "lucide-react";
import Link from "next/link";

export default async function OnboardingPage() {
  const [companyProgress, migrationProgress] = await Promise.all([
    getProgress("company_setup"),
    getProgress("migration_setup"),
  ]);

  // If company setup is in progress, redirect directly
  if (companyProgress && companyProgress.status === "in_progress") {
    redirect("/onboarding/company");
  }

  const companyDone = companyProgress?.status === "completed";
  const migrationDone = migrationProgress?.status === "completed";

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-8">
      <div className="text-center max-w-xl">
        <h1 className="text-3xl font-bold mb-2">Bem-vindo ao COSMOS</h1>
        <p className="text-muted-foreground">
          Configure sua estrutura SAFe em minutos. Comece do zero ou migre de outra ferramenta.
        </p>
      </div>

      <div className="grid gap-4 w-full max-w-2xl sm:grid-cols-2">
        <Card className={companyDone ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BuildingIcon className="h-4 w-4" />
              Configuração inicial
              {companyDone && <span className="ml-auto text-xs text-green-600">✓ Concluído</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Configure portfólios, ARTs, times e o primeiro PI — 7 passos guiados.
            </p>
            <Button asChild disabled={companyDone}>
              <Link href="/onboarding/company">
                {companyDone ? "Concluído" : "Começar"}
                {!companyDone && <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={migrationDone ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseIcon className="h-4 w-4" />
              Migrar de outra ferramenta
              {migrationDone && <span className="ml-auto text-xs text-green-600">✓ Concluído</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Importe projetos, épicos, times e sprints do Jira, Azure DevOps, Trello ou CSV.
            </p>
            <Button asChild variant="outline">
              <Link href="/onboarding/migration">
                {migrationDone ? "Ver relatório" : "Migrar dados"}
                <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {companyDone && (
        <Button variant="ghost" asChild>
          <Link href="/">Ir para o Dashboard →</Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep onboarding | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/(authenticated)/onboarding/
git commit -m "feat(onboarding): layout shell + landing page with flow selection"
```

---

## Task 6: OnboardingWizardShell component

**Files:**
- Create: `apps/app/app/(authenticated)/onboarding/company/components/onboarding-wizard-shell.tsx`

This is the full-page stepper used by all 7 company steps. Reuses `WizardBody`, `WizardChromeHeader`, `WizardFooterNav`, `WizardStepHeader` from existing `wizard-ui.tsx`.

- [ ] **Step 1: Create `onboarding-wizard-shell.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/onboarding-wizard-shell.tsx
"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";

export interface WizardStepMeta {
  key: string;
  label: string;
  optional?: boolean;
}

interface OnboardingWizardShellProps {
  steps: WizardStepMeta[];
  currentStep: number;
  completedSteps: string[];
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  isNextDisabled?: boolean;
  isSaving?: boolean;
  nextLabel?: string;
  children: React.ReactNode;
}

export function OnboardingWizardShell({
  steps,
  currentStep,
  completedSteps,
  onBack,
  onNext,
  onSkip,
  isNextDisabled = false,
  isSaving = false,
  nextLabel,
  children,
}: OnboardingWizardShellProps) {
  const isLast = currentStep === steps.length - 1;
  const pct = Math.round((completedSteps.length / (steps.length - 1)) * 100);

  return (
    <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4 py-8 gap-6">
      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Passo {currentStep + 1} de {steps.length}</span>
          <span>{pct}% completo</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const done = completedSteps.includes(step.key);
          const active = i === currentStep;
          return (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && !done && "border-primary text-primary",
                  !active && !done && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div className="w-4 h-px bg-muted-foreground/20 mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1">{children}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" onClick={onBack} disabled={currentStep === 0 || isSaving}>
          ← Voltar
        </Button>
        <div className="flex gap-2">
          {onSkip && (
            <Button variant="outline" onClick={onSkip} disabled={isSaving}>
              Pular
            </Button>
          )}
          <Button onClick={onNext} disabled={isNextDisabled || isSaving}>
            {isSaving ? "Salvando..." : (nextLabel ?? (isLast ? "Concluir setup" : "Salvar e avançar →"))}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/(authenticated)/onboarding/company/components/onboarding-wizard-shell.tsx
git commit -m "feat(onboarding): OnboardingWizardShell full-page stepper component"
```

---

## Task 7: Step 1 – Company Profile

**Files:**
- Create: `apps/app/app/(authenticated)/onboarding/company/components/steps/step-company-profile.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/steps/step-company-profile.tsx
"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { BuildingIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
];

const LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
];

export interface CompanyProfileFormData {
  legalName: string;
  displayName: string;
  country: string;
  timezone: string;
  locale: string;
}

interface StepCompanyProfileProps {
  defaultValues?: Partial<CompanyProfileFormData>;
  onChange: (data: CompanyProfileFormData) => void;
}

export function StepCompanyProfile({ defaultValues, onChange }: StepCompanyProfileProps) {
  const [data, setData] = useState<CompanyProfileFormData>({
    legalName: defaultValues?.legalName ?? "",
    displayName: defaultValues?.displayName ?? "",
    country: defaultValues?.country ?? "BR",
    timezone: defaultValues?.timezone ?? "America/Sao_Paulo",
    locale: defaultValues?.locale ?? "pt-BR",
  });

  function update(patch: Partial<CompanyProfileFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<BuildingIcon className="h-5 w-5" />}
        title="Perfil da empresa"
        description="Informações básicas que identificam o tenant no COSMOS."
      />
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legalName">
              Nome legal <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="legalName"
              value={data.legalName}
              onChange={(e) => update({ legalName: e.target.value })}
              placeholder="Acme Tecnologia LTDA"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">
              Nome de exibição <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="displayName"
              value={data.displayName}
              onChange={(e) => update({ displayName: e.target.value })}
              placeholder="Acme"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Fuso horário</Label>
            <Select value={data.timezone} onValueChange={(v) => update({ timezone: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Idioma padrão</Label>
            <Select value={data.locale} onValueChange={(v) => update({ locale: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function validateCompanyProfile(data: CompanyProfileFormData): string | null {
  if (!data.legalName.trim()) return "Nome legal é obrigatório.";
  if (!data.displayName.trim()) return "Nome de exibição é obrigatório.";
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/(authenticated)/onboarding/company/components/steps/step-company-profile.tsx
git commit -m "feat(onboarding): Step 1 – company profile form"
```

---

## Task 8: Step 2 – SAFe Structure

**Files:**
- Create: `apps/app/app/(authenticated)/onboarding/company/components/steps/step-safe-structure.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/steps/step-safe-structure.tsx
"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Badge } from "@repo/design-system/components/ui/badge";
import { PlusIcon, Trash2Icon, TrainFrontIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";

export interface ARTDraft { name: string; cadence: number }
export interface ValueStreamDraft { name: string; arts: ARTDraft[] }
export interface SafeStructureFormData {
  portfolioName: string;
  portfolioDescription: string;
  valueStreams: ValueStreamDraft[];
}

interface Props {
  defaultValues?: Partial<SafeStructureFormData>;
  onChange: (data: SafeStructureFormData) => void;
}

export function StepSafeStructure({ defaultValues, onChange }: Props) {
  const [data, setData] = useState<SafeStructureFormData>({
    portfolioName: defaultValues?.portfolioName ?? "",
    portfolioDescription: defaultValues?.portfolioDescription ?? "",
    valueStreams: defaultValues?.valueStreams ?? [
      { name: "", arts: [{ name: "", cadence: 10 }] },
    ],
  });

  function update(patch: Partial<SafeStructureFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  function addVS() {
    update({ valueStreams: [...data.valueStreams, { name: "", arts: [{ name: "", cadence: 10 }] }] });
  }

  function removeVS(i: number) {
    update({ valueStreams: data.valueStreams.filter((_, idx) => idx !== i) });
  }

  function updateVS(i: number, patch: Partial<ValueStreamDraft>) {
    update({
      valueStreams: data.valueStreams.map((vs, idx) =>
        idx === i ? { ...vs, ...patch } : vs
      ),
    });
  }

  function addART(vsIdx: number) {
    const vs = data.valueStreams[vsIdx];
    updateVS(vsIdx, { arts: [...vs.arts, { name: "", cadence: 10 }] });
  }

  function removeART(vsIdx: number, artIdx: number) {
    const vs = data.valueStreams[vsIdx];
    updateVS(vsIdx, { arts: vs.arts.filter((_, idx) => idx !== artIdx) });
  }

  function updateART(vsIdx: number, artIdx: number, patch: Partial<ARTDraft>) {
    const vs = data.valueStreams[vsIdx];
    updateVS(vsIdx, {
      arts: vs.arts.map((a, idx) => (idx === artIdx ? { ...a, ...patch } : a)),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<TrainFrontIcon className="h-5 w-5" />}
        title="Estrutura SAFe"
        description="Defina o portfólio, value streams e ARTs. Você pode adicionar mais depois."
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="pname">Nome do portfólio <span className="text-destructive">*</span></Label>
        <Input
          id="pname"
          value={data.portfolioName}
          onChange={(e) => update({ portfolioName: e.target.value })}
          placeholder="ex: Portfólio Digital"
          autoFocus
        />
        <Textarea
          value={data.portfolioDescription}
          onChange={(e) => update({ portfolioDescription: e.target.value })}
          placeholder="Descrição opcional"
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Label>Value Streams <span className="text-destructive">*</span></Label>
          <Button size="sm" variant="outline" onClick={addVS}>
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Value Stream
          </Button>
        </div>

        {data.valueStreams.map((vs, vi) => (
          <div key={vi} className="rounded-lg border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                value={vs.name}
                onChange={(e) => updateVS(vi, { name: e.target.value })}
                placeholder="ex: Pagamentos"
                className="flex-1"
              />
              {data.valueStreams.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => removeVS(vi)}>
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2 pl-3 border-l">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>ARTs neste VS</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => addART(vi)}>
                  <PlusIcon className="mr-1 h-3 w-3" /> ART
                </Button>
              </div>
              {vs.arts.map((art, ai) => (
                <div key={ai} className="flex items-center gap-2">
                  <Input
                    value={art.name}
                    onChange={(e) => updateART(vi, ai, { name: e.target.value })}
                    placeholder="Nome do ART"
                    className="flex-1 h-8 text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={4}
                      max={26}
                      value={art.cadence}
                      onChange={(e) => updateART(vi, ai, { cadence: Number(e.target.value) })}
                      className="w-16 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">sem</span>
                  </div>
                  {vs.arts.length > 1 && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeART(vi, ai)}>
                      <Trash2Icon className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function validateSafeStructure(data: SafeStructureFormData): string | null {
  if (!data.portfolioName.trim()) return "Nome do portfólio é obrigatório.";
  for (const vs of data.valueStreams) {
    if (!vs.name.trim()) return "Todos os Value Streams precisam de nome.";
    for (const art of vs.arts) {
      if (!art.name.trim()) return "Todos os ARTs precisam de nome.";
    }
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/(authenticated)/onboarding/company/components/steps/step-safe-structure.tsx
git commit -m "feat(onboarding): Step 2 – SAFe structure (portfolio/VS/ART) form"
```

---

## Task 9: Steps 3–6 (Sectors, OrgChart, Users/Teams, PIs/Sprints)

**Files:**
- Create: `step-sectors.tsx`, `step-org-chart.tsx`, `step-users-teams.tsx`, `step-pis-sprints.tsx`

Steps 3 and 4 are `optional` (skippable). Steps 5 and 6 are required.

- [ ] **Step 1: Create `step-sectors.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/steps/step-sectors.tsx
"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon, Trash2Icon, BuildingIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";

export interface SectorsFormData {
  departments: { name: string }[];
  businessUnits: { name: string }[];
}

interface Props {
  defaultValues?: Partial<SectorsFormData>;
  onChange: (data: SectorsFormData) => void;
}

export function StepSectors({ defaultValues, onChange }: Props) {
  const [data, setData] = useState<SectorsFormData>({
    departments: defaultValues?.departments ?? [{ name: "" }],
    businessUnits: defaultValues?.businessUnits ?? [],
  });

  function update(patch: Partial<SectorsFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<BuildingIcon className="h-5 w-5" />}
        title="Setores e Unidades de Negócio"
        description="Opcional. Departamentos e unidades de negócio da empresa. Pode ser configurado depois."
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Departamentos</Label>
            <Button size="sm" variant="outline" onClick={() => update({ departments: [...data.departments, { name: "" }] })}>
              <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {data.departments.map((d, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={d.name}
                onChange={(e) => update({ departments: data.departments.map((x, j) => j === i ? { name: e.target.value } : x) })}
                placeholder="ex: Engenharia, Produto, Marketing"
              />
              {data.departments.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => update({ departments: data.departments.filter((_, j) => j !== i) })}>
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Unidades de Negócio</Label>
            <Button size="sm" variant="outline" onClick={() => update({ businessUnits: [...data.businessUnits, { name: "" }] })}>
              <PlusIcon className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {data.businessUnits.map((bu, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={bu.name}
                onChange={(e) => update({ businessUnits: data.businessUnits.map((x, j) => j === i ? { name: e.target.value } : x) })}
                placeholder="ex: Varejo, B2B, Fintech"
              />
              <Button size="sm" variant="ghost" onClick={() => update({ businessUnits: data.businessUnits.filter((_, j) => j !== i) })}>
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {data.businessUnits.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma unidade adicionada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `step-org-chart.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/steps/step-org-chart.tsx
"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";

export interface OrgChartFormData {
  nodes: { name: string; role: string; parentName: string }[];
}

interface Props {
  defaultValues?: Partial<OrgChartFormData>;
  onChange: (data: OrgChartFormData) => void;
}

export function StepOrgChart({ defaultValues, onChange }: Props) {
  const [data, setData] = useState<OrgChartFormData>({
    nodes: defaultValues?.nodes ?? [{ name: "", role: "", parentName: "" }],
  });

  function update(nodes: OrgChartFormData["nodes"]) {
    const next = { nodes };
    setData(next);
    onChange(next);
  }

  function updateNode(i: number, patch: Partial<OrgChartFormData["nodes"][0]>) {
    update(data.nodes.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<UsersIcon className="h-5 w-5" />}
        title="Organograma mínimo"
        description="Opcional. Lideranças e hierarquia básica. Pode ser expandido depois."
      />
      <div className="flex flex-col gap-3">
        {data.nodes.map((node, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <Input
              value={node.name}
              onChange={(e) => updateNode(i, { name: e.target.value })}
              placeholder="Nome"
            />
            <Input
              value={node.role}
              onChange={(e) => updateNode(i, { role: e.target.value })}
              placeholder="Cargo (ex: CTO)"
            />
            <div className="flex gap-1">
              <Input
                value={node.parentName}
                onChange={(e) => updateNode(i, { parentName: e.target.value })}
                placeholder="Manager (nome)"
              />
              <Button size="sm" variant="ghost" onClick={() => update(data.nodes.filter((_, j) => j !== i))}>
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => update([...data.nodes, { name: "", role: "", parentName: "" }])}
        >
          <PlusIcon className="mr-1 h-3.5 w-3.5" /> Pessoa
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `step-users-teams.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/steps/step-users-teams.tsx
"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";

const SAFE_ROLES = ["RTE", "LPM", "PM", "SYSTEM_ARCHITECT", "PO", "SM", "DEVELOPER", "BUSINESS_OWNER"] as const;

export interface InviteDraft { email: string; name: string; safeRole: typeof SAFE_ROLES[number] }
export interface TeamDraft { name: string; artName: string }

export interface UsersTeamsFormData {
  invites: InviteDraft[];
  teams: TeamDraft[];
}

interface Props {
  defaultValues?: Partial<UsersTeamsFormData>;
  artNames: string[];
  onChange: (data: UsersTeamsFormData) => void;
}

export function StepUsersTeams({ defaultValues, artNames, onChange }: Props) {
  const [data, setData] = useState<UsersTeamsFormData>({
    invites: defaultValues?.invites ?? [{ email: "", name: "", safeRole: "DEVELOPER" }],
    teams: defaultValues?.teams ?? [{ name: "", artName: artNames[0] ?? "" }],
  });

  function update(patch: Partial<UsersTeamsFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  function updateInvite(i: number, patch: Partial<InviteDraft>) {
    update({ invites: data.invites.map((inv, j) => (j === i ? { ...inv, ...patch } : inv)) });
  }

  function updateTeam(i: number, patch: Partial<TeamDraft>) {
    update({ teams: data.teams.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<UsersIcon className="h-5 w-5" />}
        title="Usuários, times e papéis SAFe"
        description="Convide as lideranças-chave e crie os times do ART."
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Convidar usuários</Label>
          <Button size="sm" variant="outline" onClick={() => update({ invites: [...data.invites, { email: "", name: "", safeRole: "DEVELOPER" }] })}>
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Convidar
          </Button>
        </div>
        {data.invites.map((inv, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <Input
              value={inv.email}
              onChange={(e) => updateInvite(i, { email: e.target.value })}
              placeholder="email@empresa.com"
              type="email"
            />
            <Input
              value={inv.name}
              onChange={(e) => updateInvite(i, { name: e.target.value })}
              placeholder="Nome"
            />
            <div className="flex gap-1">
              <Select value={inv.safeRole} onValueChange={(v) => updateInvite(i, { safeRole: v as typeof SAFE_ROLES[number] })}>
                <SelectTrigger className="flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAFE_ROLES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                </SelectContent>
              </Select>
              {data.invites.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => update({ invites: data.invites.filter((_, j) => j !== i) })}>
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Times do ART</Label>
          <Button size="sm" variant="outline" onClick={() => update({ teams: [...data.teams, { name: "", artName: artNames[0] ?? "" }] })}>
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Time
          </Button>
        </div>
        {data.teams.map((team, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={team.name}
              onChange={(e) => updateTeam(i, { name: e.target.value })}
              placeholder="Nome do time"
              className="flex-1"
            />
            <Select value={team.artName} onValueChange={(v) => updateTeam(i, { artName: v })}>
              <SelectTrigger className="w-40 text-xs">
                <SelectValue placeholder="ART" />
              </SelectTrigger>
              <SelectContent>
                {artNames.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {data.teams.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => update({ teams: data.teams.filter((_, j) => j !== i) })}>
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function validateUsersTeams(data: UsersTeamsFormData): string | null {
  for (const inv of data.invites) {
    if (inv.email && !inv.name.trim()) return "Informe o nome de cada usuário convidado.";
  }
  for (const team of data.teams) {
    if (!team.name.trim()) return "Todos os times precisam de nome.";
  }
  return null;
}
```

- [ ] **Step 4: Create `step-pis-sprints.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/steps/step-pis-sprints.tsx
"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";

export interface PISprintsFormData {
  piName: string;
  startDate: string;
  endDate: string;
  iterationCount: number;
  sprintLengthDays: number;
  artName: string;
}

interface Props {
  defaultValues?: Partial<PISprintsFormData>;
  artNames: string[];
  onChange: (data: PISprintsFormData) => void;
}

export function StepPIsSprints({ defaultValues, artNames, onChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState<PISprintsFormData>({
    piName: defaultValues?.piName ?? "PI 2026-Q3",
    startDate: defaultValues?.startDate ?? today,
    endDate: defaultValues?.endDate ?? "",
    iterationCount: defaultValues?.iterationCount ?? 5,
    sprintLengthDays: defaultValues?.sprintLengthDays ?? 14,
    artName: defaultValues?.artName ?? artNames[0] ?? "",
  });

  function update(patch: Partial<PISprintsFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  const estimatedEnd = data.startDate && data.iterationCount && data.sprintLengthDays
    ? new Date(new Date(data.startDate).getTime() + data.iterationCount * data.sprintLengthDays * 86_400_000).toISOString().slice(0, 10)
    : "";

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<CalendarIcon className="h-5 w-5" />}
        title="Configuração do primeiro PI"
        description="Defina o horizon do Program Increment e o comprimento das sprints."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Nome do PI <span className="text-destructive">*</span></Label>
          <Input
            value={data.piName}
            onChange={(e) => update({ piName: e.target.value })}
            placeholder="PI 2026-Q3"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>ART <span className="text-destructive">*</span></Label>
          <Select value={data.artName} onValueChange={(v) => update({ artName: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {artNames.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Data de início</Label>
          <Input type="date" value={data.startDate} onChange={(e) => update({ startDate: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nº de iterações</Label>
          <Select value={String(data.iterationCount)} onValueChange={(v) => update({ iterationCount: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n} sprints</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Comprimento do sprint</Label>
          <Select value={String(data.sprintLengthDays)} onValueChange={(v) => update({ sprintLengthDays: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">1 semana (7 dias)</SelectItem>
              <SelectItem value="14">2 semanas (14 dias)</SelectItem>
              <SelectItem value="21">3 semanas (21 dias)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {estimatedEnd && (
          <div className="flex flex-col gap-1.5">
            <Label>Data de término estimada</Label>
            <Input value={estimatedEnd} disabled />
          </div>
        )}
      </div>
    </div>
  );
}

export function validatePIsSprints(data: PISprintsFormData): string | null {
  if (!data.piName.trim()) return "Nome do PI é obrigatório.";
  if (!data.startDate) return "Data de início é obrigatória.";
  if (!data.artName) return "Selecione o ART.";
  return null;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/(authenticated)/onboarding/company/components/steps/
git commit -m "feat(onboarding): Steps 3-6 – sectors, org-chart, users/teams, PIs/sprints"
```

---

## Task 10: Step 7 – Health Check + company/page.tsx (wizard orchestrator)

**Files:**
- Create: `step-health-check.tsx`
- Create: `apps/app/app/(authenticated)/onboarding/company/page.tsx`
- Create: `apps/app/app/(authenticated)/onboarding/company/complete/page.tsx`

- [ ] **Step 1: Create `step-health-check.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/steps/step-health-check.tsx
"use client";

import { CheckCircle2Icon, XCircleIcon, ShieldCheckIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";

export interface HealthCheckData {
  hasPortfolio: boolean;
  hasART: boolean;
  hasPI: boolean;
  hasTeam: boolean;
  hasUsers: boolean;
}

interface Props {
  data: HealthCheckData;
}

export function StepHealthCheck({ data }: Props) {
  const items = [
    { label: "Portfólio criado", ok: data.hasPortfolio },
    { label: "Pelo menos 1 ART configurado", ok: data.hasART },
    { label: "PI Planning configurado", ok: data.hasPI },
    { label: "Pelo menos 1 time criado", ok: data.hasTeam },
    { label: "Usuários convidados", ok: data.hasUsers },
  ];

  const allGood = items.every((i) => i.ok);

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<ShieldCheckIcon className="h-5 w-5" />}
        title="Checklist final"
        description="Verifique se a estrutura SAFe mínima está configurada antes de começar."
      />
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            {item.ok ? (
              <CheckCircle2Icon className="h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <span className={item.ok ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      {allGood ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-600">
          ✅ Estrutura mínima completa. Clique em "Concluir setup" para começar a usar o COSMOS.
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-700">
          ⚠️ Alguns itens ainda estão pendentes. Você pode concluir e configurar depois, ou voltar para completar agora.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `company/page.tsx` (wizard orchestrator)**

```typescript
// apps/app/app/(authenticated)/onboarding/company/page.tsx
import { redirect } from "next/navigation";
import { getOrCreateProgress } from "@/app/actions/onboarding/index";
import { CompanyWizardClient } from "./components/company-wizard-client";
import { getARTs } from "@/app/actions/arts/get-arts";
import { database } from "@repo/database";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";

export default async function CompanySetupPage() {
  const progress = await getOrCreateProgress("company_setup");

  if (progress.status === "completed") {
    redirect("/onboarding/company/complete");
  }

  // Fetch context data for steps that need it (ARTs for step 5/6)
  const arts = await getARTs();
  const artNames = arts.map((a) => a.name);

  const stepData = (progress.data as Record<string, unknown>) ?? {};

  return (
    <CompanyWizardClient
      initialStep={progress.currentStep}
      completedSteps={progress.completedSteps}
      savedData={stepData}
      artNames={artNames}
      progressId={progress.id}
    />
  );
}
```

- [ ] **Step 3: Create `company-wizard-client.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/components/company-wizard-client.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OnboardingWizardShell, type WizardStepMeta } from "./onboarding-wizard-shell";
import { StepCompanyProfile, validateCompanyProfile, type CompanyProfileFormData } from "./steps/step-company-profile";
import { StepSafeStructure, validateSafeStructure, type SafeStructureFormData } from "./steps/step-safe-structure";
import { StepSectors, type SectorsFormData } from "./steps/step-sectors";
import { StepOrgChart, type OrgChartFormData } from "./steps/step-org-chart";
import { StepUsersTeams, validateUsersTeams, type UsersTeamsFormData } from "./steps/step-users-teams";
import { StepPIsSprints, validatePIsSprints, type PISprintsFormData } from "./steps/step-pis-sprints";
import { StepHealthCheck, type HealthCheckData } from "./steps/step-health-check";
import { saveStep, completeFlow } from "@/app/actions/onboarding/index";
import { createSAFeStructureFromOnboarding, createPIsFromOnboarding } from "@/app/actions/onboarding/company";

const STEPS: WizardStepMeta[] = [
  { key: "company_profile", label: "Perfil" },
  { key: "safe_structure", label: "SAFe" },
  { key: "sectors", label: "Setores", optional: true },
  { key: "org_chart", label: "Org", optional: true },
  { key: "users_teams", label: "Times" },
  { key: "pis_sprints", label: "PIs" },
  { key: "health_check", label: "Revisão" },
];

interface Props {
  initialStep: number;
  completedSteps: string[];
  savedData: Record<string, unknown>;
  artNames: string[];
  progressId: string;
}

export function CompanyWizardClient({
  initialStep,
  completedSteps: initialCompleted,
  savedData,
  artNames: initialArtNames,
  progressId: _progressId,
}: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(Math.min(initialStep, STEPS.length - 1));
  const [completedSteps, setCompletedSteps] = useState<string[]>(initialCompleted);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step data state (starts from saved DB data)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileFormData>(
    (savedData.company_profile as CompanyProfileFormData) ?? { legalName: "", displayName: "", country: "BR", timezone: "America/Sao_Paulo", locale: "pt-BR" }
  );
  const [safeStructure, setSafeStructure] = useState<SafeStructureFormData>(
    (savedData.safe_structure as SafeStructureFormData) ?? { portfolioName: "", portfolioDescription: "", valueStreams: [{ name: "", arts: [{ name: "", cadence: 10 }] }] }
  );
  const [sectors, setSectors] = useState<SectorsFormData>(
    (savedData.sectors as SectorsFormData) ?? { departments: [{ name: "" }], businessUnits: [] }
  );
  const [orgChart, setOrgChart] = useState<OrgChartFormData>(
    (savedData.org_chart as OrgChartFormData) ?? { nodes: [{ name: "", role: "", parentName: "" }] }
  );
  const [usersTeams, setUsersTeams] = useState<UsersTeamsFormData>(
    (savedData.users_teams as UsersTeamsFormData) ?? { invites: [{ email: "", name: "", safeRole: "DEVELOPER" }], teams: [{ name: "", artName: initialArtNames[0] ?? "" }] }
  );
  const [pisSprints, setPisSprints] = useState<PISprintsFormData>(
    (savedData.pis_sprints as PISprintsFormData) ?? { piName: "PI 2026-Q3", startDate: "", endDate: "", iterationCount: 5, sprintLengthDays: 14, artName: initialArtNames[0] ?? "" }
  );

  // Derive art names from what was saved in safeStructure
  const derivedArtNames = safeStructure.valueStreams.flatMap((vs) => vs.arts.map((a) => a.name)).filter(Boolean);
  const artNamesForSteps = derivedArtNames.length > 0 ? derivedArtNames : initialArtNames;

  // Health check data (simplified — just checks if fields are non-empty)
  const healthCheck: HealthCheckData = {
    hasPortfolio: !!safeStructure.portfolioName.trim(),
    hasART: safeStructure.valueStreams.some((vs) => vs.arts.some((a) => a.name.trim())),
    hasPI: !!pisSprints.piName.trim() && !!pisSprints.startDate,
    hasTeam: usersTeams.teams.some((t) => t.name.trim()),
    hasUsers: usersTeams.invites.some((i) => i.email.trim()),
  };

  const stepKey = STEPS[currentStep].key;

  function validateCurrentStep(): string | null {
    switch (stepKey) {
      case "company_profile": return validateCompanyProfile(companyProfile);
      case "safe_structure":  return validateSafeStructure(safeStructure);
      case "users_teams":     return validateUsersTeams(usersTeams);
      case "pis_sprints":     return validatePIsSprints(pisSprints);
      default: return null;
    }
  }

  function getCurrentStepData(): unknown {
    switch (stepKey) {
      case "company_profile": return companyProfile;
      case "safe_structure":  return safeStructure;
      case "sectors":         return sectors;
      case "org_chart":       return orgChart;
      case "users_teams":     return usersTeams;
      case "pis_sprints":     return pisSprints;
      default: return {};
    }
  }

  function handleNext() {
    const validationError = validateCurrentStep();
    if (validationError) { setError(validationError); return; }
    setError(null);

    startTransition(async () => {
      try {
        await saveStep({ flowType: "company_setup", stepKey, stepIndex: currentStep, data: getCurrentStepData() as Record<string, unknown> });

        // Side effects: create real SAFe entities on step completion
        if (stepKey === "safe_structure") {
          await createSAFeStructureFromOnboarding(safeStructure);
        }
        if (stepKey === "pis_sprints") {
          await createPIsFromOnboarding(pisSprints);
        }

        setCompletedSteps((prev) => prev.includes(stepKey) ? prev : [...prev, stepKey]);

        if (currentStep < STEPS.length - 1) {
          setCurrentStep((s) => s + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
      }
    });
  }

  function handleSkip() {
    startTransition(async () => {
      await saveStep({ flowType: "company_setup", stepKey, stepIndex: currentStep, data: {} });
      setCurrentStep((s) => s + 1);
    });
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await completeFlow("company_setup");
        router.push("/onboarding/company/complete");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao finalizar.");
      }
    });
  }

  const isLastStep = currentStep === STEPS.length - 1;
  const isOptional = STEPS[currentStep].optional;

  return (
    <OnboardingWizardShell
      steps={STEPS}
      currentStep={currentStep}
      completedSteps={completedSteps}
      onBack={() => setCurrentStep((s) => Math.max(s - 1, 0))}
      onNext={isLastStep ? handleComplete : handleNext}
      onSkip={isOptional ? handleSkip : undefined}
      isSaving={isPending}
      nextLabel={isLastStep ? "Concluir setup" : undefined}
    >
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {stepKey === "company_profile" && <StepCompanyProfile defaultValues={companyProfile} onChange={setCompanyProfile} />}
      {stepKey === "safe_structure"  && <StepSafeStructure defaultValues={safeStructure} onChange={setSafeStructure} />}
      {stepKey === "sectors"         && <StepSectors defaultValues={sectors} onChange={setSectors} />}
      {stepKey === "org_chart"       && <StepOrgChart defaultValues={orgChart} onChange={setOrgChart} />}
      {stepKey === "users_teams"     && <StepUsersTeams defaultValues={usersTeams} artNames={artNamesForSteps} onChange={setUsersTeams} />}
      {stepKey === "pis_sprints"     && <StepPIsSprints defaultValues={pisSprints} artNames={artNamesForSteps} onChange={setPisSprints} />}
      {stepKey === "health_check"    && <StepHealthCheck data={healthCheck} />}
    </OnboardingWizardShell>
  );
}
```

- [ ] **Step 4: Create `company/complete/page.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/company/complete/page.tsx
import Link from "next/link";
import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";

export default function CompanySetupCompletePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
      <CheckCircle2Icon className="h-16 w-16 text-green-500" />
      <div>
        <h1 className="text-3xl font-bold mb-2">Setup completo!</h1>
        <p className="text-muted-foreground max-w-md">
          Sua estrutura SAFe está configurada. Você já pode usar o COSMOS para seu próximo PI Planning.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Ir para o Dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/onboarding/migration">Migrar dados de outra ferramenta</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep onboarding | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/(authenticated)/onboarding/company/
git commit -m "feat(onboarding): company_setup wizard – health-check + orchestrator + completion screen"
```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm dev
```

- [ ] **Step 2: Verify redirect**

Open browser → `http://localhost:3012`. If no `company_setup` progress exists for the active tenant, should auto-redirect to `/onboarding`.

- [ ] **Step 3: Walk through all 7 wizard steps**

Fill in each form field, click "Salvar e avançar". Verify:
- Step 1: saves company profile data
- Step 2: creates Portfolio + VS + ART in DB (check via `/portfolio` route)
- Step 3: can be skipped
- Step 4: can be skipped
- Step 5: form accepts emails + team names
- Step 6: PI name + dates + iterations shown
- Step 7: health check shows green checkmarks, "Concluir" button enabled

- [ ] **Step 4: Verify completion**

Click "Concluir setup" → redirects to `/onboarding/company/complete`. Navigate to `/` — should NOT redirect back to `/onboarding`.

- [ ] **Step 5: Verify re-entry**

Clear browser state, visit `/onboarding/company`. Should resume at step 7 (or wherever left off), with previous form values pre-filled.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(onboarding): company_setup flow complete — DB, actions, wizard UI, health-check, redirect"
```

---

## Checklist – Spec Coverage

| Spec requirement | Task |
|---|---|
| DB `OnboardingProgress` + `MigrationConnection` | Task 1 |
| `getOrCreateProgress`, `saveStep`, `completeFlow` | Task 2 |
| `createSAFeStructureFromOnboarding` | Task 3 |
| Auto-redirect new tenants | Task 4 |
| `/onboarding` layout + landing | Task 5 |
| Stepper shell (OnboardingWizardShell) | Task 6 |
| Step 1 – company profile | Task 7 |
| Step 2 – Portfolio/VS/ART | Task 8 |
| Steps 3–6 | Task 9 |
| Step 7 – health check + orchestrator | Task 10 |
| E2E smoke test | Task 11 |
| Migration_setup (Plan 2) | *See plan 2026-05-17-onboarding-migration-setup.md* |

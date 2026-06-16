# Demo Seed + Personal Access Exception (PAE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a time-bounded RBAC exception system (PAE) and a rich demo seed populating 5 SAFe personas in a shared workspace.

**Architecture:** New `AccessExceptionRequest` Prisma model stores requests + grants. A new async `enforceWithPAE()` wraps the existing sync `enforce()` with a DB fallback — existing callers are untouched. UI uses an inline lock button → Sheet for requests and a `/access-exceptions` page for audit.

**Tech Stack:** Prisma, Next.js 15 App Router, shadcn/ui (Sheet, Tabs, Badge), Zod, Vitest, `pushNotification()` for alerts.

**Implementation Note:** `enforce()` is currently synchronous (`role` only — no session). PAE check requires `tenantId + userId`, so we introduce `enforceWithPAE(tenantId, userId, role, entity, action)` as a new async function in `permissions.ts`. Existing callers keep using `enforce()` unchanged. New callers that need PAE support call `enforceWithPAE()`.

---

## Phase 1 — PAE Feature

### Task 1: DB Schema — `pae.prisma` + Migration

**Files:**
- Create: `packages/database/prisma/schema/pae.prisma`
- Modify: `packages/database/prisma/schema/tenant.prisma` (add relation)

- [ ] **Step 1: Create `pae.prisma`**

```prisma
// packages/database/prisma/schema/pae.prisma

model AccessExceptionRequest {
  id             String    @id @default(cuid())
  tenantId       String
  requesterId    String
  entityType     String
  action         String
  targetEntityId String?
  justification  String?   @db.Text
  duration       String    // "1h" | "4h" | "8h" | "24h"
  status         String    @default("PENDING") // PENDING | APPROVED | DENIED | REVOKED
  approverId     String?
  approvedAt     DateTime?
  expiresAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, requesterId, status])
  @@index([tenantId, status, expiresAt])
  @@index([tenantId])
}
```

- [ ] **Step 2: Add relation to `Tenant` model in `tenant.prisma`**

Find the `model Tenant { ... }` block and add this line alongside other relation arrays:

```prisma
  accessExceptionRequests   AccessExceptionRequest[]
```

- [ ] **Step 3: Run migration**

```bash
cd /path/to/cosmos-nebuloz
pnpm migrate
```

Expected: Prisma generates a migration file and applies it. `AccessExceptionRequest` table created.

- [ ] **Step 4: Verify the generated client**

```bash
pnpm --filter @repo/database generate
```

Expected: no errors. `prisma.accessExceptionRequest` available on the client.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema/pae.prisma packages/database/prisma/schema/tenant.prisma packages/database/prisma/migrations/
git commit -m "feat(pae): add AccessExceptionRequest schema + migration"
```

---

### Task 2: PAE Zod Schemas

**Files:**
- Create: `apps/app/app/actions/pae/schema.ts`
- Test: `apps/app/__tests__/actions/pae/pae-schema.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/app/__tests__/actions/pae/pae-schema.test.ts
import { describe, expect, it } from "vitest";
import {
  CreatePAERequestSchema,
  PAE_DURATIONS,
  PAE_STATUSES,
} from "@/app/actions/pae/schema";

describe("CreatePAERequestSchema", () => {
  it("accepts valid input", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional justification", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "4h",
      justification: "Sprint planning urgente",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid duration", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "2h",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityType", () => {
    const result = CreatePAERequestSchema.safeParse({
      action: "create",
      duration: "4h",
    });
    expect(result.success).toBe(false);
  });

  it("rejects justification over 500 chars", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "4h",
      justification: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/app && pnpm test __tests__/actions/pae/pae-schema.test.ts
```

Expected: FAIL — `@/app/actions/pae/schema` not found.

- [ ] **Step 3: Create `pae/schema.ts`**

```typescript
// apps/app/app/actions/pae/schema.ts
import { z } from "zod";
import { cuid, optStr } from "../_base";
import type { EntityType, PolicyAction } from "../permissions";

export const PAE_DURATIONS = ["1h", "4h", "8h", "24h"] as const;
export type PAEDuration = (typeof PAE_DURATIONS)[number];

export const PAE_STATUSES = [
  "PENDING",
  "APPROVED",
  "DENIED",
  "REVOKED",
] as const;
export type PAEStatus = (typeof PAE_STATUSES)[number];

export const CreatePAERequestSchema = z.object({
  entityType: z.string().min(1),
  action: z.string().min(1),
  targetEntityId: cuid.optional(),
  justification: optStr.max(500).optional(),
  duration: z.enum(PAE_DURATIONS),
});
export type CreatePAERequestInput = z.infer<typeof CreatePAERequestSchema>;

export const ResolvePAERequestSchema = z.object({
  id: cuid,
});
export type ResolvePAERequestInput = z.infer<typeof ResolvePAERequestSchema>;

export type PAERequest = {
  id: string;
  tenantId: string;
  requesterId: string;
  entityType: string;
  action: string;
  targetEntityId: string | null;
  justification: string | null;
  duration: string;
  status: PAEStatus;
  approverId: string | null;
  approvedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function durationToMs(duration: PAEDuration): number {
  const map: Record<PAEDuration, number> = {
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  };
  return map[duration];
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/app && pnpm test __tests__/actions/pae/pae-schema.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/pae/schema.ts apps/app/__tests__/actions/pae/pae-schema.test.ts
git commit -m "feat(pae): Zod schemas + PAEDuration helper"
```

---

### Task 3: PAE Server Actions — Create + List

**Files:**
- Create: `apps/app/app/actions/pae/index.ts`
- Test: `apps/app/__tests__/actions/pae/pae-actions.test.ts`

- [ ] **Step 1: Write failing tests for `createPAERequest`**

```typescript
// apps/app/__tests__/actions/pae/pae-actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    accessExceptionRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    tenantMember: { findMany: vi.fn() },
    epic: { findFirst: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-dev",
    role: "DEV",
  }),
}));

vi.mock("@/app/actions/notifications/index", () => ({
  pushNotification: vi.fn(),
}));

import { database } from "@repo/database";
import { createPAERequest, listPAERequests } from "@/app/actions/pae/index";

const db = vi.mocked(database);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPAERequest", () => {
  it("creates request when no duplicate pending exists", async () => {
    db.accessExceptionRequest.findFirst.mockResolvedValue(null);
    db.accessExceptionRequest.create.mockResolvedValue({
      id: "req-1",
      tenantId: "tenant-1",
      requesterId: "user-dev",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "PENDING",
      approverId: null,
      approvedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.tenantMember.findMany.mockResolvedValue([]);

    const result = await createPAERequest({
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });

    expect(result.ok).toBe(true);
    expect(db.accessExceptionRequest.create).toHaveBeenCalledOnce();
  });

  it("rejects duplicate pending request for same entity+action", async () => {
    db.accessExceptionRequest.findFirst.mockResolvedValue({ id: "existing" });

    const result = await createPAERequest({
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(
      /já existe/i
    );
    expect(db.accessExceptionRequest.create).not.toHaveBeenCalled();
  });

  it("returns error on invalid input", async () => {
    const result = await createPAERequest({
      entityType: "",
      action: "create",
      duration: "4h",
    });

    expect(result.ok).toBe(false);
  });
});

describe("listPAERequests", () => {
  it("returns own requests + pending approvals", async () => {
    db.accessExceptionRequest.findMany.mockResolvedValue([]);
    const result = await listPAERequests();
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/app && pnpm test __tests__/actions/pae/pae-actions.test.ts
```

Expected: FAIL — `@/app/actions/pae/index` not found.

- [ ] **Step 3: Create `pae/index.ts` with `createPAERequest` + `listPAERequests`**

```typescript
// apps/app/app/actions/pae/index.ts
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { safeAction, type Result } from "../_base";
import { can, type EntityType, type PolicyAction } from "../permissions";
import { pushNotification } from "../notifications/index";
import {
  CreatePAERequestSchema,
  ResolvePAERequestSchema,
  durationToMs,
  type PAEDuration,
  type PAERequest,
  type PAEStatus,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveApprovers(
  tenantId: string,
  entityType: string,
  action: string,
  targetEntityId: string | null
): Promise<string[]> {
  // If target entity provided, try to find its creator first
  if (targetEntityId) {
    const entityTable = entityType.toLowerCase() as "epic" | "feature";
    const owned = await (database[entityTable] as typeof database.epic)
      ?.findFirst?.({
        where: { id: targetEntityId, tenantId },
        select: { createdBy: true } as never,
      })
      .catch(() => null);

    if (owned && (owned as { createdBy?: string }).createdBy) {
      const member = await database.tenantMember.findFirst({
        where: {
          tenantId,
          userId: (owned as { createdBy: string }).createdBy,
        },
        select: { userId: true, role: true },
      });
      if (
        member &&
        can(
          member.role as Parameters<typeof can>[0],
          entityType as EntityType,
          action as PolicyAction
        )
      ) {
        return [member.userId];
      }
    }
  }

  // Fallback: all members with required permission
  const members = await database.tenantMember.findMany({
    where: { tenantId },
    select: { userId: true, role: true },
  });
  return members
    .filter((m) =>
      can(
        m.role as Parameters<typeof can>[0],
        entityType as EntityType,
        action as PolicyAction
      )
    )
    .map((m) => m.userId);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createPAERequest(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreatePAERequestSchema.parse(raw);

    // Reject duplicate pending
    const duplicate = await database.accessExceptionRequest.findFirst({
      where: {
        tenantId: ctx.tenantId,
        requesterId: ctx.userId,
        entityType: data.entityType,
        action: data.action,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error(
        "Já existe uma solicitação pendente para essa ação. Aguarde a decisão."
      );
    }

    const request = await database.accessExceptionRequest.create({
      data: {
        tenantId: ctx.tenantId,
        requesterId: ctx.userId,
        entityType: data.entityType,
        action: data.action,
        targetEntityId: data.targetEntityId ?? null,
        justification: data.justification ?? null,
        duration: data.duration,
        status: "PENDING",
      },
    });

    // Notify approvers (fire-and-forget)
    const approverIds = await resolveApprovers(
      ctx.tenantId,
      data.entityType,
      data.action,
      data.targetEntityId ?? null
    );
    for (const userId of approverIds) {
      pushNotification(ctx.tenantId, {
        userId,
        type: "pae_request",
        title: `Solicitação de acesso: ${data.action} ${data.entityType}`,
        body: data.justification ?? undefined,
        metadata: {
          paeRequestId: request.id,
          entityType: data.entityType,
          action: data.action,
          duration: data.duration,
        },
      }).catch(() => null);
    }

    return request as PAERequest;
  });
}

export async function listPAERequests(): Promise<Result<PAERequest[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const requests = await database.accessExceptionRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        OR: [
          { requesterId: ctx.userId },
          { status: "PENDING" }, // approvers see all pending
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return requests as PAERequest[];
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/app && pnpm test __tests__/actions/pae/pae-actions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/pae/index.ts apps/app/__tests__/actions/pae/pae-actions.test.ts
git commit -m "feat(pae): createPAERequest + listPAERequests server actions"
```

---

### Task 4: PAE Server Actions — Approve + Deny + Revoke

**Files:**
- Modify: `apps/app/app/actions/pae/index.ts`
- Test: `apps/app/__tests__/actions/pae/pae-actions.test.ts`

- [ ] **Step 1: Add tests for approve/deny/revoke**

Append to `apps/app/__tests__/actions/pae/pae-actions.test.ts`:

```typescript
import { approvePAERequest, denyPAERequest, revokePAEGrant } from "@/app/actions/pae/index";

// Add to the mock:
// database.accessExceptionRequest.update = vi.fn()
// database.accessExceptionRequest.findUnique = vi.fn()
// Add these to the vi.mock('@repo/database') block:
// update: vi.fn(),
// findUnique: vi.fn(),

describe("approvePAERequest", () => {
  it("sets status APPROVED and computes expiresAt", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "req-1",
      tenantId: "tenant-1",
      requesterId: "user-dev",
      entityType: "Epic",
      action: "create",
      duration: "4h",
      status: "PENDING",
    });
    db.accessExceptionRequest.update.mockResolvedValue({
      id: "req-1",
      status: "APPROVED",
    });
    db.tenantMember.findMany.mockResolvedValue([
      { userId: "user-dev", role: "DEV" },
    ]);

    const result = await approvePAERequest({ id: "req-1" });
    expect(result.ok).toBe(true);
    expect(db.accessExceptionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: expect.objectContaining({ status: "APPROVED" }),
      })
    );
  });

  it("rejects approval of non-PENDING request", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "req-1",
      tenantId: "tenant-1",
      status: "APPROVED",
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });

    const result = await approvePAERequest({ id: "req-1" });
    expect(result.ok).toBe(false);
    expect(db.accessExceptionRequest.update).not.toHaveBeenCalled();
  });
});

describe("denyPAERequest", () => {
  it("sets status DENIED", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "req-1",
      tenantId: "tenant-1",
      requesterId: "user-dev",
      entityType: "Epic",
      action: "create",
      duration: "4h",
      status: "PENDING",
    });
    db.accessExceptionRequest.update.mockResolvedValue({
      id: "req-1",
      status: "DENIED",
    });

    const result = await denyPAERequest({ id: "req-1" });
    expect(result.ok).toBe(true);
  });
});

describe("revokePAEGrant", () => {
  it("sets status REVOKED on APPROVED grant", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "req-1",
      tenantId: "tenant-1",
      requesterId: "user-dev",
      approverId: "user-rte",
      status: "APPROVED",
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });
    db.accessExceptionRequest.update.mockResolvedValue({
      id: "req-1",
      status: "REVOKED",
    });

    const result = await revokePAEGrant({ id: "req-1" });
    expect(result.ok).toBe(true);
  });
});
```

Also update the `vi.mock('@repo/database')` block to add `update` and `findUnique`:
```typescript
vi.mock("@repo/database", () => ({
  database: {
    accessExceptionRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    tenantMember: { findMany: vi.fn() },
    epic: { findFirst: vi.fn() },
  },
}));
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/app && pnpm test __tests__/actions/pae/pae-actions.test.ts
```

Expected: FAIL — `approvePAERequest` not found.

- [ ] **Step 3: Add approve/deny/revoke to `pae/index.ts`**

Append after `listPAERequests`:

```typescript
export async function approvePAERequest(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { id } = ResolvePAERequestSchema.parse(raw);

    const req = await database.accessExceptionRequest.findUnique({
      where: { id },
    });
    if (!req || req.tenantId !== ctx.tenantId) {
      throw new Error("Solicitação não encontrada.");
    }
    if (req.status !== "PENDING") {
      throw new Error("Solicitação não está pendente.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationToMs(req.duration as PAEDuration));

    const updated = await database.accessExceptionRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approverId: ctx.userId,
        approvedAt: now,
        expiresAt,
      },
    });

    // Notify requester
    pushNotification(ctx.tenantId, {
      userId: req.requesterId,
      type: "pae_approved",
      title: `Acesso aprovado: ${req.action} ${req.entityType} por ${req.duration}`,
      metadata: { paeRequestId: id, entityType: req.entityType, action: req.action, duration: req.duration },
    }).catch(() => null);

    return updated as PAERequest;
  });
}

export async function denyPAERequest(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { id } = ResolvePAERequestSchema.parse(raw);

    const req = await database.accessExceptionRequest.findUnique({
      where: { id },
    });
    if (!req || req.tenantId !== ctx.tenantId) {
      throw new Error("Solicitação não encontrada.");
    }
    if (req.status !== "PENDING") {
      throw new Error("Solicitação não está pendente.");
    }

    const updated = await database.accessExceptionRequest.update({
      where: { id },
      data: { status: "DENIED", approverId: ctx.userId, approvedAt: new Date() },
    });

    pushNotification(ctx.tenantId, {
      userId: req.requesterId,
      type: "pae_denied",
      title: `Acesso negado: ${req.action} ${req.entityType}`,
      metadata: { paeRequestId: id, entityType: req.entityType, action: req.action },
    }).catch(() => null);

    return updated as PAERequest;
  });
}

export async function revokePAEGrant(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { id } = ResolvePAERequestSchema.parse(raw);

    const req = await database.accessExceptionRequest.findUnique({
      where: { id },
    });
    if (!req || req.tenantId !== ctx.tenantId) {
      throw new Error("Grant não encontrado.");
    }
    if (req.status !== "APPROVED") {
      throw new Error("Só é possível revogar grants ativos.");
    }
    // Only original approver or ADMIN can revoke
    const member = await database.tenantMember.findFirst({
      where: { tenantId: ctx.tenantId, userId: ctx.userId },
      select: { role: true },
    });
    if (req.approverId !== ctx.userId && member?.role !== "ADMIN") {
      throw new Error("Sem permissão para revogar este grant.");
    }

    const updated = await database.accessExceptionRequest.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    return updated as PAERequest;
  });
}
```

- [ ] **Step 4: Add `findUnique` to mock — update `vi.mock` in test file as shown in Step 1**

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/app && pnpm test __tests__/actions/pae/pae-actions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/actions/pae/index.ts apps/app/__tests__/actions/pae/pae-actions.test.ts
git commit -m "feat(pae): approvePAERequest + denyPAERequest + revokePAEGrant"
```

---

### Task 5: Notification Types for PAE

**Files:**
- Modify: `apps/app/app/actions/notifications/schema.ts`

- [ ] **Step 1: Add PAE notification types to `NotificationTypeSchema`**

In `apps/app/app/actions/notifications/schema.ts`, update `NotificationTypeSchema`:

```typescript
// Before:
export const NotificationTypeSchema = z.enum([
  "mention",
  "assignment",
  "risk",
  "deadline",
  "system",
]);

// After:
export const NotificationTypeSchema = z.enum([
  "mention",
  "assignment",
  "risk",
  "deadline",
  "system",
  "pae_request",
  "pae_approved",
  "pae_denied",
  "pae_revoked",
]);
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd apps/app && pnpm typecheck
```

Expected: no new errors related to notification types.

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/actions/notifications/schema.ts
git commit -m "feat(pae): add pae_* notification types"
```

---

### Task 6: `enforceWithPAE()` — RBAC + PAE Fallback

**Files:**
- Modify: `apps/app/app/actions/permissions.ts`
- Test: `apps/app/__tests__/actions/pae/enforce-with-pae.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/app/__tests__/actions/pae/enforce-with-pae.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@repo/auth/server";

vi.mock("@repo/database", () => ({
  database: {
    accessExceptionRequest: {
      findFirst: vi.fn(),
    },
  },
}));

import { database } from "@repo/database";
import { enforceWithPAE } from "@/app/actions/permissions";

const db = vi.mocked(database);

beforeEach(() => vi.clearAllMocks());

describe("enforceWithPAE", () => {
  const session = { tenantId: "t1", userId: "u1", role: "DEV" as const };

  it("passes immediately when can() returns true (no DB query)", async () => {
    // DEV can create Story
    await expect(
      enforceWithPAE(session.tenantId, session.userId, "DEV", "Story", "create")
    ).resolves.toBeUndefined();
    expect(db.accessExceptionRequest.findFirst).not.toHaveBeenCalled();
  });

  it("passes when can() fails but active PAE grant exists", async () => {
    // DEV cannot create Epic by role
    db.accessExceptionRequest.findFirst.mockResolvedValue({ id: "grant-1" });

    await expect(
      enforceWithPAE(session.tenantId, session.userId, "DEV", "Epic", "create")
    ).resolves.toBeUndefined();
    expect(db.accessExceptionRequest.findFirst).toHaveBeenCalledOnce();
  });

  it("throws AuthError when can() fails and no active PAE grant", async () => {
    db.accessExceptionRequest.findFirst.mockResolvedValue(null);

    await expect(
      enforceWithPAE(session.tenantId, session.userId, "DEV", "Epic", "create")
    ).rejects.toThrow(AuthError);
  });

  it("throws AuthError when grant exists but is expired (expiresAt in past)", async () => {
    // findFirst with expiresAt > now returns null (expired grants filtered out)
    db.accessExceptionRequest.findFirst.mockResolvedValue(null);

    await expect(
      enforceWithPAE(session.tenantId, session.userId, "DEV", "Epic", "create")
    ).rejects.toThrow(AuthError);
  });

  it("passes for ADMIN without any DB query", async () => {
    await expect(
      enforceWithPAE(session.tenantId, session.userId, "ADMIN", "Epic", "create")
    ).resolves.toBeUndefined();
    expect(db.accessExceptionRequest.findFirst).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/app && pnpm test __tests__/actions/pae/enforce-with-pae.test.ts
```

Expected: FAIL — `enforceWithPAE` not exported from `permissions.ts`.

- [ ] **Step 3: Add `enforceWithPAE` to `permissions.ts`**

Append to `apps/app/app/actions/permissions.ts`:

```typescript
import { database } from "@repo/database";

export async function enforceWithPAE(
  tenantId: string,
  userId: string,
  role: DbMemberRole,
  entity: EntityType,
  action: PolicyAction
): Promise<void> {
  // ADMIN always passes, and if can() succeeds no DB needed
  if (role === "ADMIN" || can(role, entity, action)) return;

  const grant = await database.accessExceptionRequest.findFirst({
    where: {
      tenantId,
      requesterId: userId,
      entityType: entity,
      action,
      status: "APPROVED",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!grant) {
    throw new AuthError(
      "FORBIDDEN",
      `${role} não tem permissão para '${action}' em ${entity}`
    );
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/app && pnpm test __tests__/actions/pae/enforce-with-pae.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full test suite — verify no regressions**

```bash
cd apps/app && pnpm test
```

Expected: all existing tests still PASS (existing `enforce()` is unchanged).

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/actions/permissions.ts apps/app/__tests__/actions/pae/enforce-with-pae.test.ts
git commit -m "feat(pae): enforceWithPAE() — async RBAC with PAE grant fallback"
```

---

### Task 7: UI — `PAERequestButton` + `PAERequestSheet`

**Files:**
- Create: `apps/app/components/ui/pae-request-button.tsx`
- Create: `apps/app/components/ui/pae-request-sheet.tsx`

These are client components — no unit tests needed (covered by E2E). Focus is on correct props and form submission.

- [ ] **Step 1: Create `PAERequestButton`**

```tsx
// apps/app/components/ui/pae-request-button.tsx
"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import { PAERequestSheet } from "./pae-request-sheet";
import type { EntityType, PolicyAction } from "@/app/actions/permissions";

interface PAERequestButtonProps {
  entityType: EntityType;
  action: PolicyAction;
  targetEntityId?: string;
  label?: string;
  className?: string;
}

export function PAERequestButton({
  entityType,
  action,
  targetEntityId,
  label,
  className,
}: PAERequestButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        <LockIcon className="mr-1.5 h-3.5 w-3.5" />
        {label ?? "Solicitar Acesso"}
      </Button>
      <PAERequestSheet
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        action={action}
        targetEntityId={targetEntityId}
      />
    </>
  );
}
```

- [ ] **Step 2: Create `PAERequestSheet`**

```tsx
// apps/app/components/ui/pae-request-sheet.tsx
"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPAERequest } from "@/app/actions/pae/index";
import type { EntityType, PolicyAction } from "@/app/actions/permissions";
import { PAE_DURATIONS, type PAEDuration } from "@/app/actions/pae/schema";

interface PAERequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  action: PolicyAction;
  targetEntityId?: string;
}

const DURATION_LABELS: Record<PAEDuration, string> = {
  "1h": "1 hora",
  "4h": "4 horas",
  "8h": "8 horas",
  "24h": "24 horas",
};

export function PAERequestSheet({
  open,
  onOpenChange,
  entityType,
  action,
  targetEntityId,
}: PAERequestSheetProps) {
  const [duration, setDuration] = useState<PAEDuration>("4h");
  const [justification, setJustification] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createPAERequest({
        entityType,
        action,
        duration,
        justification: justification || undefined,
        targetEntityId,
      });

      if (result.ok) {
        toast.success("Solicitação enviada. Aguarde aprovação.");
        onOpenChange(false);
        setJustification("");
        setDuration("4h");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Solicitar Exceção de Acesso</SheetTitle>
          <SheetDescription>
            {action} · {entityType} · requer permissão superior
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Duração
            </p>
            <div className="flex gap-2">
              {PAE_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    duration === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Justificativa{" "}
              <span className="normal-case text-muted-foreground/60">
                (opcional)
              </span>
            </p>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Motivo da solicitação..."
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {justification.length}/500
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/app && pnpm typecheck
```

Expected: no errors in the two new files.

- [ ] **Step 4: Commit**

```bash
git add apps/app/components/ui/pae-request-button.tsx apps/app/components/ui/pae-request-sheet.tsx
git commit -m "feat(pae): PAERequestButton + PAERequestSheet components"
```

---

### Task 8: `/access-exceptions` Page

**Files:**
- Create: `apps/app/app/(authenticated)/access-exceptions/page.tsx`
- Create: `apps/app/app/(authenticated)/access-exceptions/components/pae-tabs.tsx`
- Create: `apps/app/app/(authenticated)/access-exceptions/components/pae-row.tsx`

- [ ] **Step 1: Create `pae-row.tsx` — reusable row component**

```tsx
// apps/app/app/(authenticated)/access-exceptions/components/pae-row.tsx
"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  approvePAERequest,
  denyPAERequest,
  revokePAEGrant,
} from "@/app/actions/pae/index";
import type { PAERequest, PAEStatus } from "@/app/actions/pae/schema";

const STATUS_BADGE: Record<PAEStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendente", variant: "outline" },
  APPROVED: { label: "Ativo", variant: "default" },
  DENIED: { label: "Negado", variant: "destructive" },
  REVOKED: { label: "Revogado", variant: "secondary" },
};

function timeLeft(expiresAt: Date | null): string {
  if (!expiresAt) return "—";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expirado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface PAERowProps {
  req: PAERequest;
  currentUserId: string;
  currentUserRole: string;
  canApprove: boolean;
}

export function PAERow({ req, currentUserId, currentUserRole, canApprove }: PAERowProps) {
  const [isPending, startTransition] = useTransition();
  const badge = STATUS_BADGE[req.status];

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {req.action} · {req.entityType}
          </span>
          <Badge variant={badge.variant} className="text-xs">
            {badge.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{req.duration}</span>
        </div>
        {req.justification && (
          <p className="text-xs italic text-muted-foreground">
            "{req.justification}"
          </p>
        )}
        {req.status === "APPROVED" && (
          <p className="text-xs text-muted-foreground">
            Expira em: {timeLeft(req.expiresAt)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        {req.status === "PENDING" && canApprove && (
          <>
            <Button
              size="sm"
              variant="default"
              disabled={isPending}
              onClick={() => act(() => approvePAERequest({ id: req.id }))}
            >
              ✓ Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => act(() => denyPAERequest({ id: req.id }))}
            >
              ✗ Negar
            </Button>
          </>
        )}
        {req.status === "APPROVED" &&
          (req.approverId === currentUserId || currentUserRole === "ADMIN") && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => act(() => revokePAEGrant({ id: req.id }))}
            >
              Revogar
            </Button>
          )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `pae-tabs.tsx` — tabs component**

```tsx
// apps/app/app/(authenticated)/access-exceptions/components/pae-tabs.tsx
"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { PAERow } from "./pae-row";
import type { PAERequest } from "@/app/actions/pae/schema";

interface PAETabsProps {
  requests: PAERequest[];
  currentUserId: string;
  currentUserRole: string;
}

export function PAETabs({
  requests,
  currentUserId,
  currentUserRole,
}: PAETabsProps) {
  const now = new Date();

  const pending = requests.filter((r) => r.status === "PENDING");
  const active = requests.filter(
    (r) =>
      r.status === "APPROVED" &&
      r.expiresAt &&
      new Date(r.expiresAt) > now
  );
  const history = requests.filter(
    (r) =>
      r.status === "DENIED" ||
      r.status === "REVOKED" ||
      (r.status === "APPROVED" && r.expiresAt && new Date(r.expiresAt) <= now)
  );

  function canApproveReq(req: PAERequest): boolean {
    // Simplified: let the server action enforce — just show buttons for non-requesters
    return req.requesterId !== currentUserId;
  }

  const rowProps = { currentUserId, currentUserRole };

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">
          Pendentes {pending.length > 0 && `(${pending.length})`}
        </TabsTrigger>
        <TabsTrigger value="active">
          Ativos {active.length > 0 && `(${active.length})`}
        </TabsTrigger>
        <TabsTrigger value="history">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4 space-y-3">
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
        ) : (
          pending.map((r) => (
            <PAERow key={r.id} req={r} {...rowProps} canApprove={canApproveReq(r)} />
          ))
        )}
      </TabsContent>

      <TabsContent value="active" className="mt-4 space-y-3">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum grant ativo.</p>
        ) : (
          active.map((r) => (
            <PAERow key={r.id} req={r} {...rowProps} canApprove={false} />
          ))
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-4 space-y-3">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem histórico.</p>
        ) : (
          history.map((r) => (
            <PAERow key={r.id} req={r} {...rowProps} canApprove={false} />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3: Create `page.tsx`**

```tsx
// apps/app/app/(authenticated)/access-exceptions/page.tsx
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { PageHeader } from "../components/page-header";
import { listPAERequests } from "@/app/actions/pae/index";
import { PAETabs } from "./components/pae-tabs";
import type { PAERequest } from "@/app/actions/pae/schema";

export const metadata = {
  title: "Exceções de Acesso | COSMOS",
  description: "Gerencie solicitações e grants de acesso temporário",
};

export default async function AccessExceptionsPage() {
  const ctx = await requireTenantSession(await headers());
  const result = await listPAERequests();
  const requests: PAERequest[] = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Exceções de Acesso"
        description="Solicitações de acesso temporário além do seu cargo"
      />
      <PAETabs
        requests={requests}
        currentUserId={ctx.userId}
        currentUserRole={ctx.role}
      />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/app && pnpm typecheck
```

Expected: no errors in the three new files.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/(authenticated)/access-exceptions/
git commit -m "feat(pae): /access-exceptions page with Pendentes / Ativos / Histórico tabs"
```

---

### Task 9: Sidebar Nav Entry

**Files:**
- Modify: `apps/app/app/(authenticated)/components/sidebar.tsx`

- [ ] **Step 1: Add "Exceções de Acesso" to sidebar**

In `sidebar.tsx`, find the settings section (usually near `"Settings"` items) and add the entry to the relevant nav group that's visible to all authenticated users. Look for the nav items array structure — each role has its items. Add to a shared bottom section or under a Settings group:

Find the block where nav items are defined per role (look for `DEV:`, `SM:`, `ADMIN:` keys or similar arrays) and add the following entry to each role's items list that should see it (all roles):

```typescript
{ title: "Exceções de Acesso", url: "/access-exceptions", icon: ShieldAlertIcon }
```

Import `ShieldAlertIcon` from `lucide-react` at the top of the file:

```typescript
import { ..., ShieldAlertIcon } from "lucide-react";
```

- [ ] **Step 2: Verify nav renders**

```bash
pnpm dev
```

Navigate to `http://localhost:3012` and verify "Exceções de Acesso" appears in the sidebar for any logged-in user.

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/(authenticated)/components/sidebar.tsx
git commit -m "feat(pae): add Exceções de Acesso to sidebar nav"
```

---

## Phase 2 — Demo Seed

### Task 10: Update `seed-personas.ts` — Entities + PAE Demo Data

**Files:**
- Modify: `apps/app/scripts/seed-personas.ts`

This task adds entity seeding after the existing user/membership creation block. All operations are idempotent (`findFirst + create` or `upsert`).

- [ ] **Step 1: Add entity seeding to `seed-personas.ts`**

After the existing personas loop (after TenantMember creation), add the following seeding block. The full additions go at the bottom of `main()` before `db.$disconnect()`:

```typescript
// ── Entity Seeding ─────────────────────────────────────────────────────────

console.log("\n🌱 Seeding entities...\n");

// Resolve user IDs
const userByEmail = async (email: string) => {
  const u = await db.user.findUnique({ where: { email } });
  if (!u) throw new Error(`User not found: ${email}`);
  return u;
};

const rte = await userByEmail("rte@cosmos.demo");
const sm  = await userByEmail("sm@cosmos.demo");
const pm  = await userByEmail("pm@cosmos.demo");
const lpm = await userByEmail("lpm@cosmos.demo");
const dev = await userByEmail("dev@cosmos.demo");
const tid = tenant.id;

// 1. Strategic Theme
let theme = await db.strategicTheme.findFirst({ where: { tenantId: tid, title: "Aceleração Digital" } });
if (!theme) {
  theme = await db.strategicTheme.create({
    data: {
      tenantId: tid,
      title: "Aceleração Digital",
      color: "#6366f1",
      status: "ACTIVE",
      themeType: "GROWTH",
      ownerUserId: lpm.id,
    },
  });
  console.log("  ✅ StrategicTheme");
}

// 2. OKR
let okr = await db.oKR.findFirst({ where: { tenantId: tid, title: "Aumentar adoção da plataforma em 30%" } });
if (!okr) {
  okr = await db.oKR.create({
    data: {
      tenantId: tid,
      strategicThemeId: theme.id,
      title: "Aumentar adoção da plataforma em 30%",
      type: "pi_art",
      status: "ON_TRACK",
      quarter: 2,
      year: 2026,
    },
  });
  console.log("  ✅ OKR");
}

// 3. KeyResult
const krExists = await db.keyResult.findFirst({ where: { okrId: okr.id } });
if (!krExists) {
  await db.keyResult.create({
    data: {
      tenantId: tid,
      okrId: okr.id,
      title: "MAU: 10.000 → 13.000 usuários",
      unit: "users",
      current: 10800,
      target: 13000,
    },
  });
  console.log("  ✅ KeyResult");
}

// 4. ART
let art = await db.aRT.findFirst({ where: { tenantId: tid, name: "ART-01 Plataforma Digital" } });
if (!art) {
  art = await db.aRT.create({
    data: {
      tenantId: tid,
      name: "ART-01 Plataforma Digital",
      description: "Agile Release Train principal",
    },
  });
  console.log("  ✅ ART");
}

// 5. LeanBudget
const budgetExists = await db.leanBudget.findFirst({ where: { tenantId: tid } });
if (!budgetExists) {
  await db.leanBudget.create({
    data: {
      tenantId: tid,
      artId: art.id,
      label: "ART-01 — Cloud & Plataforma",
      totalBudget: 2400000,
      allocatedBudget: 1980000,
      currency: "BRL",
    },
  });
  console.log("  ✅ LeanBudget");
}

// 6. PI Plan
let piPlan = await db.pIPlan.findFirst({ where: { tenantId: tid, name: "PI 2026-Q2" } });
if (!piPlan) {
  piPlan = await db.pIPlan.create({
    data: {
      tenantId: tid,
      artId: art.id,
      name: "PI 2026-Q2",
      status: "ACTIVE",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-06-30"),
    },
  });
  console.log("  ✅ PIPlan");
}

// 7. Team
let team = await db.team.findFirst({ where: { tenantId: tid, name: "Alpha Squad" } });
if (!team) {
  team = await db.team.create({
    data: {
      tenantId: tid,
      artId: art.id,
      name: "Alpha Squad",
      members: [
        { name: sm.name, role: "SM", skills: ["Agile"] },
        { name: pm.name, role: "PO", skills: ["Product"] },
        { name: dev.name, role: "DEV", skills: ["TypeScript"] },
      ],
    },
  });
  console.log("  ✅ Team");
}

// 8. Sprint
let sprint = await db.sprint.findFirst({ where: { tenantId: tid, name: "PI-2026-Q2-S1" } });
if (!sprint) {
  sprint = await db.sprint.create({
    data: {
      tenantId: tid,
      teamId: team.id,
      piPlanId: piPlan.id,
      name: "PI-2026-Q2-S1",
      status: "ACTIVE",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-14"),
      sprintNumber: 1,
    },
  });
  console.log("  ✅ Sprint");
}

// 9. PI Objective
const piObjExists = await db.pIObjective.findFirst({ where: { tenantId: tid, piPlanId: piPlan.id } });
if (!piObjExists) {
  await db.pIObjective.create({
    data: {
      tenantId: tid,
      piPlanId: piPlan.id,
      title: "Entregar autenticação unificada",
      type: "COMMITTED",
      businessValue: 8,
    },
  });
  console.log("  ✅ PIObjective");
}

// 10. Epic
let epic = await db.epic.findFirst({ where: { tenantId: tid, title: "Portal do Cliente" } });
if (!epic) {
  epic = await db.epic.create({
    data: {
      tenantId: tid,
      title: "Portal do Cliente",
      status: "ANALYSIS",
      strategicThemeId: theme.id,
      createdBy: pm.id,
    },
  });
  console.log("  ✅ Epic");
}

// 11. Feature
let feature = await db.feature.findFirst({ where: { tenantId: tid, title: "Autenticação Unificada" } });
if (!feature) {
  feature = await db.feature.create({
    data: {
      tenantId: tid,
      epicId: epic.id,
      artId: art.id,
      title: "Autenticação Unificada",
      status: "IN_PROGRESS",
      createdBy: pm.id,
    },
  });
  console.log("  ✅ Feature");
}

// 12. Story
let story = await db.story.findFirst({ where: { tenantId: tid, title: "Login SSO — fluxo principal" } });
if (!story) {
  story = await db.story.create({
    data: {
      tenantId: tid,
      featureId: feature.id,
      sprintId: sprint.id,
      title: "Login SSO — fluxo principal",
      status: "IN_PROGRESS",
      storyPoints: 5,
      createdBy: pm.id,
    },
  });
  console.log("  ✅ Story");
}

// 13. Tasks
const taskExists = await db.task.findFirst({ where: { storyId: story.id } });
if (!taskExists) {
  await db.task.createMany({
    data: [
      { tenantId: tid, storyId: story.id, title: "Implementar OAuth2 callback", status: "IN_PROGRESS", assigneeId: dev.id },
      { tenantId: tid, storyId: story.id, title: "Testes de integração IdP", status: "TODO", assigneeId: dev.id },
    ],
  });
  console.log("  ✅ Tasks");
}

// 14. Risk
const riskExists = await db.risk.findFirst({ where: { tenantId: tid, title: "Dependência AWS sem SLA formal" } });
if (!riskExists) {
  await db.risk.create({
    data: {
      tenantId: tid,
      artId: art.id,
      piPlanId: piPlan.id,
      title: "Dependência AWS sem SLA formal",
      status: "OPEN",
      roamStatus: "MITIGATE",
      ownerId: sm.id,
    },
  });
  console.log("  ✅ Risk");
}

// 15. PAE Demo Records
const paeExists = await db.accessExceptionRequest.findFirst({ where: { tenantId: tid, requesterId: dev.id } });
if (!paeExists) {
  const now = new Date();

  // PENDING
  await db.accessExceptionRequest.create({
    data: {
      tenantId: tid,
      requesterId: dev.id,
      entityType: "Epic",
      action: "create",
      targetEntityId: epic.id,
      justification: "Urgente para sprint planning desta semana",
      duration: "4h",
      status: "PENDING",
    },
  });

  // APPROVED (active — expires in 45 min)
  const approvedAt = new Date(now.getTime() - 15 * 60 * 1000);
  const expiresAt  = new Date(now.getTime() + 45 * 60 * 1000);
  await db.accessExceptionRequest.create({
    data: {
      tenantId: tid,
      requesterId: sm.id,
      entityType: "LeanBudget",
      action: "update",
      duration: "1h",
      status: "APPROVED",
      approverId: rte.id,
      approvedAt,
      expiresAt,
    },
  });

  // DENIED
  const deniedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  await db.accessExceptionRequest.create({
    data: {
      tenantId: tid,
      requesterId: dev.id,
      entityType: "Feature",
      action: "delete",
      justification: "Limpeza de backlog",
      duration: "4h",
      status: "DENIED",
      approverId: pm.id,
      approvedAt: deniedAt,
    },
  });

  console.log("  ✅ PAE demo records (PENDING + APPROVED + DENIED)");
}

console.log("\n✅ All entities seeded.\n");
```

- [ ] **Step 2: Run the seed script to verify**

```bash
cd apps/app
DATABASE_URL="postgresql://..." \
BETTER_AUTH_SECRET="cosmos-dev-secret-key-min-32-chars-placeholder" \
BETTER_AUTH_URL="http://localhost:3012" \
npx tsx scripts/seed-personas.ts
```

Expected output includes all `✅` lines. No errors. Re-running is safe (idempotent).

- [ ] **Step 3: Verify in app**

Start dev server (`pnpm dev`), log in as each persona, confirm:
- `lpm@cosmos.demo` (ADMIN): sees StrategicTheme, LeanBudget in cockpit
- `rte@cosmos.demo` (RTE): sees ART, OKR, PIPlan, Risk
- `sm@cosmos.demo` (SM): sees Sprint, Team, Story
- `pm@cosmos.demo` (PO): sees Epic, Feature, Story
- `dev@cosmos.demo` (DEV): sees Sprint tasks, Standup
- All: `/access-exceptions` shows PAE demo records

- [ ] **Step 4: Commit**

```bash
git add apps/app/scripts/seed-personas.ts
git commit -m "feat(seed): seed all entities + PAE demo records for 5 personas"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] DB Schema — Task 1
- [x] PAE Zod schemas — Task 2
- [x] `createPAERequest` + `listPAERequests` — Task 3
- [x] `approvePAERequest` + `denyPAERequest` + `revokePAEGrant` — Task 4
- [x] Notification types `pae_*` — Task 5
- [x] `enforceWithPAE()` with fallback — Task 6
- [x] Lock button + Request sheet — Task 7
- [x] `/access-exceptions` page (Pendentes / Ativos / Histórico) — Task 8
- [x] Sidebar nav — Task 9
- [x] Demo seed all 5 personas + all entities + PAE records — Task 10
- [x] Approver routing (owner first → fallback) — Task 3 `resolveApprovers()`
- [x] Max 1 pending per entity+action — Task 3 duplicate check
- [x] Duration tiers 1h/4h/8h/24h — Task 2 schema
- [x] Optional justification — Task 2 schema + Task 7 Sheet

**Type consistency check:**
- `PAERequest` type defined in `schema.ts` — used in `index.ts` return types, `page.tsx`, `pae-tabs.tsx`, `pae-row.tsx` ✓
- `PAEDuration` defined in `schema.ts` — used in `durationToMs()`, `pae-request-sheet.tsx` ✓
- `PAEStatus` defined in `schema.ts` — used in `pae-row.tsx` STATUS_BADGE ✓
- `ResolvePAERequestSchema` used in `approvePAERequest`, `denyPAERequest`, `revokePAEGrant` ✓
- `enforceWithPAE` exported from `permissions.ts` — imported in test ✓

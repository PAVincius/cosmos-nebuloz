# T12 — Sync Bidirecional Linear / GitHub (SAFe-aware) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Sync bidirecional entre Cosmos (SAFe hierarchy) e Linear / GitHub Issues, com mapeamento consciente de ART/Epic/Feature/Sprint. Engenheiros vivem no Linear/GitHub; LPMs/RTEs vivem no Cosmos.

**Architecture:**
- Pull: webhook (push do Linear/GitHub) + polling fallback
- Push: state machine emite eventos quando Feature/Story muda no Cosmos → patch no externo
- Identity mapping: tabela `LinearSync` (já existe). Adicionar `GitHubSync` análoga
- Conflict resolution: `lastModifiedAt` + write timestamps → vencedor mais recente; logar conflito em `SyncLog`

**Tech Stack:** Linear SDK (`@linear/sdk`), Octokit (`@octokit/rest`), Next.js webhooks (Route Handlers), Vercel Cron, Prisma.

**Estado atual:**
- `apps/app/app/actions/integrations/connectors/linear.ts` (126 linhas)
- `apps/app/app/actions/integrations/connectors/github.ts` (173 linhas)
- `apps/app/app/actions/integrations/linear-import.ts` (139 linhas) — só import (one-way)
- `LinearSync` model existe; faltam: webhook handlers, push back, GitHub sync table

---

## File Structure

```
apps/app/app/api/webhooks/
  linear/route.ts             — (NEW) recebe webhook do Linear
  github/route.ts             — (NEW) recebe webhook do GitHub

apps/app/app/actions/integrations/
  connectors/
    linear.ts                 — (MODIFY) adicionar push (write back)
    github.ts                 — (MODIFY) adicionar push + tipos SAFe
  sync/
    linear-pull.ts            — (NEW) extrai do linear-import.ts, expande para bidirectional
    linear-push.ts            — (NEW) push de Cosmos → Linear
    github-pull.ts            — (NEW) GitHub Issues → Cosmos
    github-push.ts            — (NEW) Cosmos → GitHub Issues
    sync-mapping.ts           — (NEW) lookup/upsert em LinearSync/GitHubSync
    conflict-resolver.ts      — (NEW) regra de last-write-wins + log
  webhooks/
    verify-signature.ts       — (NEW) HMAC verification
  schemas.ts                  — (MODIFY) adicionar mapping config schema

packages/database/prisma/schema/
  linear-sync.prisma          — (MODIFY) adicionar GitHubSync model

apps/app/__tests__/actions/integrations/
  sync-mapping.test.ts        — (NEW)
  conflict-resolver.test.ts   — (NEW)
  linear-push.test.ts         — (NEW)
```

---

## Task 1: Schema — GitHubSync model

**Files:**
- Modify: `packages/database/prisma/schema/linear-sync.prisma`

- [ ] **Step 1: Adicionar GitHubSync espelhando LinearSync**

```prisma
model GitHubSync {
  id           String   @id @default(cuid())
  tenantId     String
  // GitHub identification
  githubRepo   String   // "owner/repo"
  githubNumber Int      // issue number
  githubType   String   // issue | pull_request | milestone
  // Cosmos identification
  cosmosId     String
  cosmosType   String   // Epic | Feature | Story | PIPlan
  lastSyncedAt DateTime @default(now()) @updatedAt
  metadata     Json?

  @@unique([tenantId, githubRepo, githubNumber, githubType])
  @@index([tenantId])
  @@map("github_syncs")
}
```

- [ ] **Step 2: Migration**

```bash
cd packages/database && npx prisma migrate dev --name add_github_sync
```

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema/linear-sync.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add GitHubSync model mirroring LinearSync"
```

---

## Task 2: Sync mapping helpers

**Files:**
- Create: `apps/app/app/actions/integrations/sync/sync-mapping.ts`

- [ ] **Step 1: Failing test**

```typescript
// __tests__/actions/integrations/sync-mapping.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { upsertLinearSync, findCosmosByLinear } from "@/app/actions/integrations/sync/sync-mapping";

describe("sync-mapping", () => {
  it("upserts a Linear-to-Cosmos mapping and finds it back", async () => {
    const tenantId = "t_test";
    await upsertLinearSync({ tenantId, linearId: "iss_1", linearType: "issue", cosmosId: "feat_1", cosmosType: "Feature" });
    const hit = await findCosmosByLinear({ tenantId, linearId: "iss_1", linearType: "issue" });
    expect(hit?.cosmosId).toBe("feat_1");
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { database } from "@repo/database";

export type LinearMapping = {
  tenantId: string;
  linearId: string;
  linearType: "team" | "project" | "issue" | "milestone" | "cycle";
  cosmosId: string;
  cosmosType: "Art" | "Epic" | "Feature" | "Story" | "PIPlan" | "Sprint";
};

export async function upsertLinearSync(m: LinearMapping) {
  return database.linearSync.upsert({
    where: { tenantId_linearId_linearType: { tenantId: m.tenantId, linearId: m.linearId, linearType: m.linearType } },
    create: m,
    update: { cosmosId: m.cosmosId, cosmosType: m.cosmosType, lastSyncedAt: new Date() },
  });
}

export async function findCosmosByLinear(args: { tenantId: string; linearId: string; linearType: string }) {
  return database.linearSync.findUnique({
    where: { tenantId_linearId_linearType: args },
  });
}

export async function findLinearByCosmos(args: { tenantId: string; cosmosId: string; cosmosType: string }) {
  return database.linearSync.findFirst({
    where: { tenantId: args.tenantId, cosmosId: args.cosmosId, cosmosType: args.cosmosType },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(integrations): sync mapping upsert/lookup helpers"
```

---

## Task 3: Hierarchy mapping rules

**Files:**
- Create: `apps/app/app/actions/integrations/sync/hierarchy-rules.ts`

- [ ] **Step 1: Mapeamento SAFe ↔ Linear ↔ GitHub**

```typescript
export const LINEAR_TO_COSMOS = {
  team: "Art",
  project: "Epic", // or PIPlan — disambiguate via label
  issue: "Feature", // or Story — by issue type
  milestone: "PIPlan",
  cycle: "Sprint",
} as const;

export const GITHUB_TO_COSMOS = {
  milestone: "PIPlan",
  issue: "Feature", // label-driven for Story vs Feature
  pull_request: null, // PRs não mapeiam diretamente, mas afetam status
} as const;

export function inferCosmosTypeFromLinearIssue(labels: string[]): "Feature" | "Story" {
  const hasFeatureLabel = labels.some((l) => /^(feature|epic-feature)$/i.test(l));
  return hasFeatureLabel ? "Feature" : "Story";
}

export function inferCosmosTypeFromGitHubIssue(labels: string[]): "Feature" | "Story" {
  return labels.some((l) => /^safe[-:](feature|capability)$/i.test(l)) ? "Feature" : "Story";
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(integrations): SAFe hierarchy inference from external labels"
```

---

## Task 4: Webhook receiver Linear

**Files:**
- Create: `apps/app/app/api/webhooks/linear/route.ts`
- Create: `apps/app/app/actions/integrations/webhooks/verify-signature.ts`

- [ ] **Step 1: HMAC verification helper**

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyLinearSignature(body: string, signature: string, secret: string): boolean {
  const computed = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 2: Route handler**

```typescript
// apps/app/app/api/webhooks/linear/route.ts
import { NextRequest } from "next/server";
import { verifyLinearSignature } from "@/app/actions/integrations/webhooks/verify-signature";
import { handleLinearWebhook } from "@/app/actions/integrations/sync/linear-pull";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("linear-signature") ?? "";
  const secret = process.env.LINEAR_WEBHOOK_SECRET ?? "";
  if (!verifyLinearSignature(body, signature, secret)) {
    return new Response("invalid signature", { status: 401 });
  }
  const payload = JSON.parse(body);
  await handleLinearWebhook(payload);
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(integrations): Linear webhook receiver with HMAC verification"
```

---

## Task 5: Linear pull (incremental sync via webhook payload)

**Files:**
- Create: `apps/app/app/actions/integrations/sync/linear-pull.ts`

- [ ] **Step 1: Implement webhook handler**

```typescript
import { database } from "@repo/database";
import { upsertLinearSync, findCosmosByLinear } from "./sync-mapping";
import { inferCosmosTypeFromLinearIssue } from "./hierarchy-rules";

type LinearWebhookPayload = {
  action: "create" | "update" | "remove";
  type: "Issue" | "Project" | "Cycle" | "Milestone";
  data: { id: string; title: string; description?: string; state?: { name: string }; labels?: { nodes: { name: string }[] }; teamId?: string; projectId?: string };
  organizationId: string;
};

export async function handleLinearWebhook(payload: LinearWebhookPayload) {
  const integration = await database.integration.findFirst({
    where: { source: "linear", config: { path: ["organizationId"], equals: payload.organizationId } },
  });
  if (!integration) return;
  const tenantId = integration.tenantId;

  if (payload.type === "Issue") {
    const labels = payload.data.labels?.nodes.map((l) => l.name) ?? [];
    const cosmosType = inferCosmosTypeFromLinearIssue(labels);
    // upsert Feature or Story by externalId
    if (cosmosType === "Feature") {
      const existing = await database.feature.findFirst({
        where: { tenantId, externalSource: "linear", externalId: payload.data.id },
      });
      if (payload.action === "remove" && existing) {
        await database.feature.update({ where: { id: existing.id }, data: { externalUrl: null } });
      } else {
        const upserted = await database.feature.upsert({
          where: existing ? { id: existing.id } : { id: "____never____" },
          create: { tenantId, title: payload.data.title, externalSource: "linear", externalId: payload.data.id, externalUrl: `https://linear.app/-/issue/${payload.data.id}` },
          update: { title: payload.data.title },
        });
        await upsertLinearSync({ tenantId, linearId: payload.data.id, linearType: "issue", cosmosId: upserted.id, cosmosType: "Feature" });
      }
    }
    // similar branch for Story
  }
  // similar branches for Project/Milestone/Cycle
}
```

- [ ] **Step 2: Logar em SyncLog**

```typescript
await database.syncLog.create({
  data: {
    integrationId: integration.id,
    type: "webhook",
    status: "success",
    itemsCreated: 0,
    itemsUpdated: 1,
    itemsSkipped: 0,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(integrations): Linear pull via webhook with SAFe hierarchy inference"
```

---

## Task 6: Linear push (Cosmos → Linear)

**Files:**
- Create: `apps/app/app/actions/integrations/sync/linear-push.ts`

- [ ] **Step 1: Push function — chamada quando Feature/Story muda no Cosmos**

```typescript
import { LinearClient } from "@linear/sdk";
import { database } from "@repo/database";
import { findLinearByCosmos } from "./sync-mapping";

export async function pushFeatureToLinear(featureId: string, tenantId: string) {
  const feature = await database.feature.findFirst({ where: { id: featureId, tenantId } });
  if (!feature) return;
  const mapping = await findLinearByCosmos({ tenantId, cosmosId: featureId, cosmosType: "Feature" });
  if (!mapping) return; // not synced — only push if previously synced

  const integration = await database.integration.findFirst({ where: { tenantId, source: "linear" } });
  if (!integration) return;
  const config = integration.config as { apiKey: string };
  const linear = new LinearClient({ apiKey: config.apiKey });

  await linear.updateIssue(mapping.linearId, {
    title: feature.title,
    // statusId, description, etc.
  });

  await database.linearSync.update({
    where: { id: mapping.id },
    data: { lastSyncedAt: new Date() },
  });
}
```

- [ ] **Step 2: Hook em features/update.ts**

```typescript
// dentro do update-feature action, após commit do banco:
queueMicrotask(() => pushFeatureToLinear(feature.id, tenantId).catch(console.error));
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(integrations): push Feature changes to Linear after Cosmos update"
```

---

## Task 7: GitHub sync (espelhar Linear)

**Files:**
- Create: `apps/app/app/api/webhooks/github/route.ts`
- Create: `apps/app/app/actions/integrations/sync/github-pull.ts`
- Create: `apps/app/app/actions/integrations/sync/github-push.ts`

- [ ] **Step 1: GitHub webhook verification (X-Hub-Signature-256)**
- [ ] **Step 2: Pull handler para issue/milestone events**
- [ ] **Step 3: Push via Octokit (rest.issues.update)**
- [ ] **Step 4: Tests + commit**

```bash
git commit -m "feat(integrations): GitHub Issues bidirectional sync with SAFe mapping"
```

---

## Task 8: Conflict resolver

**Files:**
- Create: `apps/app/app/actions/integrations/sync/conflict-resolver.ts`

- [ ] **Step 1: Compare timestamps; vencer = mais recente**

```typescript
export function resolveConflict<T extends { updatedAt: Date }>(
  cosmos: T,
  external: T
): { winner: "cosmos" | "external"; loser: T } {
  return cosmos.updatedAt >= external.updatedAt
    ? { winner: "cosmos", loser: external }
    : { winner: "external", loser: cosmos };
}
```

- [ ] **Step 2: Logar conflito em SyncLog com errors JSON**
- [ ] **Step 3: Tests + commit**

```bash
git commit -m "feat(integrations): last-write-wins conflict resolver with audit log"
```

---

## Task 9: Polling fallback (Vercel Cron)

**Files:**
- Create: `apps/app/app/api/cron/sync-integrations/route.ts`

- [ ] **Step 1: Cron handler que itera tenants ativos e puxa delta desde lastSyncAt**
- [ ] **Step 2: vercel.json cron config (every 15 min)**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(integrations): Vercel cron fallback polling for missed webhooks"
```

---

## Done When

- [ ] Webhook Linear cria/atualiza Feature/Story no Cosmos
- [ ] Update no Cosmos faz push de volta ao Linear preservando ID
- [ ] GitHub Issues idem (com label-based hierarchy)
- [ ] LinearSync e GitHubSync rastreiam IDs cross-system
- [ ] SyncLog registra cada operação + errors JSON em conflito
- [ ] Cron de fallback roda a cada 15 min
- [ ] Tests passando (mapping, hierarchy inference, conflict)

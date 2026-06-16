# Demo Seed + Personal Access Exception (PAE) — Design Spec

**Date:** 2026-06-16  
**Branch:** feat/kanban-portfolio-ai  
**Status:** Approved — ready for implementation planning

---

## Overview

Two deliverables built in sequence:

1. **PAE Feature** — full production system for requesting, approving, and auditing time-bounded RBAC exceptions (GCP-style policy management)
2. **Demo Seed** — updated `seed-personas.ts` that populates all 5 demo personas in a shared workspace with enough data for every role's cockpit view to have real content, including example PAE records

Seed depends on PAE being implemented first (to seed `AccessExceptionRequest` demo records).

---

## Part 1 — Personal Access Exception (PAE)

### 1.1 Behavior Contract

- A user whose `can(role, entity, action)` returns `false` may request a time-bounded exception.
- Grant scope: `entityType + action` (not a specific entity instance). A granted "create Epic / 4h" allows creating any Epic for 4 hours.
- Duration options: `1h | 4h | 8h | 24h` (fixed tiers, no custom).
- Justification: optional free text.
- Grant is time-bounded, not one-time-use. Multiple creates are allowed within the window.
- First approver wins — once one eligible member approves/denies, the request is closed.
- Revocation: approvers can revoke an active grant from `/access-exceptions`; expiry also terminates automatically.

### 1.2 DB Schema

New model in `packages/database/prisma/schema/pae.prisma` (new file, follows project convention of one domain per prisma file):

```prisma
model AccessExceptionRequest {
  id             String    @id @default(cuid())
  tenantId       String
  requesterId    String                        // userId of requester
  entityType     String                        // EntityType from permissions-policy.ts
  action         String                        // PolicyAction from permissions-policy.ts
  targetEntityId String?                       // optional — used only for approver routing
  justification  String?   @db.Text
  duration       String                        // "1h" | "4h" | "8h" | "24h"
  status         String    @default("PENDING") // PENDING | APPROVED | DENIED | REVOKED
  approverId     String?
  approvedAt     DateTime?
  expiresAt      DateTime?                     // null until approved; set = approvedAt + duration
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, requesterId, status])
  @@index([tenantId, status, expiresAt])    // enforce() lookup index
  @@index([tenantId])
}
```

Migration: `pnpm migrate` after adding the model.

### 1.3 RBAC Integration

File: `apps/app/app/actions/permissions.ts`

`enforce()` gains an optional `targetEntityId` parameter. Signature remains backwards-compatible — all existing callers work without changes.

```typescript
export async function enforce(
  session: { tenantId: string; userId: string; role: MemberRole },
  entity: EntityType,
  action: PolicyAction,
  targetEntityId?: string
): Promise<void> {
  if (session.role === "ADMIN" || can(session.role, entity, action)) return;

  const grant = await database.accessExceptionRequest.findFirst({
    where: {
      tenantId: session.tenantId,
      requesterId: session.userId,
      entityType: entity,
      action,
      status: "APPROVED",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!grant) throw new AuthError("Acesso negado.");
}
```

**Performance:** `can()` is pure in-memory — zero I/O on happy path. DB query only runs on blocked paths. Covered by `@@index([tenantId, status, expiresAt])`.

### 1.4 Approver Routing

When a request is submitted, the system resolves the notified approver(s):

1. If `targetEntityId` is provided → find the `createdBy` / owner of that entity → notify that member if they hold the required permission.
2. Fallback → notify all `TenantMember`s whose role satisfies `can(role, entityType, action) === true`.

Notification uses the existing `pushNotification()` helper with `type: "pae_request"`. The notification card in the bell will show Approve / Deny inline (matches Seção 3 design).

### 1.5 Server Actions

New file: `apps/app/app/actions/pae/index.ts` (`"use server"`)

| Action | Who can call | Description |
|--------|-------------|-------------|
| `createPAERequest(raw)` | Any authenticated member | Validates input, creates PENDING record, routes notification |
| `approvePAERequest(id)` | Members with required permission | Sets APPROVED, sets `expiresAt`, notifies requester |
| `denyPAERequest(id)` | Members with required permission | Sets DENIED, notifies requester |
| `revokePAEGrant(id)` | Original approver or ADMIN | Sets REVOKED |
| `listPAERequests(raw?)` | Any member | Returns requests relevant to caller (own requests + pending approvals) |

Schema file: `apps/app/app/actions/pae/schema.ts` — Zod schemas for all inputs.

### 1.6 UI Components

#### Lock Button (trigger)

`apps/app/components/ui/pae-request-button.tsx` — client component.

Props:
```typescript
interface PAERequestButtonProps {
  entityType: EntityType
  action: PolicyAction
  targetEntityId?: string
  label?: string        // defaults to action label
}
```

Renders `🔒 Solicitar Acesso` button. On click, opens `PAERequestSheet`.

Usage pattern at call sites:
```tsx
// Before (RTE-only button hidden from DEV):
{can(role, "Epic", "create") && <Button>+ New Epic</Button>}

// After (DEV sees lock button):
{can(role, "Epic", "create")
  ? <Button>+ New Epic</Button>
  : <PAERequestButton entityType="Epic" action="create" />}
```

#### Request Sheet

`apps/app/components/ui/pae-request-sheet.tsx` — shadcn `Sheet` (right side).

Fields:
- Duration selector: 4 pill buttons (`1h / 4h / 8h / 24h`)
- Justification textarea (optional, max 500 chars)
- Resolved approver display (read-only, computed server-side)
- Submit button → calls `createPAERequest()`

#### `/access-exceptions` Page

Route: `apps/app/app/(authenticated)/access-exceptions/page.tsx`

Sidebar entry under Settings (visible to all authenticated members).

Three tabs:
- **Pendentes** — requests awaiting this user's approval (approver view) + own pending requests (requester view)
- **Ativos** — approved grants with countdown to expiry; approver can revoke
- **Histórico** — immutable audit trail: all resolved requests (approved/denied/revoked/expired) for this tenant

Columns per row: requester avatar, entity type + action, duration, justification, status badge, approver, time remaining / resolved at, action buttons.

### 1.7 Notification Type

Add `"pae_request" | "pae_approved" | "pae_denied" | "pae_revoked"` to `NotificationTypeSchema` in `apps/app/app/actions/notifications/schema.ts`.

Notification `metadata` shape:
```typescript
{ paeRequestId: string, entityType: string, action: string, duration: string }
```

Notification card in bell renders Approve / Deny buttons for `pae_request` type (approver only).

### 1.8 Testing

- Unit: `can()` unchanged — existing tests pass.
- Unit: `enforce()` with active grant → passes; expired grant → throws; no grant → throws.
- Unit: `createPAERequest()` routing logic — owner found vs fallback.
- Integration: full request → approve → action succeeds cycle.
- E2E: DEV hits lock button → submits → PO approves → DEV performs action.

---

## Part 2 — Demo Seed

### 2.1 Personas & Roles

| Email | Password | MemberRole | SAFe Role |
|-------|----------|-----------|-----------|
| `rte@cosmos.demo` | `Demo@Cosmos2026!` | `RTE` | Release Train Engineer |
| `sm@cosmos.demo` | `Demo@Cosmos2026!` | `SM` | Scrum Master |
| `pm@cosmos.demo` | `Demo@Cosmos2026!` | `PO` | Product Manager (→ PO) |
| `lpm@cosmos.demo` | `Demo@Cosmos2026!` | `ADMIN` | Lean Portfolio Manager |
| `dev@cosmos.demo` | `Demo@Cosmos2026!` | `DEV` | Developer |

**Note:** `LPM` does not exist in `MemberRole`. `ADMIN` is the closest equivalent — full portfolio-wide authority matches LPM's SAFe scope.

### 2.2 Workspace

Single tenant: `{ name: "COSMOS Demo", slug: "cosmos-demo", plan: "NEBULA" }`

All 5 personas are members of this tenant. Each logs in and sees role-specific bento cockpit automatically (existing bento routing by role).

### 2.3 Seeded Entity Hierarchy

```
Tenant: COSMOS Demo
│
├── StrategicTheme: "Aceleração Digital"
│   color: #6366f1  status: ACTIVE  owner: lpm
│
├── OKR: "Aumentar adoção da plataforma em 30%"  (rte, linked to theme)
│   quarter: Q2  year: 2026  type: "pi_art"
│   └── KeyResult: "MAU: 10.000 → 13.000 usuários"
│       unit: users  current: 10800  target: 13000
│
├── LeanBudget: "ART-01 — Cloud & Plataforma"
│   total: 2400000  allocated: 1980000  currency: BRL  (rte)
│
├── ART: "ART-01 Plataforma Digital"
│
├── PIPlan: "PI 2026-Q2"  status: ACTIVE  artId: ART-01
│
├── Team: "Alpha Squad"  artId: ART-01  SM: sm
│
├── Sprint: "PI-2026-Q2-S1"  status: ACTIVE  teamId: Alpha
│
├── PIObjective: "Entregar autenticação unificada"
│   type: COMMITTED  businessValue: 8  piPlanId: PI-2026-Q2
│
├── Epic: "Portal do Cliente"  status: ANALYSIS  (pm)
│   linked to StrategicTheme
│   └── Feature: "Autenticação Unificada"  status: IN_PROGRESS  (pm)
│       └── Story: "Login SSO — fluxo principal"  sprintId: S1  (pm)
│           ├── Task: "Implementar OAuth2 callback"  assignee: dev  status: IN_PROGRESS
│           └── Task: "Testes de integração IdP"  assignee: dev  status: TODO
│
├── Defect: "Sessão expira antes do timeout configurado"  (dev → sprint S1)
│
├── Risk: "Dependência AWS sem SLA formal"
│   status: OPEN  roam: MITIGATE  owner: sm
│
├── Dependency: "Feature SSO depende de API Legada do cliente"
│   status: OPEN  from: Feature SSO  (sm)
│
├── StandupEntry: (dev, yesterday sprint)
│   yesterday: "Implementei callback OAuth2"
│   today: "Integrar com IdP de staging"
│   blockers: null
│
└── AccessExceptionRequest (PAE demo data):
    ├── status: PENDING
    │   requester: dev  entityType: Epic  action: create
    │   duration: 4h  justification: "Urgente para sprint planning desta semana"
    │   targetEntityId: Epic "Portal do Cliente"  (notifies pm as owner)
    │
    ├── status: APPROVED  expiresAt: now()+45min
    │   requester: sm  entityType: LeanBudget  action: update
    │   duration: 1h  justification: null
    │   approverId: rte  approvedAt: now()-15min
    │
    └── status: DENIED
        requester: dev  entityType: Feature  action: delete
        duration: 4h  justification: "Limpeza de backlog"
        approverId: pm  approvedAt: now()-2h
```

### 2.4 Script Changes

File: `apps/app/scripts/seed-personas.ts` — extend existing script.

Structure:
1. Create/upsert tenant `cosmos-demo`
2. Create/upsert 5 users + hashed passwords + TenantMember records (existing logic)
3. Seed entities in dependency order (StrategicTheme → ART → Team → … → PAE records)
4. All operations use `upsert` or `findFirst + create` — idempotent, safe to re-run

Run order requirement: script is self-contained. No dependency on `seed-admin.ts` or `seed-safe-full.ts`.

### 2.5 Role-Specific Views

Bento cockpit routing by role already exists. Seed ensures each view has data:

| Role | Cockpit cells populated |
|------|------------------------|
| ADMIN (lpm) | StrategicTheme, LeanBudget, OKR, portfolio-wide metrics |
| RTE | ART status, PIPlan, PIObjective, Risk/ROAM, LeanBudget |
| SM | Team, Sprint, Retrospective, Impediment, StandupEntry |
| PO | Epic, Feature, WSJF, Backlog |
| DEV | Sprint stories, Tasks, Defects, StandupEntry |

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `packages/database/prisma/schema/pae.prisma` | `AccessExceptionRequest` model |
| `apps/app/app/actions/pae/schema.ts` | Zod schemas for PAE inputs |
| `apps/app/app/actions/pae/index.ts` | Server actions: create/approve/deny/revoke/list |
| `apps/app/components/ui/pae-request-button.tsx` | Lock button component |
| `apps/app/components/ui/pae-request-sheet.tsx` | Request sheet (shadcn Sheet) |
| `apps/app/app/(authenticated)/access-exceptions/page.tsx` | Management page |
| `apps/app/app/(authenticated)/access-exceptions/components/` | Tabs, rows, countdown |
| `apps/app/__tests__/actions/pae/pae.test.ts` | Unit tests |

### Modified files
| File | Change |
|------|--------|
| `apps/app/app/actions/permissions.ts` | Add PAE fallback to `enforce()` |
| `apps/app/app/actions/notifications/schema.ts` | Add `pae_*` notification types |
| `apps/app/scripts/seed-personas.ts` | Add entity seeding + PAE demo data |
| `packages/database/prisma/schema/tenant.prisma` | Add `AccessExceptionRequest[]` relation to `Tenant` |

---

## Constraints

- PAE does not override `ADMIN` bypass — ADMIN already passes `enforce()` before any PAE check.
- A user cannot request an exception for an action their role can already perform.
- Maximum 1 PENDING request per `(requesterId, entityType, action)` at a time — duplicate requests are rejected with a clear message.
- Expired grants are not cleaned up immediately — they stay in DB with `status=APPROVED` but `expiresAt < now()`. The `/access-exceptions` Histórico tab shows them. A cron or lazy cleanup can be added later.
- `targetEntityId` is stored but not enforced in the grant. It is only used to route the initial notification.

# Story 004 — Walkthrough Log

**Date:** 2026-05-12  
**Story:** Componente Workspace Switcher  
**Epic:** epic-002  
**Status:** ✅ Done  
**WSJF Score:** N/A

---

## O Que Foi Implementado

### 1. Novos Componentes

| Arquivo | Descrição |
|---------|-----------|
| `(authenticated)/components/workspace-switcher.tsx` | Dropdown no SidebarHeader com lista de tenants, switch com FullScreenLoader |
| `(authenticated)/components/full-screen-loader.tsx` | Overlay full-screen com spinner durante troca de workspace |
| `(authenticated)/components/user-button.tsx` | Substituição do Clerk UserButton — avatar + signout dropdown |

### 2. API Routes

| Rota | Método | Função |
|------|--------|--------|
| `/api/tenants` | GET | Lista tenants do usuário autenticado com `activeTenantId` |
| `/api/auth/switch-tenant` | POST | Valida member → atualiza `Session.activeTenantId` no DB |
| `/api/auth/[...all]` | GET/POST | better-auth handler via `auth.handler(request)` |

### 3. Sidebar Migrada (Clerk → Better Auth)

- `OrganizationSwitcher` removido → `WorkspaceSwitcher`
- `UserButton` Clerk → `UserButton` local (email/password + signOut)
- Removido `useSidebar` + `cn` que só servia o `OrganizationSwitcher` wrapper

### 4. Layout Autenticado Migrado

`app/(authenticated)/layout.tsx`:
- `auth()` (callable Clerk) → `currentUser()` + `redirectToSignIn()` de `@repo/auth/server`
- `const { redirectToSignIn } = await auth()` → função direta `redirectToSignIn()`

### 5. Clerk Legacy Cleanup (cascata)

| Arquivo | Migração |
|---------|----------|
| `app/api/collaboration/auth/route.ts` | `auth() + fullName/emailAddresses/imageUrl` → `currentUser() + getOrgId() + user.name/email/image` |
| `app/actions/users/search.ts` | `clerkClient + OrganizationMembership` → `database.tenantMember.findMany()` + Fuse.js |
| `app/actions/users/get.ts` | Idem — retorna `Liveblocks["UserMeta"]["info"][]` via DB |
| `app/(authenticated)/page.tsx` | `database.page.findMany()` removido (stub model deletado) |
| `app/(authenticated)/search/page.tsx` | Idem |
| `packages/feature-flags/lib/create-flag.ts` | `auth()` → `currentUser()` |
| `packages/webhooks/lib/svix.ts` | `auth().orgId` → `getOrgId()` |

### 6. `@repo/auth/server.ts` — novos exports

```typescript
export async function currentUser()          // get session user via nextHeaders()
export function redirectToSignIn(): never    // redirect("/sign-in")
export async function getOrgId()             // try requireTenantSession, return tenantId | null
```

### 7. TypeScript fixes

- `packages/auth/tsconfig.json`: `declaration: false, declarationMap: false` (fix TS2742)
- `apps/app/tsconfig.json`: idem
- `packages/auth/client.ts`: explicit cast `as unknown as BetterAuthClient` (fix cross-package TS2742)

---

## Acceptance Criteria — Verificação

- [x] Dropdown no canto superior esquerdo (SidebarHeader) com lista de Tenants do usuário
- [x] Ao trocar tenant: POST `/api/auth/switch-tenant` → `Session.activeTenantId` atualizado → `router.refresh()` + FullScreenLoader (evita cache client-side)
- [x] `pnpm --filter app typecheck` → EXIT 0
- [x] `pnpm --filter @repo/auth typecheck` → EXIT 0

---

## Notas

- WorkspaceSwitcher carrega tenants via `useEffect` + `/api/tenants` — refatorar para RSC + `use client` boundary quando dashboard tiver layout completo
- "New workspace" no dropdown está desabilitado (`disabled`) — implementar em epic-003 (Portfolio Management)
- Para melhor UX: considerar server-side hydration do activeTenantId via props do layout

# Story 003 — Walkthrough Log

**Date:** 2026-05-12  
**Story:** Integração Multi-Tenant com Better Auth  
**Epic:** epic-002  
**Status:** ✅ Done  
**WSJF Score:** 15.0

---

## O Que Foi Implementado

### 1. Substituição Clerk → Better Auth (`packages/auth`)

| Arquivo | Ação |
|---------|------|
| `package.json` | Removido `@clerk/nextjs`, `@clerk/themes`, `@clerk/types` → adicionado `better-auth`, `next` |
| `keys.ts` | Substituído Clerk env vars → `BETTER_AUTH_SECRET` (min 32 chars) + `BETTER_AUTH_URL` (optional) |
| `server.ts` | Reescrito com `betterAuth()` + `prismaAdapter` + `activeTenantId` session field |
| `client.ts` | Reescrito com `createAuthClient` (better-auth/react) |
| `proxy.ts` | Reescrito — middleware edge que verifica sessão em rotas protegidas via fetch `/api/auth/get-session` |
| `provider.tsx` | Simplificado — better-auth é serverless, sem context provider necessário |
| `components/sign-in.tsx` | Substituído ClerkSignIn → form HTML com `authClient.signIn.email()` |
| `components/sign-up.tsx` | Substituído ClerkSignUp → form HTML com `authClient.signUp.email()` |
| `tsconfig.json` | Adicionado `declaration: false, declarationMap: false` (fix TS2742 — better-auth deep type inference) |

### 2. Propagação de `tenantId` (`requireTenantSession`)

```typescript
// packages/auth/server.ts
export async function requireTenantSession(headers: Headers): Promise<TenantContext> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("UNAUTHORIZED");
  const tenantId = session.session.activeTenantId;
  if (!tenantId) throw new Error("NO_ACTIVE_ORGANIZATION");
  return { userId: session.user.id, tenantId, user: session.user };
}
```

`activeTenantId` = campo custom na Session → substitui `activeOrganizationId` do plugin organization.
Integra com o modelo `Tenant` existente sem duplicar tabelas.

### 3. Prisma Schema (`packages/database/prisma/schema/`)

**Correções:**
- `prisma.config.ts`: path `"prisma/schema.prisma"` → `"prisma/schema"` (multi-file)
- `base.prisma`: removido `url = env("DATABASE_URL")` (Prisma 7 breaking change — url vai no config)

**Extensões ao User (`tenant.prisma`):**
- `emailVerified Boolean @default(false)` (requerido pelo better-auth)
- Relações: `sessions Session[]`, `accounts Account[]`, `invitations Invitation[]`

**Extensões ao Tenant (`tenant.prisma`):**
- `logo String?` (para exibição no workspace switcher)
- Relações: `activeSessions Session[]`, `invitations Invitation[]`

**Novo arquivo `auth.prisma`:**
- `Session` — com `activeTenantId String?` linkado ao `Tenant`
- `Account` — credenciais OAuth/email por provider
- `Verification` — tokens de verificação de email
- `Invitation` — convites de tenant (linkados a `Tenant` + `User` inviter)

### 4. API Route Handler (`apps/app/app/api/auth/[...all]/route.ts`)

```typescript
import { auth } from "@repo/auth/server";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

### 5. Env Variables

`apps/app/.env.local` criado com:
- `BETTER_AUTH_SECRET` (≥32 chars)
- `BETTER_AUTH_URL=http://localhost:3000`
- Stubs para todos os outros serviços

`apps/web/.env.local` atualizado: Clerk vars removidos → Better Auth.

---

## Acceptance Criteria — Verificação

- [x] `better-auth` implementado com adaptador Prisma (prismaAdapter)
- [x] Session extrai e propaga `tenantId` automaticamente via `requireTenantSession(headers)`
- [x] Endpoint protegido sem `activeTenantId` → throw `"NO_ACTIVE_ORGANIZATION"` (equivale 403)
- [x] `@repo/auth typecheck` → EXIT 0
- [x] `@repo/database typecheck` → EXIT 0
- [x] `prisma generate` → `✔ Generated Prisma Client (v7.1.0)`

---

## Notas para Próximas Stories

- `activeTenantId` é setado pelo cliente via `authClient.updateUser` ou via server action após selecionar workspace
- Story-004 (Workspace Switcher) deve chamar `authClient.$fetch("/api/auth/update-session", { activeTenantId })` ao trocar tenant
- Para produção: `BETTER_AUTH_SECRET` deve ser gerado com `openssl rand -hex 32`
- `DATABASE_URL` precisa de PostgreSQL com extensão `vector` habilitada (pgvector) — usar `CREATE EXTENSION vector;` no setup inicial

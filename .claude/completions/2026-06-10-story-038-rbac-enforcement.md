# Story-038 — RBAC Enforcement (Complete)

**Date:** 2026-06-10
**Branch:** feat/kanban-portfolio-ai
**WSJF:** 10

---

## Entregues

| AC | Item | Arquivo |
|----|------|---------|
| AC-001 | MEMBER negado epic:write → `{code:"INSUFFICIENT_ROLE"}` | `_withSecureAction.ts` |
| AC-002 | Defense-in-depth: HOF + `can()`/`enforce()` + RLS | `_withSecureAction.ts` + `permissions.ts` + migration RLS |
| AC-003 | Custom roles com permissões aditivas | `lib/rbac/custom-roles.ts` + HOF check |
| AC-004 | SAFe hierarchy: SM negado epic:transition | matrix.ts (pré-existente) |
| AC-005 | ART-scoped role: artId override, MEMBER fallback | `lib/rbac/resolve.ts` (pré-existente) |
| AC-006 | Redis cache 5-min TTL (`perm:{org}:{user}:{art?}`) | `lib/rbac/resolve.ts` (pré-existente) |
| AC-007 | Role propagation audit on member add | audit-on-deny em `_withSecureAction.ts` |
| AC-008 | UI gate: `<CanDo permission="epic:write">` não renderiza | `can-do.tsx` server component |

---

## Arquivos criados

- `apps/app/app/actions/_withSecureAction.ts` — HOF central
- `apps/app/lib/rbac/custom-roles.ts` — `getCustomPermissions`
- `apps/app/app/(authenticated)/components/can-do.tsx` — server component de UI gate
- `apps/app/__tests__/rbac/with-secure-action.test.ts` — 17 testes novos

## Arquivos modificados

- `apps/app/__tests__/rbac/rbac.test.ts` — fix `= ""` (era `= undefined` → string "undefined" truthy → Redis branch era chamado incorretamente)

---

## `withSecureAction` — fluxo

```
requireTenantSession(headers())
  → getEffectiveRole(userId, tenantId, artId?)   # ART-scoped → org → MEMBER fallback
    → hasPermission(role, permission)
      → [if denied] getCustomPermissions(userId, tenantId)
        → [if still denied] auditLog.create(authz.denied) + return err("INSUFFICIENT_ROLE")
          → [if granted] safeAction(() => fn(ctx))
```

---

## Decisões-chave

- **HOF não usa `safeAction` para o check de RBAC**: retorna `err()` direto para preservar `code: "INSUFFICIENT_ROLE"` sem modificar `_base.ts`.
- **Custom roles aditivos**: SAFe role check primeiro; custom como fallback (não substitui).
- **`CanDo` é Server Component**: renderiza null se negado — sem estado no cliente, sem flash de UI.
- **Redis condicional**: `getEffectiveRole` só usa Redis se `UPSTASH_REDIS_REST_URL` está setado (não vazio).

---

## Testes (29 total — todos passando)

| Suite | Testes |
|-------|--------|
| `rbac/rbac.test.ts` | 12 (matrix + getEffectiveRole) |
| `rbac/with-secure-action.test.ts` | 17 (grant/deny/ART/custom/audit) |

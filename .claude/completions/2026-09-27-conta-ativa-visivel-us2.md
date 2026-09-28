# Spec 009 — Conta ativa sempre visível — US2 (seletor com confirmação)

**Data**: 2026-09-27
**Commit**: `7b7cde11` — feat(auth): seletor de conta com confirmação nos 5 produtos (spec 009 US2)

## Feito

- `AccountSwitcher` (badge + dropdown + `SwitchAccountDialog`) em
  `packages/design-system/components/account-switcher/`, reusando
  `POST /api/auth/switch-tenant` e `resolvePostLoginDestination`.
- `getShellData()`/`ShellIdentity` dos 5 produtos (Meridian, Signal,
  Scaffold, Charter, Cosmos) estendidos com `tenants[]` + `activeTenantId`.
- Edge case: seletor escondido quando `tenants.length <= 1`.
- Tasks fechadas: T001-T012, T014-T032 (tasks.md atualizado).
- T013 parcial: E2E cobre o edge case de conta única; falta seed com
  2+ `TenantMember` para a mesma pessoa para testar o fluxo de troca real.

## Testes

`npx vitest run __tests__/design-system __tests__/produto __tests__/actions/auth/switch-tenant-cache.test.ts __tests__/signal/integration/shell.test.ts`
→ 44 passed (7 arquivos). `pnpm typecheck` limpo. Biome só nos arquivos
tocados, sem achados.

## Aberto

- T013 completo (precisa seed de persona multi-tenant).
- T033 (validação manual do quickstart) e T034 (coverage global) —
  bloqueados pela mesma falta de seed / fora do escopo desta sessão.
- Achado de segurança: `e2e/fixtures/catalogo/` (gerado por
  `AUTH_TEST=true`, com cookie de sessão real) não estava no
  `.gitignore` de `e2e/fixtures/` — corrigido nesta sessão.

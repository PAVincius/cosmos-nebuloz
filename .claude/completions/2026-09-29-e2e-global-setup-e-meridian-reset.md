# e2e globalSetup + reset Meridian (tarefas 1.1 e 1.3 da noite de 2026-09-29)

Branch `fix/e2e-global-setup-landing`, worktree `wt-meridian`.

## 1.1 — globalSetup do E2E
- `apps/app/e2e/setup/landing.ts`: `isPostLoginLanding(url)` aceita `/`, `/produto`, `/dashboard`, `/portfolio` e `/<produto>` (meridian, scaffold, cosmos, signal, charter), inclusive subrotas.
- `auth.setup.ts`: usa o helper; erro de seed derruba o setup; sem `AUTH_TEST=1` falha com instrução.
- Teste: `apps/app/__tests__/e2e-setup/landing.test.ts` (fora de `e2e/` porque o vitest exclui `e2e/**`). 20 casos.

## 1.3 — reset Meridian
- `apps/app/scripts/sql/meridian-reset.sql` e `docs/runbooks/meridian-reset-producao.md`.
- Coluna de `MeridianSequence` é `next` (default 1), não `value`: o SQL apaga as linhas em vez de zerar.
- Não executado em lugar nenhum (Docker fora). Nomes conferidos contra `meridian.prisma`.

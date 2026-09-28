# Pre-push verde de novo — paletas do Cosmos e do Signal sem o shell

**Data**: 2026-09-28
**Commits**:
- `384cd0f4` — fix(cosmos): tira NAV do shell para a paleta não puxar o banco
- `b063cc4b` — test(produto): timeout de 20 s no caso do Cosmos em shell-data
- `b2737bed` — fix(signal): tira NAV do shell para a paleta não puxar o banco

## Causa

Desde `1c5da6bb` (spec 009 US2, seletor de conta), os shells dos produtos
importam a server action `resolveActiveAccountDestination`
(→ `@repo/auth/server` → `@repo/database`). A `command-palette.tsx` do Cosmos
importava `NAV` do shell, então `__tests__/components/command-palette.test.tsx`
carregava o banco no jsdom e o t3-env recusava `DATABASE_URL` no cliente. O
teste quebrava na importação e derrubava o `pnpm turbo test` do pre-push em
qualquer branch. Os PRs #275–#277 subiram com o hook desligado, por decisão do
CEO.

O Signal tinha o mesmo padrão (`palette.tsx` importava `NAV` de `./shell`, que
importa a paleta de volta), só não quebrava porque nenhum teste importa a
paleta dele.

## Feito

- Cosmos: `NAV` e o tipo `NavItem` saíram de `shell.tsx` para
  `components/cosmos/nav.ts` (só dados, sem `"use client"`), lido pelo shell e
  pela paleta.
- Signal: o mesmo, em `components/signal/nav.ts` (`NAV`, `NavItem`,
  `NavSection`).
- Nos dois, desfeito o import circular shell ↔ paleta; com ele saiu o contorno
  de TDZ (`useMemo(() => flattenNav(), [])` virou `const ENTRIES = flattenNav()`
  no módulo).
- `TITLES`, `ComingSoon` e o seletor de conta ficaram onde estavam, sem mudança.
- Com a paleta do Cosmos resolvida, o pre-push passou a cair em
  `__tests__/produto/shell-data.test.ts` (caso Cosmos): timeout de 5 s em 2 de 2
  tentativas, 4465 testes verdes. O teste importa `app/(cosmos)/layout.tsx`
  para chegar em `resolveIdentity`, e com ele o shell client inteiro: ~3 s
  isolado, igual antes e depois do fix (3,26/2,87 s × 3,06/3,25 s). Os outros 4
  produtos leem de `actions/shell.ts` e levam menos de 200 ms. Por decisão do
  dono, o caso ganhou timeout de 20 s, em commit separado.

## Testes

- `DATABASE_URL=<placeholder> npx vitest run __tests__/components/command-palette.test.tsx`
  → antes: falha na importação; depois: 9/9.
- Paleta do Signal: teste descartável que só importa o módulo (não commitado)
  → antes: `Attempted to access a server-side environment variable on the
  client`; depois: passa.
- `npx vitest run __tests__/signal` → 27 arquivos, 416 testes verdes.
- `npx vitest run __tests__/produto/shell-data.test.ts` → 5/5.
- `npx tsc --noEmit -p .` em apps/app: 44 erros, nenhum introduzido; o único
  em arquivo tocado é `components/cosmos/command-palette.tsx:92` (`onClick` do
  `<Command>` do cmdk), linha que os commits não mexem.
- Biome só nos arquivos tocados, sem achados.
- Pre-push (`pnpm turbo test` completo): as 3 primeiras tentativas foram
  barradas por timeout. Nas 2 primeiras, só o caso Cosmos de `shell-data`. Na
  3ª, com o timeout de 20 s, 8 testes em 5 arquivos sem relação com a mudança
  (charter, seed-meridian, meridian-coleta, settings, shell-data), com load
  average de 162 em 12 CPUs por carga externa (Brave, VM do Docker, FSEvents
  com `git worktree remove`). A 4ª, disparada com load 10,5, passou: 16/16
  tarefas, `app:test` com 461 arquivos e 4466 testes verdes (1 expected fail,
  20 skipped).

## Aberto

- Tirar `resolveIdentity` de `app/(cosmos)/layout.tsx` para
  `app/(cosmos)/actions/shell.ts`, como nos outros produtos, e remover o
  timeout de 20 s.

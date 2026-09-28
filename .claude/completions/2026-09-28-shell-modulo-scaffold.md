# fix(shell): SCAFFOLD no AppSwitcher (P1 GET /meridian 500)

- Causa: `modules as ModuleId[]` em actions/shell.ts escondia SCAFFOLD; `MODULE_META[m]` undefined → `.href` TypeError.
- Fix: `lib/shell-modules.ts` (`pickKnownModules`) filtra por módulos que cada casca conhece. Meridian/Signal: COSMOS, CHARTER, SIGNAL, MERIDIAN. Charter: COSMOS, CHARTER, SIGNAL (MERIDIAN também quebrava lá).
- Scaffold shell: ModuleId já inclui SCAFFOLD e não tem switcher; Cosmos sem switcher. Não mexidos.
- Teste: `apps/app/__tests__/produto/shell-modules.test.ts` (RED→GREEN). tsc limpo; vitest produto + signal/shell 39 ok.
- Biome lint crasha no worktree (processo terminado); formatação aplicada.

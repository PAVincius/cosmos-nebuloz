# CI vermelho: erro interno do Biome em `biome check --changed`

**Branch:** `fix/ci-biome-changed` · **Data:** 2026-10-03

## Causa
Regressão do Biome ≥ 2.3.7 (issues biomejs/biome#8204 e #8527, corrigida em #8536, release 2.3.11): a inferência de tipos entra em explosão com `while` que anda por `parentElement`/`children` (tipo recursivo). O resultado é o diagnóstico `project INTERNAL — unusually large amount of types … exceeded the limit of 200,000`, que derruba o job Lint & Format.

Aqui o gatilho é o helper `temAncestralInterativo` de `apps/backoffice/__tests__/propostas-linha-a11y.test.tsx` (e laços parecidos nos outros testes do back-office). O limite é global ao projeto: excluir qualquer terço de `apps/backoffice/__tests__` do scanner (`!!`) já fazia o erro sumir. Com 2.3.8 o sintoma varia entre `exceeded the limit` e `Linter process terminated abnormally (possibly out of memory)`.

CI ficou vermelho a partir de `0fecf28a` (02/10 03:21); `f11bc407` (02:49) ainda passava.

## Correção
`@biomejs/biome` 2.3.8 → 2.3.11 (pin exato, como estava). 2.3.12+ não serve ainda: renomeia `useUniqueGraphqlOperationName` e a config do ultracite 6.3.9 quebra.

## Verificação
- 2.3.11 avulso, 3× no arquivo gatilho e em arquivo trivial: sem `exceeded` nem `terminated abnormally`.
- `biome check --changed …` do ci.yml: roda sem diagnóstico INTERNAL.
- Lockfile: só as entradas do biome mudam.
- Não validei com `pnpm install` real (disco); o CI do PR é a prova final.

## Fora do escopo (só registro)
`biome check .` na raiz acusa ~517 erros em arquivos que ninguém tocou (`.maestri/`, `apps/app/.design-ref`, etc.); o CI só olha o diff, por isso não aparecem.
`.claude/worktrees/agent-afc2e696fba4b6919` é gitlink (160000) sem entrada em `.gitmodules`: o post-job do checkout loga `fatal: No url found for submodule path`.

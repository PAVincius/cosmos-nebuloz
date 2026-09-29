# E2E (Playwright)

Rode **de dentro de `apps/app`**, com `pnpm exec playwright test`. Não use
`pnpm --filter @repo/app exec playwright test` a partir da raiz: o diretório de
trabalho muda e os caminhos relativos do setup (`./e2e/fixtures/...`) e dos
seeds (`pnpm seed:*`) deixam de resolver.

```bash
cd apps/app
AUTH_TEST=1 pnpm exec playwright test e2e/meridian-
```

- `AUTH_TEST=1` é obrigatório: sem ele o globalSetup falha com instrução, em vez
  de pular a geração das sessões.
- O globalSetup roda os seeds de `e2e/setup/seeds.ts` no banco local (tenant
  `cosmos-dev`) e derruba a execução se qualquer um falhar.
- Sessões salvas em `e2e/fixtures/`.

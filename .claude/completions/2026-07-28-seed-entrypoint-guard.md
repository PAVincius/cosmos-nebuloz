# Guarda de entrypoint nos scripts de seed

**Data**: 2026-07-28

## Problema

Todo script de seed chamava `main()` no topo do módulo, sem guarda. Como `main()`
começa com `deleteMany` em dezenas de tabelas tenant-scoped, qualquer `import`
do módulo — inclusive só para reusar um tipo ou constante — apagava e recriava
dados.

Já tinha custado uma workaround: `STATUS_CHAINS` foi extraída para
`apps/app/scripts/flow-status-chains.ts` só para que `verify-seed.ts` pudesse
usá-la sem disparar o seed.

## Correção

11 arquivos receberam a mesma guarda:

```ts
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) { main().catch(...) }
```

Escolha do formato: sob `tsx` os scripts são transpilados para CJS (`require.main`
existe) **e** `import.meta.url` é shimado; sob vitest/`node --import tsx/esm` só
`import.meta.url` existe. A comparação `import.meta.url` × `process.argv[1]`
funciona nos dois — `require.main === module` não. `realpathSync` evita
falso-negativo silencioso (seed que não roda) quando invocado via symlink.

## Arquivos

| Arquivo | Situação |
|---|---|
| `apps/app/scripts/seed-e2e.ts` | corrigido |
| `apps/app/scripts/seed-tenants.ts` | corrigido |
| `apps/app/scripts/seed-portfolio.ts` | corrigido |
| `apps/app/scripts/seed-demo-full.ts` | corrigido |
| `apps/app/scripts/seed-personas.ts` | corrigido |
| `apps/app/scripts/seed-admin.ts` | corrigido |
| `apps/app/scripts/seed-okr-tree-demo.ts` | corrigido |
| `apps/app/scripts/verify-seed.ts` | corrigido (importá-lo rodava a verificação + `process.exit`) |
| `packages/database/seed-safe-full.ts` | corrigido |
| `packages/database/seed-admin.ts` | corrigido |
| `packages/database/scripts/seed-cosmos.mts` | corrigido — **o bug já estava ativo**: `scripts/__tests__/seed-cosmos.test.ts` importa `seedDevMembership` deste módulo, então `pnpm test` rodava o seed no banco real |

## Teste

`apps/app/__tests__/scripts/seed-entrypoint-guard.test.ts` — importa cada um dos
11 módulos num processo `tsx` separado, com `DATABASE_URL` apontando para porta
morta, e exige exit 0 sem output de seed.

Verificações feitas:

- 11/11 passam.
- **Controle negativo**: um módulo com o padrão antigo (query no import) sai com
  1 no mesmo harness → o teste não é vácuo.
- **Direção inversa**: rodar cada script direto ainda entra em `main()`
  (todos morrem em "Can't reach database" contra a porta morta).
- `dotenv.config()` não sobrescreve env já definido — confirmado, então uma
  regressão da guarda falha contra o banco morto em vez de destruir dados reais.

## Fora de escopo (não corrigidos, apenas registrados)

Mesmo padrão em scripts que não são seed: `upgrade-plan.ts`, `reset-pw.ts`
(ambos mutam dados), `list-users.ts`, `audit-raw-sql-drift.ts`,
`scripts/risk-score.ts`, `scripts/generate-tests.ts`, `scripts/fix-ci.ts`.

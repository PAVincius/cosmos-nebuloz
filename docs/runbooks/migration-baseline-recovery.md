# Runbook: recuperar a baseline de migrations do Prisma

## O que aconteceu

Em algum momento, alguém rodou `prisma db push` neste banco de dev/staging — provavelmente
para "resolver rápido" uma migration que estava travada, ou para prototipar schema sem gerar
migration. `db push` sincroniza o schema físico diretamente a partir de `schema.prisma`, sem
tocar na tabela de controle `_prisma_migrations`.

O problema: este projeto também usa `prisma migrate deploy` (via `pnpm migrate` e em CI). As
duas ferramentas **não convivem**. Depois do `db push`, a migration `20260516163559_init`
ficou registrada em `_prisma_migrations` com `finished_at = NULL` e um log de falha (erro
`42710 — type "SubscriptionPlan" already exists`, porque o tipo já existia no banco graças ao
`db push`). O Prisma recusa aplicar qualquer migration nova enquanto existir uma migration
falhada no topo do histórico — então nenhuma das ~70 migrations seguintes, incluindo todas as
de RLS (`rls_tenant_isolation`, `fix_rls_force_rls`, etc.), jamais rodou. O resultado: o schema
físico do banco bate 100% com o `schema.prisma` atual (porque `db push` o sincronizou), mas o
livro-razão de migrations mente — ele diz que quase nada foi aplicado.

Isto é uma bomba-relógio silenciosa: o banco "funciona" (schema correto), então ninguém nota,
até que uma migration nova genuína seja necessária — aí o `migrate deploy` trava com o erro de
migration falhada, bloqueando deploy/CI.

## Como diagnosticar

1. **Quantas migrations o Prisma acha que aplicou vs. quantas existem em disco:**

   ```bash
   cd packages/database
   npx prisma migrate status
   ```

   Sinal de alerta: poucas linhas em `_prisma_migrations` comparado ao número de pastas em
   `prisma/migrations/`, ou uma mensagem de "migration failed to apply".

2. **Inspecionar a tabela de controle diretamente** (não há `psql` neste ambiente — use um
   script `tsx` com o adapter `PrismaPg`, no padrão de `apps/app/scripts/verify-seed.ts`):

   ```ts
   const rows = await prisma.$queryRawUnsafe(
     `SELECT migration_name, started_at, finished_at, applied_steps_count, logs
      FROM "_prisma_migrations" ORDER BY started_at`
   );
   ```

   Procure linhas com `finished_at = null` — são as que travaram o ledger.

3. **O passo decisivo — o schema físico realmente bate com `schema.prisma`?**

   ```bash
   cd packages/database
   npx prisma migrate diff \
     --from-config-datasource \
     --to-schema ./prisma/schema \
     --exit-code
   ```

   (Em Prisma 7, as flags são `--from-config-datasource` / `--to-schema <caminho>`; não
   `--from-schema-datasource` / `--to-schema-datamodel` como em versões antigas — confira
   sempre com `npx prisma migrate diff --help`, os nomes mudam entre major versions. Este
   repo divide o schema em `prisma/schema/*.prisma`, então `--to-schema` aponta para a pasta,
   não um arquivo único.)

   - **Saída "No difference detected." e exit code 0** → o schema físico está em dia. Só o
     ledger está errado. Prossiga para a recuperação abaixo.
   - **Qualquer diferença listada** → o schema físico **não** bate com o `schema.prisma`
     atual. Marcar migrations como aplicadas neste cenário escreveria uma mentira maior no
     ledger. **Pare.** Investigue a diferença primeiro (provavelmente uma migration que nunca
     rodou e que precisa ser aplicada de verdade, não só marcada).

## Comandos de recuperação (só depois do diff limpo)

O padrão é `prisma migrate resolve --applied <nome-da-migration>`, uma vez por pasta de
migration cujo efeito já está fisicamente no banco — **na ordem cronológica**, começando pela
que falhou:

```bash
cd packages/database
for m in $(ls prisma/migrations | grep -v migration_lock.toml | sort); do
  echo "resolving $m"
  npx prisma migrate resolve --applied "$m" || { echo "FALHOU em $m — pare e investigue"; break; }
done
```

Depois, confirme que o ledger está limpo:

```bash
npx prisma migrate status
# esperado: "Database schema is up to date!" / nenhuma pendente, nenhuma falhada
```

**Prova real da recuperação:** `migrate resolve` só edita o ledger — não prova que o caminho
de aplicação normal voltou a funcionar. O teste de verdade é aplicar uma migration nova de
verdade (ou uma migration no-op temporária, se não houver nenhuma pendente) com o comando do
dia a dia:

```bash
pnpm migrate
```

Se isso aplicar sem erro, a baseline está recuperada.

## Como evitar a recorrência

- **Nunca rode `prisma db push` neste projeto**, nem em dev. O fluxo oficial é sempre
  `prisma migrate dev` (local) / `prisma migrate deploy` (`pnpm migrate`, CI, staging,
  produção). `db push` e `migrate deploy` não podem ser usados alternadamente no mesmo banco —
  escolha um fluxo e mantenha-o.
- Se uma migration falhar no meio da aplicação, **não** tente "consertar" rodando `db push`
  por cima. O caminho correto é: corrigir a migration SQL (ou reverter manualmente o efeito
  parcial no banco) e então `prisma migrate resolve --applied` ou `--rolled-back`, conforme o
  caso — ver https://pris.ly/d/migrate-resolve.
- **`prisma migrate reset` destrói todos os dados do banco** (drop + recreate + reseed). Ele
  nunca deve ser usado para "consertar" um ledger de migrations mentiroso em nenhum ambiente
  que tenha dado que importe — inclusive dev, se o banco tiver seed que outras tarefas
  dependem. Reset não é um atalho de recuperação; é uma reinicialização total.
- Antes de qualquer migration nova, rode `npx prisma migrate status` como checagem de sanidade
  — se ele já reportar algo diferente de "up to date", pare e recupere a baseline antes de
  empilhar mais uma migration em cima de um ledger quebrado.

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

### "Already recorded as applied" durante o laço de resolve

Se o banco já teve uma recuperação parcial anterior, alguma migration do laço pode já estar
marcada como aplicada. Nesse caso `migrate resolve --applied <nome>` falha com:

```
Error: P3008
The migration `<nome>` is already recorded as applied in the database.
```

Isto **não é uma falha real** — é o Prisma dizendo que aquele item específico não precisa de
ação. Continue o laço normalmente para as demais migrations; não é motivo para abortar a
recuperação. Só pare de verdade se o erro for outro (schema divergente, statement SQL
inválido, etc.).

### Removendo a migration de prova (probe) do Step 4

Se você criou uma migration no-op temporária para provar o caminho (porque a migration real
ainda não existia), saiba de antemão:

- **O caminho mais barato e recomendado é não remover nada.** Uma migration no-op aplicada
  com sucesso (ex.: `SELECT 1;`) não custa nada para permanecer — não altera schema, não
  altera dados, e sua linha em `_prisma_migrations` é só mais uma entrada legítima no
  histórico. **Prefira deixar a migration de prova e sua linha no ledger para sempre**, em vez
  de tentar limpá-la. Isso evita qualquer edição manual do ledger.
- **Por que `migrate resolve --rolled-back` não funciona aqui:** esse comando só reverte
  migrations que estão em **estado de falha**. Uma migration de prova que aplicou com sucesso
  (`finished_at` preenchido, sem erro) não está falhada, então o comando recusa com:

  ```
  Error: P3012
  Migration `<nome>` cannot be rolled back because it is not in a failed state.
  ```

  Isso é esperado, não um bug. Não insista tentando `--rolled-back` em uma migration que
  aplicou com sucesso.
- **Se a remoção for genuinamente necessária** (ex.: política do projeto de não deixar
  migrations de prova no histórico), o único caminho é apagar a pasta em
  `prisma/migrations/<nome>/` **e** a linha correspondente em `_prisma_migrations`
  diretamente. Trate isso como uma **exceção documentada**, não como um passo de rotina — é
  exatamente o tipo de edição manual do ledger que causou o incidente original:
  - A instrução SQL deve ser um `DELETE` de **uma única linha**, filtrado por
    `migration_name` (nunca por intervalo de data, nunca sem WHERE).
  - Registre a instrução exata executada e a confirmação de quantas linhas foram afetadas
    (deve ser exatamente 1) em qualquer relatório/log da operação.
  - Exemplo do formato mínimo aceitável:
    ```sql
    DELETE FROM "_prisma_migrations" WHERE migration_name = '<nome-exato-da-probe>';
    ```
    seguido da confirmação (`rows deleted: 1`) capturada da execução real.

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

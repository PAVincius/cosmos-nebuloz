# Runbook: role de aplicação sem `BYPASSRLS`

## Leia isto primeiro

**RLS está inerte até este role existir e a aplicação passar a usá-lo.** Hoje a aplicação
conecta como `postgres` — superusuário, com `rolbypassrls = true`. O PostgreSQL pula
Row Level Security inteiramente para qualquer role com `BYPASSRLS` (e sempre para
superusuários, independente da flag). As migrations já declaram 106
`ENABLE ROW LEVEL SECURITY` e 182 `CREATE POLICY` — nenhuma delas faz efeito algum enquanto
a conexão da aplicação continuar sendo `postgres`.

Medido neste banco de dev (`cosmos_dev`) em 2026-07-28:

```
current_user: postgres  (rolsuper=true, rolbypassrls=true)
```

Este runbook documenta como criar o role certo e trocar `DATABASE_URL` para usá-lo — mas
**não executa nenhum desses passos**. Trocar a identidade de conexão da aplicação pode
derrubar o app inteiro se algum grant faltar; é decisão de quem opera o ambiente, feita
fora do horário de pico, com rollback pronto.

## 1. Criar o role

Rode como um usuário com privilégio de `CREATEROLE` (ex.: `postgres`, mas apenas para
criar o role — não para logar como ele depois):

```sql
-- Role de aplicação: login, SEM superusuário, SEM bypassrls.
CREATE ROLE cosmos_app WITH
  LOGIN
  PASSWORD 'TROCAR-PARA-UM-SEGREDO-FORTE'
  NOSUPERUSER
  NOBYPASSRLS
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  CONNECTION LIMIT -1;
```

Pontos que importam:
- `NOBYPASSRLS` é o que faz RLS valer — é o oposto do estado atual do `postgres`.
- `NOSUPERUSER` é redundante com `NOBYPASSRLS` para efeito de RLS (superusuário sempre
  pula RLS, com ou sem a flag), mas é a prática correta de qualquer forma: a aplicação
  nunca deveria logar como superusuário.
- A senha deve vir de um gerenciador de segredos do ambiente (Vercel/Railway/1Password),
  nunca hardcoded em `.env` versionado.

## 2. Grants mínimos

O role de aplicação precisa ler/escrever nas tabelas de negócio e rodar as migrations
não — **quem roda `prisma migrate deploy` deve ser um role diferente** (ex.: o próprio
`postgres` ou um role de migração dedicado com `BYPASSRLS`, porque migrations alteram
schema e populam dados cross-tenant). Misturar os dois papéis no mesmo role reabre o
buraco que este runbook fecha.

```sql
-- Acesso à conexão e ao schema.
GRANT CONNECT ON DATABASE cosmos_dev TO cosmos_app;
GRANT USAGE ON SCHEMA public TO cosmos_app;

-- CRUD nas tabelas existentes.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cosmos_app;

-- Sequences (colunas serial/autoincrement, se houver; cuids não precisam,
-- mas não custa cobrir).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cosmos_app;

-- Tabelas/sequences criadas por migrations FUTURAS herdam os mesmos grants
-- automaticamente, sem precisar repetir este script a cada deploy.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cosmos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cosmos_app;
```

Não conceda `TRUNCATE`, `REFERENCES`, `TRIGGER`, `DROP`, `CREATE`, ou qualquer DDL — a
aplicação em runtime nunca precisa disso, e cada permissão a mais é superfície de ataque
em caso de SQL injection ou de um bug que execute SQL não confiável.

Se algum fluxo legítimo da aplicação (job em background, seed, migração de dados)
precisar ver todos os tenants, veja a seção "Escape hatch" no relatório da Task 4
(`.superpowers/sdd/2026-07-28-isolamento-tenant/task-4-report.md`) — a resposta não é dar
`BYPASSRLS` a `cosmos_app`.

## 2.5. Checklist de pré-requisitos antes do flip

RLS passa a valer de verdade no momento em que a Seção 3 troca `DATABASE_URL` para
`cosmos_app`. Os quatro itens abaixo foram encontrados durante a revisão da Task 5/6 do
plano de isolamento e **não têm dono nem prazo ainda** — resolvê-los (ou decidir
explicitamente adiar, com um plano de rollback) é pré-requisito para a Seção 3, não um
nice-to-have para depois.

Lembre-se também que `monthlyIsolationAudit` roda uma vez por mês (`0 0 1 * *`,
`lib/inngest/isolation-audit.ts`) — uma regressão de RLS pode ficar até 30 dias sem ser
detectada por ele. Não trate "o cron está verde" como sinal de segurança em tempo real;
para janelas menores que isso, dependa da suíte de CI e de revisão de PR, não do cron.

- [ ] **`JobFallbackQueue.tenantId` é nullable e é a única tabela policiada com essa
  característica.** `lib/inngest/send-safe.ts` grava `tenantId: tenantId ?? null` quando
  o evento não tem tenant (falha de infra do Inngest). Depois do flip, a política `WITH
  CHECK` da tabela rejeita qualquer `INSERT` com `tenantId = null` — o fallback de eventos
  perdidos passa a falhar silenciosamente (o `.catch` em `send-safe.ts` engole o erro,
  igual ao bug que este runbook/task consertou no isolation-audit). E
  `lib/inngest/job-fallback-drain.ts` lê a fila com o client plain (sem contexto de
  tenant) — depois do flip ele não vai enxergar nenhuma linha, então mesmo os eventos que
  conseguirem entrar nunca serão drenados.
  **Não corrija isso adicionando `OR tenantId IS NULL` à política** — isso exporia
  payloads de jobs de sistema (que podem conter dados de qualquer tenant, dependendo do
  evento) para todos os tenants via a mesma política. É uma decisão de operador, não um
  fix mecânico. Duas saídas razoáveis, a escolher antes do flip:
  1. Tornar `tenantId` obrigatório em `JobFallbackQueue` e resolver algum tenant real (ou
     o tenant `system` — ver item abaixo) antes de gravar; ou
  2. Dar ao drain (`job-fallback-drain.ts`) um role/contexto de sistema dedicado que
     bypassa RLS só para essa tabela, análogo ao "Escape hatch" descrito no relatório da
     Task 4 (`.superpowers/sdd/2026-07-28-isolamento-tenant/task-4-report.md`) — nunca
     `BYPASSRLS` em `cosmos_app` como um todo.

- [ ] **Todo caminho de background/cron que usa o client `database` plain (sem
  `withTenantDb`) fica deny-all (ou é bloqueado por `WITH CHECK` em escritas) depois do
  flip.** Levantamento feito em 2026-07-28: `withTenantDb` não é usado em nenhum arquivo
  de `apps/app/lib/inngest/` ou `apps/app/app/api/` — ou seja, **toda** a camada de jobs
  em background está hoje sem contexto de tenant:
  ```
  lib/inngest/billing-sync.ts
  lib/inngest/export-runner.ts
  lib/inngest/fathom-transcript.ts
  lib/inngest/fireflies-insights.ts
  lib/inngest/fireflies-transcript.ts
  lib/inngest/governance-sla.ts
  lib/inngest/isolation-audit.ts        (a auditoria mensal desta própria task)
  lib/inngest/job-fallback-drain.ts
  lib/inngest/lgpd-dsr.ts
  lib/inngest/scheduled-report-runner.ts
  lib/inngest/send-safe.ts
  lib/inngest/solution-staleness.ts
  lib/inngest/webhook-delivery.ts
  lib/inngest/workflow-sla.ts
  lib/inngest/workflow-wait-release.ts
  apps/app/app/api/platform/health/route.ts:41 (getFallbackQueueDepth)
  ```
  Cada um precisa de uma destas soluções antes do flip, decidida caso a caso: (a) o job já
  sabe o `tenantId` do evento e pode passar a rodar sua leitura/escrita via
  `withTenantDb(tenantId, ...)`; (b) o job legitimamente precisa ver todos os tenants
  (crons de auditoria/SLA que varrem a base inteira, como `governance-sla.ts` e o próprio
  `isolation-audit.ts`) e precisa do mesmo "Escape hatch" de role de sistema citado acima;
  ou (c) o job só toca tabelas sem RLS (ex.: catálogo `pg_class`) e não precisa de mudança.
  Não assuma (c) sem checar — confirme com a query da Seção 4 deste runbook quais tabelas
  cada job efetivamente lê/escreve.

- [ ] **A contagem de 128/136 tabelas com política + FORCE não é reproduzível só a partir
  das migrations — não trate 128 como um gate portável entre ambientes.** A migration de
  RLS (`20260728010000_rls_remaining_tenant_tables`) tem cinco blocos
  `DO $$ IF EXISTS (SELECT 1 FROM pg_tables ...)` que fazem no-op silencioso se a tabela
  não existir no momento em que a migration roda — e há drift conhecido de schema/migration
  entre ambientes (ver `docs/runbooks/migration-baseline-recovery.md`). Isso significa que
  CI, staging e produção podem aplicar a mesma migration e terminar com contagens
  diferentes de tabelas efetivamente policiadas. Antes do flip em cada ambiente, rode a
  query de catálogo ao vivo (a mesma que `lib/inngest/isolation-audit.ts` usa) **naquele
  ambiente específico** e trate o número que ela retornar como a verdade daquele ambiente —
  não copie o número medido em dev/staging para produção sem checar de novo:
  ```sql
  WITH candidates AS (
    SELECT DISTINCT c.relname
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
      AND a.attname = 'tenantId'
      AND a.attnum > 0
      AND NOT a.attisdropped
    -- Tables scoped through a parent FK instead of their own tenantId
    -- column (subquery-based policy) — keep this list in sync with
    -- INDIRECTLY_SCOPED_TABLES in lib/inngest/isolation-audit.ts.
    UNION
    SELECT unnest(ARRAY['BillingSyncCursor','RiskOKR','ThemeART',
                         'TaskAssignee','RetroVote','SyncLog'])
  )
  SELECT c.relname
  FROM pg_class c
  JOIN candidates cd ON cd.relname = c.relname
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind = 'r'
    AND (
      c.relrowsecurity = false
      OR c.relforcerowsecurity = false
      OR NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
      )
    )
  ORDER BY c.relname;
  ```
  Uma lista vazia é o único resultado aceitável antes de prosseguir para a Seção 3.

- [ ] **A tenant "system" (id `'system'`, migration `20260728020000_system_tenant`)
  existe no banco e precisa ser tratada como infraestrutura, não como cliente.** Ela existe
  para que `lib/inngest/isolation-audit.ts` (e outros escritores de `AuditLog` com ator do
  tipo sistema) tenham um `tenantId` válido para gravar — sem ela, toda escrita de auditoria
  do sistema falha com violação de FK (era exatamente o bug que esta task consertou). A
  migration `20260728030000_system_tenant_marker` adicionou `Tenant.isSystem` (boolean,
  default `false`, `true` só nesta linha) e trocou o `slug` de `'system'` para
  `'__system__'` para não reservar permanentemente uma palavra comum contra um cliente
  real. **Todo código que lista tenants para exibição externa — admin org list, export de
  billing, CSV de clientes — deve filtrar `isSystem = false`.** Hoje nenhum código de
  produção chama `tenant.findMany()` sem esse filtro (verificado em 2026-07-28), então não
  há vazamento ativo, mas nada impede que o próximo relatório adicionado inclua "System /
  plano ORBIT" como se fosse um tenant pagante. Se o flip revelar um consumidor de
  `tenant.findMany()`/`tenant.findFirst()` sem esse filtro, corrija-o antes de prosseguir.

## 3. Trocar `DATABASE_URL` por ambiente

Depois que o role existe e os grants foram aplicados **e validados** (seção 4), troque a
string de conexão em cada ambiente, um de cada vez, fora de horário de pico:

1. **Dev local** (`apps/app/.env.local`): trocar o usuário/senha na `DATABASE_URL`
   apontando para `cosmos_app` em vez de `postgres`. Rodar `pnpm dev` e testar login +
   uma tela que lê dados (ex. board de épicos) antes de seguir para staging.
2. **Staging**: mesma troca na variável de ambiente do provedor (Vercel/Railway). Deploy
   e smoke test.
3. **Produção**: só depois de staging validado. Trocar a variável de ambiente, redeploy,
   observar erros de conexão/permissão nos primeiros minutos (logs de aplicação +
   `pg_stat_activity`).

Importante: `prisma migrate deploy` (CI/CD) continua usando uma `DATABASE_URL` separada,
apontando para um role com privilégio de alterar schema (o `postgres` atual, ou um role
de migração dedicado). Não aponte o pipeline de migrations para `cosmos_app` — ele não
tem `CREATE`/`ALTER`/`DROP`.

## 4. Como verificar depois

A consulta que teria pego este problema antes — rode com qualquer role que tenha acesso
a `pg_roles` (não precisa ser superusuário):

```sql
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolcanlogin
ORDER BY rolname;
```

Depois da troca, `current_user` das conexões da aplicação deve mostrar `cosmos_app`, com
`rolsuper = false` e `rolbypassrls = false`. Via Prisma/tsx (não há `psql` neste
ambiente — use o padrão de `apps/app/scripts/verify-seed.ts`):

```ts
const [row] = await prisma.$queryRawUnsafe<
  { current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]
>(`SELECT current_user, rolsuper, rolbypassrls
   FROM pg_roles WHERE rolname = current_user`);
```

Confirme também que as políticas passam a filtrar de fato: rode
`apps/app/__tests__/security/rls-effective.test.ts` com `RLS_ENFORCED=1`. Antes desta
troca ele falha (não há isolamento); depois dela, com a Task 5 aplicando as migrations de
RLS, ele deve passar.

## 5. Rollback

Se a aplicação não conseguir conectar (erro de autenticação, `permission denied for
table X`, etc.) depois da troca:

1. Reverta `DATABASE_URL` no ambiente afetado de volta para a connection string anterior
   (`postgres`). Isso é reversível instantaneamente — nenhum dado foi alterado, só a
   identidade de conexão.
2. Redeploy/restart do processo da aplicação para reler a variável de ambiente.
3. Investigue o grant que faltou (o erro do Postgres normalmente nomeia a tabela/operação)
   e adicione-o com `GRANT ... TO cosmos_app` antes de tentar a troca de novo.
4. O role `cosmos_app` em si não precisa ser removido durante o rollback — ele só fica
   sem uso até a próxima tentativa.

Não é necessário (nem desejável) reverter para `prisma migrate reset` ou `db push` em
nenhum momento deste processo — ambos destroem dados ou corrompem o ledger de migrations
(ver `docs/runbooks/migration-baseline-recovery.md`).

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

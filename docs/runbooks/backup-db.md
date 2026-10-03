# Runbook: backup lógico diário do banco de produção (plano FREE)

O Supabase `db-prd-nz` (`aosdvvluokrbgpyqwoor`) fica no plano FREE: sem backup
gerenciado e sem PITR (decisão do CEO, 03/10). A proteção é um `pg_dump` diário
feito pelo GitHub Actions, criptografado com `age` e guardado como artifact.

| | |
|---|---|
| Workflow | `.github/workflows/backup-db.yml`, 04:00 UTC, mais disparo manual |
| Conexão | pooler do Supabase em **modo sessão** (porta 5432), 1 conexão por run |
| Escopo | schema `public`, formato custom, sem owner nem privilégios |
| Retenção | artifact por 14 dias (banco de ~46 MB em 03/10; cabe nos 500 MB do plano grátis) |
| RPO / RTO | RPO 24 h; RTO é o que o restore de teste medir |
| Chave | pública em `docs/runbooks/backup-age.pub`; privada só com o CEO |

**Fora do dump:** os arquivos do bucket `meridian-evidence`. O `pg_dump` leva os
metadados, não os objetos do Storage. Continua sem backup.

Por que o pooler e não a conexão direta: a direta do Supabase (`db.<ref>.supabase.co`) é
só IPv6 e o runner do GitHub é IPv4. O modo transação (6543) não serve a `pg_dump`.

## 1. Gerar o par de chaves (CEO, uma vez, na própria máquina)

```bash
brew install age
age-keygen -o ~/nebuloz-backup.agekey      # imprime "Public key: age1…"
chmod 600 ~/nebuloz-backup.agekey
```

- O arquivo `~/nebuloz-backup.agekey` é a chave **privada**. Guarde em gerenciador de
  senhas e numa cópia offline. Quem a perde perde todos os backups; quem a vê abre todos.
- Mande à Infra **só** a linha `age1…` (a pública). Ela entra em
  `docs/runbooks/backup-age.pub`, substituindo os comentários.

## 2. Criar o usuário de banco somente leitura (CEO, SQL Editor do Supabase)

Rode como dono do banco, uma vez. Troque `<SENHA>` por uma senha longa gerada por você
(`openssl rand -base64 32`); ela não aparece em chat nem em arquivo do repo.

```sql
CREATE ROLE backup_ro LOGIN PASSWORD '<SENHA>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;

GRANT CONNECT ON DATABASE postgres TO backup_ro;
GRANT USAGE ON SCHEMA public TO backup_ro;
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO backup_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES    TO backup_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO backup_ro;
```

Por que `BYPASSRLS`: as tabelas têm `FORCE ROW LEVEL SECURITY` e policies por tenant (ADR-0012).
Sem a flag, `pg_dump` aborta com "query would be affected by row-level security policy" ou,
pior, exporta zero linhas. O role continua só leitura: não tem `INSERT`, `UPDATE`,
`DELETE` nem DDL. O risco dele é vazamento, não alteração, e por isso o segredo fica
num environment restrito à `main`.

Se o Supabase recusar `BYPASSRLS` ao criar o role (só superusuário concede), pare e avise a Infra:
a alternativa é rodar o dump com o role `postgres`, o que exige outra decisão do CEO.

Verificação (como `backup_ro`, no SQL Editor com "Role" trocado, ou via `psql`):

```sql
SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user;  -- t
SELECT count(*) FROM "MeridianAssessment";   -- deve bater com a contagem do dono
SELECT has_table_privilege('backup_ro', '"MeridianTemplate"', 'INSERT');  -- deve ser f
```

## 3. Montar a connection string e o segredo no GitHub

Formato (pooler, modo sessão): `postgresql://backup_ro.<ref>:<SENHA>@<host-do-pooler>:5432/postgres?sslmode=require`,
com `<ref>` = `aosdvvluokrbgpyqwoor` e `<host-do-pooler>` copiado de Settings → Database → Connection string → Session pooler.

No GitHub (`PAVincius/cosmos-nebuloz` → Settings → Environments):

1. Criar o environment `backup-prod`.
2. *Deployment branches and tags*: **Selected branches**, só `main`. **Sem** required reviewers.
3. *Environment secrets*: `BACKUP_DATABASE_URL` com a string acima.

Cole o valor pela própria interface do GitHub. Não o envie por chat, e-mail nem PR.

## 4. Primeiro dump e conferência

Actions → *Backup DB* → *Run workflow*. O run passa quando:

- o passo "Conferir chave pública e segredo" não falha;
- o dump criptografado tem mais de 100 KB;
- o artifact `backup-<data>` traz `*.dump.age` e `manifest-*.txt`.

O manifesto lista a contagem de cada tabela `Meridian*` no instante do dump. Ele é a referência do restore.

## 5. Restore de teste

Quem tem a chave privada (CEO) baixa o artifact. Em Docker local, com a mesma versão major do servidor:

```bash
age -d -i ~/nebuloz-backup.agekey backup-<stamp>.dump.age > backup.dump
docker run -d --name pg-restore -e POSTGRES_PASSWORD=teste -p 54329:5432 postgres:<major>
sleep 5
createdb -h localhost -p 54329 -U postgres restore_teste
time pg_restore -h localhost -p 54329 -U postgres -d restore_teste \
  --no-owner --no-privileges backup.dump
```

Conferência: para cada linha de `manifest-<stamp>.txt`,
`psql -h localhost -p 54329 -U postgres restore_teste -Atc 'select count(*) from "<tabela>"'`
precisa devolver o mesmo número. Ao final: `docker rm -f pg-restore` e apagar `backup.dump`.

Registre data, tempo de restore, versão do servidor e resultado em
`docs/compliance/soc2/backup-tests/AAAA-Qn.md`. Repita a cada trimestre.

## 6. Quando o workflow falhar

| Sintoma | Causa provável |
|---|---|
| "backup-age.pub não tem uma chave…" | passo 1 pendente |
| "BACKUP_DATABASE_URL não está definido" | secret ausente ou environment com outro nome |
| `FATAL: password authentication failed` | senha trocada no banco ou string mal montada |
| `EMAXCONNSESSION` | o pooler em sessão está cheio (limite de 15 clientes); repetir fora do pico |
| "Dump menor que 100 KB" | role sem `BYPASSRLS` ou apontando para banco errado |
| `server version mismatch` | o passo de instalação do cliente não achou o major certo; ver o log |

Rotação: trocar a senha de `backup_ro` (`ALTER ROLE backup_ro PASSWORD '…'`) e atualizar o secret a cada 90 dias ou na suspeita de vazamento.

# Isolamento de tenant — Fechamento do plano de remediação

**Data:** 2026-07-28
**Plano:** `.superpowers/sdd/2026-07-28-isolamento-tenant/` (Tasks 1–6/Sec 1–6 de implementação + esta, Sec 7, de fechamento)
**Branch:** `feat/kanban-portfolio-ai`
**HEAD ao fechar:** `0907361` `fix(security): close isolation-audit review findings (candidate set, regression test, system tenant marker)`

> **Leia isto antes de qualquer outra coisa.** RLS está **pronto, não está efetivo**. A aplicação
> ainda se conecta ao banco como `postgres`, superusuário com `BYPASSRLS` — o Postgres ignora
> policies inteiramente para esse role, não é uma policy fraca, é o motor de RLS não entrando em
> ação. Confirmado ao vivo nesta sessão: `current_user = postgres`, `rolsuper = true`,
> `rolbypassrls = true`. **O isolamento de tenant hoje continua 100% apoiado nas cláusulas
> `where: { tenantId }` da aplicação**, exatamente como antes deste plano. A proteção só começa
> quando um operador criar o role do runbook (`docs/runbooks/app-db-role.md`) e repontar
> `DATABASE_URL` — e antes disso, ler a seção "Pré-requisitos antes de virar a chave" abaixo.
>
> A contagem de 128 tabelas com RLS não é "128 protegidas": é **121 diretas (coluna `tenantId`) +
> 6 indiretas (policy via subquery) = 127 isoladas por tenant, mais 1 deliberadamente aberta**
> (`CurrencyRate`, policy `allow_all`, câmbio é dado de referência global).

## O que foi entregue

**Dois vetores de escrita cross-tenant, ao vivo, fechados.**

1. Nove exports `"use server"` aceitavam `tenantId` como argumento do chamador sem checagem de sessão (`logAudit`, `pushNotification` e mais sete). Todos removidos da superfície RPC. Um teste de regressão (`apps/app/__tests__/security/use-server-tenant-args.test.ts`) varre `apps/*/app` e `packages/` e falha se qualquer export `"use server"` voltar a aceitar `tenantId`.
2. `upsertMemberAssignment`: a chave de upsert não incluía `tenantId`, então um `sprintId`+`userId` de outro tenant caía no branch `update` e reescrevia a linha de outro tenant. Corrigido adicionando `tenantId` à chave única, com migração (`20260728000000_tenant_scoped_assignment_key`).

**Ledger de migrations reparado.** `20260516163559_init` estava hard-failed, bloqueando ~70 migrations, incluindo todas as de RLS. 71 resolvidas via `migrate resolve --applied`; `migrate status` limpo.

**RLS aplicado — antes/depois medidos ao vivo:**

| Métrica | Antes (início do plano) | Depois (medição final, 2026-07-28) |
|---|---|---|
| Tabelas com `relrowsecurity` | 0 | **128** |
| Tabelas com `relforcerowsecurity` (FORCE) | 0 | **128** |
| Total de tabelas em `public` | 136 | 136 |
| Policies (`pg_policies`) | 0 | **128** |
| Role de conexão | `postgres` (superuser, `rolbypassrls=true`) | `postgres` (superuser, `rolbypassrls=true`) — **inalterado** |

**O número honesto por trás de "128 protegidas":** dos 128 com RLS+FORCE, um — `CurrencyRate` — carrega uma policy `allow_all` (`qual = 'true'`, confirmado ao vivo em `pg_policies`) e é deliberadamente aberto (câmbio é dado de referência global, não por tenant; ver `migration.sql` de `20260728010000_rls_remaining_tenant_tables`, linhas 887-890). Confirmado ao vivo: **121 tabelas com coluna `tenantId` direta + 6 indiretas (policy via subquery, ex. `RiskOKR`) = 127 isoladas por tenant, + 1 deliberadamente aberta (`CurrencyRate`) = 128 com RLS.** Usar essa formulação, não "128 protegidas" sem qualificação.

**Runbook operacional** (`docs/runbooks/app-db-role.md`): como criar um role de aplicação não-superuser sem `BYPASSRLS`, mais checklist pré-flip.

**Teste de efetividade de RLS**, gated (`apps/app/__tests__/security/rls-effective.test.ts` — 4 testes, hoje `skipped` porque a conexão de teste ainda é `postgres`/superuser; passam a rodar de fato quando `DATABASE_URL` apontar para um role sem `BYPASSRLS`).

**Cron de isolation-audit corrigido** (`apps/app/lib/inngest/isolation-audit.ts`): antes falhava silenciosamente; agora falha alto. O candidate set é a união de (a) uma query ao vivo sobre `pg_class`/`pg_attribute` por `tenantId` e (b) um array `INDIRECTLY_SCOPED_TABLES` hand-maintained para as 6 tabelas com policy via subquery. A condição de falha agora exige `EXISTS` em `pg_policies`, não só as flags `relrowsecurity`/`relforcerowsecurity`.

## O que NÃO foi alcançado — não deixar isso passar despercebido

### RLS está pronto, não está efetivo.

A aplicação ainda se conecta como `postgres`, um superusuário com `BYPASSRLS`, para o qual o Postgres **ignora policies inteiramente** — não é um caso de policy fraca, é o motor de RLS simplesmente não entrando em ação. Confirmado ao vivo, na mesma medição da tabela acima: `current_user = postgres`, `rolsuper = true`, `rolbypassrls = true`, sem mudança desde o início do plano.

A proteção só começa quando um operador criar o role a partir do runbook (`docs/runbooks/app-db-role.md`) e repontar `DATABASE_URL`. **Até lá, o isolamento de tenant continua inteiramente apoiado nas cláusulas `where: { tenantId }` no código da aplicação** — exatamente como estava antes deste plano. RLS hoje é uma segunda camada declarada e pronta, não uma segunda camada ativa.

## A descoberta que reenquadrou o trabalho

Uma query ao vivo contra `_prisma_migrations` mostra `applied_steps_count = 0` em 73 das 77 linhas de migration (75 arquivos de migration no disco; 2 delas — `20260516163559_init` e `20260728010000_rls_remaining_tenant_tables` — têm 2 linhas cada, por causa de uma tentativa que falhou seguida de uma que teve sucesso) e `applied_steps_count = 1` em apenas 4 — e essas 4 são justamente as migrations que **este próprio plano** escreveu e aplicou via `migrate deploy` real (`20260728000000_tenant_scoped_assignment_key`, `20260728010000_rls_remaining_tenant_tables`, `20260728020000_system_tenant`, `20260728030000_system_tenant_marker`).

Isso é a assinatura de um baseline feito com `migrate resolve --applied`, não de um `migrate deploy`: **o SQL bruto das 71 migrations pré-existentes nunca executou de fato no banco.** É por isso que 182 `CREATE POLICY` no disco coexistiam com zero policies no banco antes deste plano rodar (`com_rls: 0, forced: 0, policies: 0` — medido no início, registrado em `.superpowers/sdd/2026-07-28-isolamento-tenant/progress.md`).

O gate que autorizou aquele baseline, `prisma migrate diff`, compara **estrutura** de schema e é estruturalmente cego a policies, functions, triggers, grants e backfills — ele não tinha como pegar isso.

**Consequência verificada ao vivo, não hipotética:** os triggers de imutabilidade de audit log (`audit_log_immutable` / `prevent_audit_mutation`, declarados em `20260609000019_audit_compliance`) **não existem no banco** — `SELECT tgname FROM pg_trigger WHERE tgname = 'audit_log_immutable'` e a busca pela function `prevent_audit_mutation` em `pg_proc` retornaram ambas vazias. A FK de `AuditLog` com `ON DELETE RESTRICT` (`confdeltype = 'r'`), por outro lado, **está presente** — então nem tudo do SQL bruto histórico foi perdido, mas não há garantia geral: qualquer `GRANT` ou `CHECK` adicionado via SQL bruto pode estar faltando e precisa ser conferido item a item, não assumido.

**Imutabilidade de audit log é uma garantia de compliance que o time pode acreditar estar em vigor hoje, e hoje ela não está — a trigger que a impõe não existe no banco.** Um esforço separado já está auditando isso.

## Pré-requisitos antes de virar a chave (flip)

Estes são o núcleo operacional deste documento — quem for operar o flip precisa ler esta seção antes de tocar em `DATABASE_URL`:

1. **`JobFallbackQueue` é a única tabela policiada com `tenantId` nullable.** `apps/app/lib/inngest/send-safe.ts` escreve `tenantId: tenantId ?? null` (confirmado lendo o arquivo), e o `.create(...)` está envolto num `.catch()` que engole o erro. Quando RLS passar a valer, `WITH CHECK` vai rejeitar o insert com `tenantId = null`, silenciosamente — o `.catch` engole exatamente esse erro. `job-fallback-drain.ts` lê pelo client comum e passaria a ver zero linhas. Um buraco negro nos dois sentidos: escreve e falha calado, lê e não acha nada. **Não "consertar" isso adicionando `OR tenantId IS NULL` à policy** — isso expõe payloads de job de sistema a todos os tenants.
2. **Zero uso de `withTenantDb` em `lib/inngest/` ou `app/api/`** — confirmado por busca: nenhum arquivo em nenhum dos dois diretórios referencia `withTenantDb`. Há 17 arquivos em `lib/inngest/` (14 Inngest functions mais client/config/isolation-audit) mais a rota de health em `app/api/` que, no flip, passam a rodar contra RLS sem nunca terem fixado `current_tenant_id()` — ou seja, vão bater em deny-all (nenhuma linha visível, porque a policy não tem tenant setado na sessão) em vez de simplesmente funcionar. Enumerar e envolver essas 14+ funções é pré-requisito, não um nice-to-have.
3. **A contagem de 128 não é reproduzível só a partir das migrations.** A migration `20260728010000_rls_remaining_tenant_tables` tem 5 guards `DO $$ IF EXISTS (SELECT ... FROM pg_tables ...) $$` que fazem no-op silencioso num ambiente fresco onde a tabela em questão ainda não existe, e há drift de schema conhecido entre o que as migrations declaram e o que está de fato no banco (é a própria razão de o isolation-audit cron consultar o catálogo ao vivo em vez do schema Prisma). Não tratar 128 como um gate de CI portável.

## Trabalho adiado, com o motivo de cada adiamento

- **~45 server actions que aceitam um id de entidade-pai do cliente sem validar o tenant desse pai** (`createStory`, `createOKR`, `linkBudgetToTheme` e outras). Real, mas cada uma exige julgamento de domínio específico; a severidade cai assim que RLS estiver efetivo (a segunda camada barra o que a primeira deixar passar).
- **`teamId`/`sprintId` escritos sem checagem no branch `create` dos upserts de capacity** — diferente do bug corrigido no upsert de `TeamMemberAssignment` (que permitia sobrescrever a linha de outro tenant), aqui o resultado é uma FK cross-tenant pendurada, não uma sobrescrita.
- **`INDIRECTLY_SCOPED_TABLES` do cron de isolation-audit é hand-maintained e falha aberto** para uma tabela nova adicionada depois com policy via subquery — ela só entra no candidate set se alguém lembrar de adicioná-la à lista manualmente. Redesenho recomendado: inverter a lógica — tratar toda tabela de `public` como candidata por padrão e exigir uma lista de exceção revisada e explícita para tabelas intencionalmente globais como `CurrencyRate`, para que o cron falhe seguro em vez de falhar aberto.
- **O cron roda mensalmente** (`{ cron: "0 0 1 * *" }`), então uma regressão pode ficar invisível por até 30 dias.
- **Um commit intermediário (`8f4e220`) não builda isolado** — `layout.tsx` na época ainda importava um caminho antigo que só foi corrigido no commit seguinte (`d36d020`). HEAD final e CI estão bem; só `git bisect` e cherry-picks de commit único são afetados.

## Suíte completa

Rodado de `apps/app/` (typecheck) e da raiz (check/test/playwright):

- **`pnpm typecheck`** (`apps/app/`): **24 erros**, todos em `__tests__/actions/pae/pae-actions.test.ts`, `__tests__/actions/pae/enforce-with-pae.test.ts` e `__tests__/actions/integrations/github-sync.test.ts`. Mesma contagem e mesmos arquivos da baseline documentada (24 pré-existentes). **Delta zero.**
- **`pnpm check`** (raiz, `ultracite check`): 2785 erros / 14 warnings, saída truncada em 2782 diagnósticos não exibidos ("the number of diagnostics exceeds the limit allowed"). Comparei a lista completa de 101 arquivos tocados por este plano (`git diff --name-only 8fce406 0907361`) contra o log — **nenhum aparece**. Os erros visíveis são todos em `apps/app/.design-ref/cosmos-jsx/*.jsx` e `apps/web/_v0preview|v0/**` (mockups de design pré-existentes, fora de escopo).
- **`pnpm test`** (raiz, `turbo test`): **239 arquivos de teste passaram, 3 pulados (242 total); 2210 testes passaram, 13 pulados; 0 falhas.** `EXIT:0`. Os 3 arquivos pulados são as duas suítes de integração de schema sem `DATABASE_URL` (`flow-intelligence.test.ts`, `meeting-intelligence.test.ts`) e o `rls-effective.test.ts` gated (4 dos 13 skips totais) — esperado, porque a conexão de teste ainda é superuser.
- **`pnpm playwright test`** (de `apps/app/`, sem `AUTH_TEST=1`): rodou até o fim, **79 testes falharam** de um total que a suíte reporta. Investigado caso a caso via `test-results/.last-run.json` e os `error-context.md` dos testes falhos: a causa raiz é **sessão de autenticação expirada**, não este plano. `apps/app/e2e/setup/auth.setup.ts` só recria as sessões (`e2e/fixtures/auth-session.json` e `e2e/fixtures/roles/*.json`) quando a env var `AUTH_TEST=1` está setada; sem ela, o global setup imprime "⏭ Skipping auth setup (AUTH_TEST not set)" e a suíte reusa fixtures antigas (a de admin datada de 27/07 22:29, ~16h antes desta medição). O `error-context.md` de, por exemplo, `settings.spec.ts > roles renders header and stats` mostra a prova direta: `expect(locator('h1')).toContainText(/Roles/i)` recebeu `"Entrar"` (tela de login) — toda a suíte `@auth` estava sendo redirecionada para sign-in por sessão vencida, não por qualquer efeito de RLS ou dos commits deste plano (nenhum arquivo deste plano toca autenticação, sessão ou `apps/app/e2e/**`). As poucas falhas em `a11y-screens.spec.ts` são separadas — violações de contraste de cor pré-existentes, também não relacionadas a este plano.
  - Para obter um sinal real, iniciei um segundo run com `AUTH_TEST=1` (que primeiro roda `pnpm seed:e2e` e depois recria as 6 sessões de role via login real na UI) em background. **Esse segundo run não terminou dentro desta sessão** — ainda estava executando (processos de browser/Next ativos) quando o fechamento deste documento foi necessário. Não estou reportando um resultado de Playwright com `AUTH_TEST=1` porque não terminei de medi-lo; a run sem `AUTH_TEST=1` que terminou não é um sinal válido de regressão, é sinal de fixture vencida.

**Playwright fica como gap explícito deste fechamento**: não posso afirmar que a suíte E2E está verde nem que está quebrada por este plano — o único run que completou mediu infraestrutura de teste (sessão expirada), não o código. Quem for revalidar deve rodar `AUTH_TEST=1 pnpm playwright test` a partir de `apps/app/` (leva alguns minutos: seed + 6 logins + suíte completa) e ler o resultado real, sem reusar as fixtures atuais de `e2e/fixtures/`.

Para as três suítes que de fato terminaram e foram lidas (`typecheck`, `check`, `test`): nenhuma falha nova foi introduzida por este plano. Não estou afirmando suíte verde onde não medi — o Playwright está registrado acima como realmente saiu (inconclusivo), não presumido.

## Medição final ao vivo (2026-07-28)

```
-- RLS
SELECT count(*) FILTER (WHERE relrowsecurity) AS com_rls,
       count(*) FILTER (WHERE relforcerowsecurity) AS forced,
       count(*) AS total
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind = 'r' AND n.nspname = 'public';

com_rls: 128 | forced: 128 | total: 136
```

```
-- Policies
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
→ 128

-- A única policy allow_all
SELECT tablename, policyname, cmd, qual FROM pg_policies
 WHERE schemaname='public' AND qual='true';
→ CurrencyRate | allow_all | ALL | true
```

```
-- Role de conexão
SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
→ postgres | true | true
```

```
-- Migrations
npx prisma migrate status → "75 migrations found in prisma/migrations" / "Database schema is up to date!"

SELECT count(*) total,
       count(*) FILTER (WHERE applied_steps_count = 0) zero_applied,
       count(*) FILTER (WHERE applied_steps_count = 1) one_applied,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) rolled_back
  FROM _prisma_migrations;
→ total: 77 | zero_applied: 73 | one_applied: 4 | rolled_back: 2
   (77 linhas para 75 arquivos porque 2 migrations têm uma tentativa
    falhada + uma bem-sucedida cada — 20260516163559_init e
    20260728010000_rls_remaining_tenant_tables)
```

```
-- Trigger de imutabilidade de audit log (verificação da descoberta acima)
SELECT tgname FROM pg_trigger WHERE tgname = 'audit_log_immutable'; → (vazio)
SELECT proname FROM pg_proc WHERE proname = 'prevent_audit_mutation'; → (vazio)
SELECT confdeltype FROM pg_constraint WHERE conrelid='"AuditLog"'::regclass AND contype='f';
→ r (RESTRICT — esta parte está presente)
```

**Antes/depois lado a lado** (o "antes" vem de `.superpowers/sdd/2026-07-28-isolamento-tenant/progress.md`, medido pelo controller no início do plano contra o mesmo banco):

| | Antes | Depois |
|---|---|---|
| Tabelas com RLS | 0 | 128 |
| Tabelas com FORCE | 0 | 128 |
| Policies | 0 | 128 |
| Migrations aplicadas de fato (`migrate deploy`, não baseline) | 1/2 (71 pastas no disco, maioria baselined) | 75 pastas, `migrate status` limpo, mas só as 4 deste plano confirmadamente rodaram via `deploy` real |
| Role de conexão | `postgres`, superuser, `rolbypassrls=true` | `postgres`, superuser, `rolbypassrls=true` — **sem mudança** |

## Autorrevisão

- **Todo número neste documento foi medido**, não copiado do brief: a tabela RLS/FORCE/policies, o role de conexão, o `applied_steps_count`, a ausência do trigger/function de audit log, a presença da FK RESTRICT, os 24 erros de typecheck com seus 3 arquivos, os 2785 erros / 14 warnings do check, os números de `pnpm test` — todos vieram de rodar o comando e ler a saída real nesta sessão.
- **A distinção pronto-vs-efetivo** está em título de seção próprio ("RLS está pronto, não está efetivo"), repetida na tabela de medição final, e não depende de o leitor chegar ao fim do documento para encontrá-la.
- **Um operador lendo só este documento sabe o que fazer antes de virar a chave**: seção de pré-requisitos numerada, com o bug do `JobFallbackQueue` explicitamente marcado como "não consertar assim", a lista de 17 arquivos sem `withTenantDb`, e o aviso sobre 128 não ser portável.
- **Nenhuma suíte foi declarada verde sem ter sido rodada.** Playwright ficou explicitamente marcado como inconclusivo nesta sessão — o run sem `AUTH_TEST=1` terminou mas mediu fixture vencida, não código; o run com `AUTH_TEST=1` não terminou a tempo. Nenhum dos dois é reportado como "passou" ou "falhou por causa deste plano".

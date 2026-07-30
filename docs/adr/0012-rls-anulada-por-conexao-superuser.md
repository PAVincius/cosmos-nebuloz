# ADR-0012 — RLS anulada pela conexão como superuser

**Status**: Accepted · **risco aberto — pré-existente, agravado pelo Charter**
**Data**: 2026-07-28
**Contexto de origem**: `verify-charter.ts` durante a verificação de NFR-1.1

## Contexto

`NFR-1.1` é categórico:

> Todo dado é tenant-scoped por **RLS em Postgres**. Nenhum isolamento apenas
> client-side.

A migration `20260728120000_charter_module` cumpre a parte declarativa: as 15
tabelas do Charter têm `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` e
policy `tenant_isolation` sobre `current_tenant_id()`. Verificado no banco:
15/15.

**E mesmo assim o isolamento não vale.** `verify-charter.ts` executa uma leitura
sem `app.tenant_id` e recebe as 12 linhas de casos de uso. A causa:

```
current_user = postgres · rolsuper = true · rolbypassrls = true
```

`FORCE ROW LEVEL SECURITY` obriga o **dono** da tabela a respeitar as policies,
mas não alcança quem tem `BYPASSRLS` — e superuser tem `BYPASSRLS` implícito. A
aplicação conecta como `postgres`, então toda policy é ignorada em tempo de
execução.

Isto **não foi introduzido pelo Charter**: `DATABASE_URL` já apontava para
`postgres` e todas as tabelas do Cosmos estão na mesma situação. O que o Charter
fez foi construir o verificador que expõe o problema.

## Decisão

**Não corrigir neste escopo, e registrar o risco em vez de silenciá-lo.**

Três coisas mudam:

1. `verify-charter.ts` ganha uma verificação explícita — "papel de conexão NÃO
   tem BYPASSRLS" — que **falha** enquanto a conexão for superuser. O script sai
   com código 1, então serve de gate se plugado em CI.
2. A mensagem da verificação de vazamento diz que a causa é o BYPASSRLS, não
   policy ausente. Sem isso, quem lê o log conclui a coisa errada.
3. `withTenantDb()` continua sendo obrigatório em toda leitura e escrita do
   Charter. Ele já filtra por `tenantId` na query além de setar o contexto de
   sessão — é o que de fato isola hoje.

A correção verdadeira é operacional, não de código: criar um papel de aplicação
sem `SUPERUSER` e sem `BYPASSRLS`, dar-lhe `SELECT/INSERT/UPDATE` nas tabelas
(sem `UPDATE`/`DELETE` em `AuditLog`, ver ADR-0009) e apontar `DATABASE_URL` para
ele. Manter `postgres` apenas para migrations.

## Alternativas consideradas

**Criar o papel de aplicação agora, nesta entrega.** É a correção certa e é
barata em SQL. Rejeitada por escopo: mudar o papel de conexão afeta **todo o
Cosmos**, não só o Charter — migrations, seeds, scripts de manutenção, jobs
Inngest, e o pipeline de deploy. Uma mudança dessa amplitude entrando de carona
numa entrega de módulo é como se quebra produção num domingo.

**Deixar a verificação passar e anotar no relatório.** Rejeitada: um verificador
que passa comunica "está isolado". Numa ferramenta de auditoria, um falso verde
sobre isolamento de tenant é pior que vermelho nenhum.

**Confiar no filtro por `tenantId` das queries e remover a promessa de RLS do
SRD.** Rejeitada: `withTenantDb` de fato filtra, mas basta uma query esquecer o
`where` para vazar. RLS existe justamente para que o esquecimento não seja
suficiente. Rebaixar a promessa por não conseguir cumpri-la agora seria trocar
uma dívida visível por um requisito enfraquecido.

## Consequências

- **`verify-charter.ts` falha hoje, de propósito**, em duas verificações. Isso é
  o comportamento desejado até o papel de aplicação existir. Não "consertar"
  afrouxando a checagem.
- O isolamento efetivo do Charter em dev depende de `withTenantDb` e do filtro
  por `tenantId` nas queries — que estão em todas as actions, mas são disciplina,
  não garantia.
- Um bug de query que omita `tenantId` **vaza entre tenants hoje**. Com o papel
  correto, a mesma query voltaria vazia.
- Impacto além do Charter: vale para todas as tabelas do Cosmos.
- Para fechar: papel `cosmos_app` sem `BYPASSRLS`, grants por tabela,
  `DATABASE_URL` apontando para ele, `postgres` reservado a migration. Depois,
  plugar `verify:charter` no CI.

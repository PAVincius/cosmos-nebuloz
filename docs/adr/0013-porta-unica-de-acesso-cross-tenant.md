# ADR-0013 — Porta única de acesso cross-tenant

**Status**: Accepted
**Data**: 2026-07-31

## Contexto

Todo acesso a dado no produto passa por `withTenantDb(tenantId)`: ele seta
`app.tenant_id` na sessão e filtra a query pelo tenant. Isso é o que sustenta o
isolamento hoje (ver ADR-0012 sobre a RLS não valer enquanto a conexão for
superuser).

O back-office de clientes precisa do oposto: listar todos os tenants, ver o que
cada um contratou. É a primeira necessidade legítima de leitura cross-tenant no
sistema.

## Decisão

Uma porta única e nomeada: `platformDb`, em `packages/provisioning`.

- Importada apenas por `packages/provisioning` e `apps/backoffice`.
- Toda listagem de cliente filtra `isSystem = false` — o tenant interno não é
  cliente, e a coluna existe exatamente para isso.
- Escrita em tabela do Charter continua indo por `withTenantDb`.

Um teste falha se `apps/app` importar `platformDb`.

## Consequências

Acesso cross-tenant fica greppável: uma importação, um lugar. Quem revisar um PR
que amplia essa superfície vê o import e sabe o que perguntar.

Quando o papel de aplicação sem `BYPASSRLS` existir (ADR-0012), a fronteira
deixa de ser convenção: o app do cliente conecta com um papel que não enxerga
outros tenants, o back-office com um que enxerga.

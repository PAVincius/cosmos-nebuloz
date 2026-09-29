# ADR-0018 — `Tenant.type` substitui `isInternalTenant` e `isSystem`

**Status**: Accepted
**Data**: 2026-09-27

## Contexto

`Tenant` hoje carrega dois booleanos independentes:
`isSystem` (`packages/database/prisma/schema/tenant.prisma:36`, tenant técnico
de auditoria, nunca aparece em relatório de cliente) e `isInternalTenant`
(linha 42, dogfood real da Nebuloz — hoje só o tenant que vê o catálogo
pós-login em vez de ir direto pro produto contratado). Nenhum dos dois
descreve "cliente de teste" nem "demo comercial" — esses hoje só existem
como convenção de nome de slug (`docs/produto/modelo-de-contas/as-is.md`),
sem campo que o código possa checar.

`docs/produto/modelo-de-contas/proposta.md` (Morgana, e0f8a647) propôs um
enum de tipo de conta como base da Fase 1 (lançamento por coorte, spec 008
absorvida) e pediu decisão do CEO sobre o modelo e o mapeamento de tenants
existentes. O CEO aprovou o modelo, a ordem das fases e o mapeamento
sugerido em 2026-09-27 (sessão de PO, via `maestri ask`).

## Decisão

`Tenant.type` — enum `TenantType { CLIENTE, INTERNA, TESTE, DEMO, SISTEMA }`
— substitui os dois booleanos. Mapeamento aprovado para os tenants
existentes na proposta:

| Slug | Tipo |
|---|---|
| `nebuloz` | INTERNA (conta oficial da Nebuloz) |
| `nebula` | TESTE (laboratório atual) |
| `dev-teste` | TESTE |
| `nebuloz-novo-cliente` | TESTE |
| `medcore` | DEMO |
| `__system__` | SISTEMA |

Qualquer tenant novo de cliente pagante nasce `CLIENTE` (default do enum).

Migration de dado (não deste ADR, task da Fase 1 em `specs/010-*`): linhas
com `isSystem = true` viram `SISTEMA`; a linha com `isInternalTenant = true`
vira `INTERNA`; as demais linhas hoje `isSystem = false` e
`isInternalTenant = false` recebem `CLIENTE`, exceto os slugs da tabela acima
que recebem `TESTE`/`DEMO` por migration de dado explícita (não há regra
automática que distinga TESTE/DEMO de CLIENTE — é decisão manual, como já é
hoje para `isInternalTenant`).

## Alternativas rejeitadas

**Manter os dois booleanos e adicionar um terceiro (`isTeste` ou
`isDemo`).** Rejeitado — é o mesmo problema que motivou a proposta: N
booleanos independentes sem exclusividade mútua imposta pelo schema, e o
código já teria que verificar "nenhum dos outros é true" pra inferir
`CLIENTE`. Um enum fecha a exclusividade no próprio tipo.

**Não migrar `isSystem`/`isInternalTenant` agora, só adicionar `type` em
paralelo.** Rejeitado pelo modelo-alvo da proposta: manter os três
mecanismos soltos (dois booleanos + enum novo) adia o ganho que a Fase 1
promete ("3 mecanismos soltos viram 1") e cria uma segunda fonte de
verdade que pode divergir.

## Consequências

- Todo código que hoje lê `tenant.isSystem` ou `tenant.isInternalTenant`
  precisa migrar para `tenant.type === "SISTEMA"` /
  `tenant.type === "INTERNA"` — inventário desse código fica para a spec da
  Fase 1 (`specs/010-*`), não deste ADR.
- `resolvePostLoginDestination` / `isTenantInterno`
  (`apps/app/app/(authenticated)/_lib/resolve-post-login-destination.ts:16-22`)
  é o ponto de leitura hoje de `isInternalTenant` — vira o primeiro
  candidato a migrar, já que decide o destino pós-login/pós-troca de conta
  (Fase 0, `specs/009-conta-ativa-visivel`).
- Lançamento por coorte (spec 008, pausada em `48fb2ecc`) passa a filtrar por
  `Tenant.type` em vez da lista solta que tinha — resolve a pausa.
- Migration de schema (Prisma) e de dado ficam sob responsabilidade de
  Alicerce na Fase 1, não deste registro.

## Referências

- `docs/produto/modelo-de-contas/proposta.md` — tabela do modelo-alvo e
  fases propostas
- `docs/produto/modelo-de-contas/as-is.md` — estado atual de
  `isSystem`/`isInternalTenant`
- ADR-0013 — porta única de acesso cross-tenant (invariante que a Fase 1 não
  pode quebrar)
- `specs/009-conta-ativa-visivel/` — Fase 0, primeiro consumidor da distinção
  INTERNA (destino pós-troca de conta)

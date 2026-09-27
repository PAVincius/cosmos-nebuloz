# Data Model: Conta ativa sempre visível (Fase 0)

Sem migration nesta fase (Assumptions do spec.md). As três entidades abaixo
já existem; o que muda é como são lidas/gravadas, não a forma.

## Tenant (`packages/database/prisma/schema/tenant.prisma`)

Sem campo novo. Continua sendo o `name` já lido em cada `getShellData()` por
produto (ex. `apps/app/app/(meridian)/actions/shell.ts:29-33`).

## TenantMember (`packages/database/prisma/schema/tenant.prisma:418-431`)

| Campo | Tipo | Uso nesta fase |
|---|---|---|
| `id` | `String @id` | sem mudança |
| `tenantId` | `String` | filtro de leitura das contas da pessoa (sem cross-tenant, FR-014) |
| `userId` | `String` | filtro (`@@index([userId])` já existe — cobre o `orderBy` novo sem índice adicional) |
| `role` | `MemberRole` | exibido no seletor (mesmo padrão de `workspace-switcher.tsx:102`) |
| `createdAt` | `DateTime @default(now())` | **novo uso**: critério do fallback determinístico (FR-007/008) — `orderBy: { createdAt: "asc" }` na query de `requireTenantSession` |

Nenhum campo novo, nenhum índice novo.

## Session (better-auth, tabela gerenciada por `@repo/auth`)

| Campo | Uso nesta fase |
|---|---|
| `id` | chave de escopo para a correção de FR-010/011 (`session.update({ where: { id } })` em vez de `updateMany({ where: { userId } })`) |
| `token` | já usado por `switch-tenant/route.ts:42-45` para escopar a troca — mecanismo reusado, sem mudança |
| `activeTenantId` | campo já existente lido por `requireTenantSession`; grava a conta ativa por sessão — o contrato central desta fase inteira |

Sem alteração de schema — só de **quais filtros** as queries usam contra a
mesma tabela.

## Estado (não é uma entidade nova, é o fluxo do seletor)

```
[conta A ativa] --escolhe conta B no seletor--> [confirmação pendente]
[confirmação pendente] --cancela--> [conta A ativa]  (sem escrita)
[confirmação pendente] --confirma--> POST /api/auth/switch-tenant
  --membership OK--> [conta B ativa, cookie de cache limpo, redirect ao destino]
  --membership FORBIDDEN--> [conta A ativa, erro exibido]  (comportamento já existente, inalterado)
```

Não há estado intermediário persistido — a "confirmação pendente" é só UI
(dialog aberto), sem escrita até a confirmação (FR-005).

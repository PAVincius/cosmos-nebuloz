# Research: Conta ativa sempre visível (Fase 0)

Sem NEEDS CLARIFICATION no Technical Context — as decisões abaixo vieram de
leitura direta do código existente (não do intent nem de suposição), citando
arquivo:linha.

## 1. Onde está o bug de "só tooltip"

**Decision**: o bug (FR-001) existe em 2 dos 5 shells — Meridian e Signal —
não nos 5. Scaffold e Charter já renderizam o nome da conta como texto
visível; Cosmos já tem um bloco visual com nome + seletor (sem ação de troca
nem confirmação).

**Evidence**:
- `apps/app/components/meridian/shell.tsx:520` — `title={organization}` no
  `<span>` que mostra `{user.role} · {user.name}`; o nome da conta nunca
  aparece como texto, só no atributo `title` (tooltip).
- `apps/app/components/signal/shell.tsx:630` — mesmo padrão.
- `apps/app/components/scaffold/shell.tsx:266` — `{organization}` já dentro
  de um `<span>` de texto visível.
- `apps/app/components/charter/shell.tsx:636` — idem, dentro de um `<Link>`.
- `apps/app/components/cosmos/shell.tsx:344-355` — bloco com
  `identity.tenantInitials` + `identity.tenantName` visíveis num `<button>`
  com ícone `chevronsUpDown`, mas sem `onClick`/dropdown — visual de seletor
  sem função.

**Rationale**: como os 5 já divergem (2 com bug, 2 corretos mas duplicados, 1
com esqueleto de seletor sem função), a correção certa não é um patch
pontual no Meridian — é o componente único do FR-002, que substitui as 5
implementações por uma.

**Alternatives considered**: corrigir só Meridian e Signal (menor diff) —
rejeitado porque não atende FR-002 (mesmo componente nos 5) nem remove a
duplicação que already existe em Scaffold/Charter/Cosmos.

## 2. Fallback determinístico

**Decision**: em `requireTenantSession`
(`packages/auth/server.ts:208-216`), a busca do primeiro membership hoje é
`database.tenantMember.findFirst({ where: { userId }, select: {...} })` —
sem `orderBy`, ou seja, ordem não determinística de banco. FR-007/008 exigem
adicionar `orderBy: { createdAt: "asc" }`.

**Evidence**: `packages/auth/server.ts:209-212`.

**Rationale**: `TenantMember.createdAt` já existe
(`packages/database/prisma/schema/tenant.prisma:423`, `@default(now())`, com
`@@index([userId])` já cobrindo o filtro) — adicionar `orderBy` não exige
migration nem índice novo.

**Alternatives considered**: campo novo "última conta usada" — rejeitado no
intent (exigiria schema, fora do escopo desta fase).

## 3. Vazamento de sessão em convite/onboarding

**Decision**: os dois pontos usam `session.updateMany({ where: { userId } })`
— afeta todas as sessões da pessoa. Trocar por
`session.update({ where: { id: session.session.id } })`, escopado à sessão
que executou a ação — mesmo padrão já usado corretamente em
`switch-tenant/route.ts:42-45` (por `token`) e em `switch-org.ts:39-42` (por
`id`).

**Evidence**:
- `apps/app/app/(unauthenticated)/invite/[token]/complete/page.tsx:53-56`
- `apps/app/app/actions/onboarding.ts:57-60`

**Rationale**: `session.session.id` já está disponível em ambos os arquivos
(a sessão já foi lida via `auth.api.getSession`) — não exige nova consulta.

**Alternatives considered**: nenhuma — é a mesma correção mecânica nos dois
pontos, já com precedente correto no próprio código.

## 4. Mecanismo de troca a reusar

**Decision**: o seletor novo (FR-003/004) reusa
`POST /api/auth/switch-tenant` (`apps/app/app/api/auth/switch-tenant/route.ts`)
— já valida membership (linhas 34-40), já grava `activeTenantId` escopado à
sessão por `token` (linhas 42-45), já limpa o cookie
`better-auth.session_data` (linha 53) para refletir sem esperar a janela de
cache. FR-009 já está coberto pelo código; falta só o teste que comprove.

**Evidence**: `apps/app/app/api/auth/switch-tenant/route.ts:1-55`.

**Rationale**: é o único dos dois mecanismos de troca existentes
(`switch-tenant` vs `switchOrg`) que já limpa o cache e já tem call site
(`workspace-switcher.tsx:70`). FR-012 exige reuso, não duplicação.

**Alternatives considered**: `switchOrg` (`apps/app/app/actions/auth/switch-org.ts`)
— rejeitado por FR-013: não limpa `better-auth.session_data`, sem call site
hoje; permanece documentado como risco, não corrigido nesta fase.

## 5. Destino pós-troca

**Decision**: reusar `resolvePostLoginDestination()`
(`apps/app/app/(authenticated)/_lib/resolve-post-login-destination.ts:33-49`)
para decidir catálogo (`/produto`, tenant interno) vs primeiro produto
contratado, após a troca confirmada.

**Evidence**: já é o único ponto de leitura de `Tenant.isInternalTenant`
combinado com `listarProdutos()` — mesma decisão que FR-006 pede.

**Rationale**: função já existe e testada
(`apps/app/__tests__/produto/resolve-post-login-destination.test.ts`) para o
caso pós-login; pós-troca é a mesma decisão (a sessão já está na conta nova
quando ela roda).

**Alternatives considered**: destino fixo por produto — rejeitado, spec pede
reusar a lógica já existente (Assumptions do spec.md).

## 6. Onde vive o componente compartilhado

**Decision**: `packages/design-system/components/account-switcher/` (novo
subdiretório), no mesmo pacote de onde `workspace-switcher.tsx`
(`apps/app/app/(authenticated)/components/workspace-switcher.tsx`) já importa
`DropdownMenu`/`SidebarMenuButton`.

**Evidence**: `packages/design-system/components/` já tem um subdiretório
por produto (`cosmos/`) ao lado de `ui/` genérico — não há hoje um
componente cross-produto nesse pacote, este é o primeiro.

**Rationale**: os 5 shells (`apps/app/components/<produto>/shell.tsx`) já
importam de `@repo/design-system` — colocar o componente lá evita import
cross-produto dentro de `apps/app/components/` (que hoje é só produto→produto
específico) e mantém 1 implementação para os 5 consumirem.

**Alternatives considered**: `apps/app/components/shared/` — rejeitado por
ser um diretório novo dentro de `apps/app/components/`, que hoje só tem
pastas por produto; misturar quebraria essa convenção sem necessidade, já
que `@repo/design-system` já cumpre esse papel para outros componentes de UI.

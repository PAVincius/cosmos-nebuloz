# Modelo de contas — AS-IS técnico

**Data**: 2026-09-27 (revisado no mesmo dia com adendos de verificação — Alicerce)
**Pedido por**: Morgana, a pedido do CEO (27/set) — pesquisa, sem editar código nem banco.
**Objetivo**: mapear o modelo atual de tenant/conta/papel com `arquivo:linha`, pra comparar contra o modelo-alvo do CEO e apontar os gaps. Não é plano de implementação.

## Modelo-alvo (para referência)

> Um e-mail = uma pessoa. A pessoa é cadastrada como cliente da Nebuloz dentro
> de uma **CONTA**. A conta **CONTRATA** produtos (Meridian, Scaffold, Charter,
> Cosmos, Signal). A pessoa recebe acesso ao portal (app.nebuloz.ai), escolhe a
> conta (se tiver mais de uma) e um dos produtos contratados, cada um com seu
> próprio controle de acesso (papel por produto).

O resto deste documento é o que existe hoje, não o que deveria existir.

Documento irmão: **[negocio-e-referencias.md](./negocio-e-referencias.md)**
(Norte/CPO, mesma data) — ângulo comercial (Proposal/PlanoComercial/AssinaturaDoTenant),
benchmarks de SaaS multi-produto (Atlassian/Linear/Vercel/Stripe/Microsoft) e
recomendação. Os dois documentos concordam nos pontos técnicos que se
sobrepõem. Adendos abaixo, marcados **(addendum Alicerce)**, foram conferidos
depois da primeira versão deste documento.

---

## 1. Primitivas centrais do schema

`packages/database/prisma/schema/tenant.prisma`:

- **`Tenant`** (linhas 23-46 aprox.) — id, `name`, `slug` (único), `plan`
  (`SubscriptionPlan`: ORBIT/GALAXY/NEBULA/UNIVERSE), `isSystem` (linha 36),
  `isInternalTenant` (linha 42), `metadata: Json?`. Hoje **é** a unidade de
  "conta": não existe camada acima dela agrupando vários tenants sob uma
  mesma pessoa/empresa-cliente.
- **`TenantMember`** (linhas 418-431) — `tenantId`, `userId`, `role`
  (`MemberRole`: ADMIN/STE/RTE/SM/PO/DEV/MEMBER, linhas 7-15), `@@unique([tenantId, userId])`.
  Este é o papel do Cosmos — não existe uma tabela `CosmosMembership` separada,
  o Cosmos reusa `TenantMember.role` diretamente (confirmado em
  `packages/rbac/src/modules.ts` e nos guards de `apps/app/app/(cosmos)`, que
  chamam `requireRole(["ADMIN", ...], ctx)` com o `ctx.role` vindo de
  `requireTenantSession`).
- **`TenantInvitation`** (linhas 433-446) — convite por e-mail antes da conta
  existir, mesmo `MemberRole`, `expiresAt`, `status`.
- **`TenantModule`** — `packages/database/prisma/schema/modules.prisma:30-47`.
  `tenantId`, `module` (`ProductModule`: COSMOS/CHARTER/SIGNAL/MERIDIAN/SCAFFOLD,
  linhas 15-21), `status` (`ModuleStatus`: ACTIVE/TRIAL/SUSPENDED/CANCELED),
  `contractedAt`, `expiresAt`, `seats`. `@@unique([tenantId, module])`.
  Comentário do próprio arquivo (linhas 1-6): "Ausência de linha = módulo não
  contratado (default deny)". Isto **é** a contratação de produto por conta —
  já existe e já é o mecanismo certo pro "a conta CONTRATA produtos" do
  modelo-alvo.

## 2. Sessão e tenant ativo

`packages/auth/server.ts`, `requireTenantSession` (linhas 195-223):

1. Lê a sessão do better-auth (`auth.api.getSession`, linha 198).
2. Lê `session.session.activeTenantId` (linhas 204-206; campo adicional
   declarado em `server.ts:90-95` com `input: false` — o cliente nunca
   escreve nele diretamente).
3. Se `activeTenantId` é nulo (primeiro acesso, ou sessão nova, linhas
   208-241): busca o **primeiro** `TenantMember` do usuário (`findFirst`, sem
   ordenação explícita — ordem é a de inserção do índice, não uma escolha de
   negócio) e persiste como `activeTenantId` na linha de `Session` (linhas
   217-221). Erro `P2025` (linhas 222-234, sessão já rotacionada) é engolido
   de propósito — a pessoa já foi autenticada e o vínculo já foi confirmado.
4. Se `activeTenantId` já existe: confirma que o usuário ainda é membro
   daquele tenant (`tenantMember.findFirst`, linhas 244-251) — se não for,
   `FORBIDDEN` (linha 250). Isto é o que impede um cookie com `activeTenantId`
   de um tenant do qual a pessoa saiu virar acesso.

**Troca de tenant** — `apps/app/app/api/auth/switch-tenant/route.ts` (arquivo
inteiro, 55 linhas): `POST` recebe `{ tenantId }`, confirma sessão, confirma
`TenantMember` do par `(tenantId, userId)` (linha 34-36) — sem isso, 403 — e só
então faz `database.session.update({ activeTenantId: tenantId })` (linha
42-45). Deleta o cookie `better-auth.session_data` (cache assinado da sessão)
pra forçar releitura do banco na próxima requisição.

**Não há passo de confirmação** na troca — nem no back-end nem na UI. É um
`fetch` direto (ver abaixo) sem modal "tem certeza?".

**(addendum Alicerce)** Existe um **segundo** mecanismo de troca,
`switchOrg` — server action em `apps/app/app/actions/auth/switch-org.ts:19-48`.
Confere membership e grava `activeTenantId` igual à rota acima, mas **não
deleta o cookie `better-auth.session_data`** — só invalida o cache de
permissão (`invalidatePermissionCache`). Sem essa limpeza, o `cookieCache`
(`packages/auth/server.ts:71-89`, `maxAge: 60`) pode servir o tenant antigo
por até 60s depois da troca. Tem teste dedicado
(`apps/app/__tests__/actions/auth/switch-org.test.ts`) mas **nenhum call
site em código de produto hoje** (grep confirma) — não é um bug ativo, é um
caminho testado e pronto para alguém wireiar a uma tela nova sem notar que
ele reintroduz o problema que a rota já resolveu.

**(addendum Alicerce)** Aceitar um convite (`TenantInvitation`) troca a
conta ativa de **todas** as sessões da pessoa, não só a que aceitou — ver
seção "Convite" abaixo, adicionada nesta revisão.

**`WorkspaceSwitcher`** — `apps/app/app/(authenticated)/components/workspace-switcher.tsx`
(144 linhas): busca `/api/tenants`, lista, ao clicar chama
`fetch("/api/auth/switch-tenant", {...})` (linhas 70-71) e recarrega.

**Achado central**: este componente só é importado por
`apps/app/app/(authenticated)/components/sidebar.tsx`, que só é usado por
`apps/app/app/(authenticated)/layout.tsx`. As rotas de produto —
`app/(cosmos)`, `app/(charter)`, `app/(meridian)`, `app/(scaffold)`,
`app/(signal)` — são **grupos de rota irmãos** de `(authenticated)` na raiz de
`app/`, não filhos dela; cada um tem seu próprio `layout.tsx` server component
com seu próprio shell (`CosmosShell`, `MeridianShell`, etc.). **Nenhum deles
importa `WorkspaceSwitcher`.** Confirmado por grep: o único import de
`WorkspaceSwitcher`/`workspace-switcher` fora do próprio arquivo é
`sidebar.tsx`.

Isso explica tecnicamente o achado do dogfood
(`docs/qualidade/dogfood/meridian/atrito.md`, entrada P1 "Seleção de
organização em app.nebuloz.ai (todas as telas)"): o CEO é `ADMIN` em 6
tenants, dois com nome quase igual ("Nebula" e "Nebuloz"); no Meridian **não
existe seletor nem indicador visível de organização ativa** — só o `AppSwitcher`
(troca de **produto**, não de tenant). O nome da organização chega até o
Meridian (`apps/app/app/(meridian)/actions/shell.ts:23-52`, `getShellData` lê
`tenant.name` de verdade), mas `apps/app/components/meridian/shell.tsx:520`
só o usa como atributo `title` (tooltip HTML, invisível sem hover) num
`<span>` que mostra `{user.role} · {user.name}` — nunca o nome do tenant em
texto visível. O mesmo padrão de shell próprio (sem switcher) vale para
Charter, Scaffold e Signal — não verifiquei linha a linha os três, mas
nenhum importa `workspace-switcher.tsx` (grep confirma).

### 2.1 Convite e segunda conta **(addendum Alicerce)**

Fluxo: `TenantInvitation` (e-mail, `tenantId`, `role`, `expiresAt`, `PENDING`) →
`/invite/[token]` (valida existência/expiração) → login → `/invite/[token]/complete`
(`apps/app/app/(unauthenticated)/invite/[token]/complete/page.tsx:29-56`).
Confere e-mail da sessão contra o convidado, confere que ainda não é membro,
e numa transação: cria `TenantMember` no tenant novo, marca o convite
`ACCEPTED`, e **`database.session.updateMany({ where: { userId }, data: {
activeTenantId: invitation.tenantId } })`** (`:47-51`) — isto grava em
**todas** as linhas de `Session` daquele usuário, qualquer
dispositivo/navegador, não só a sessão que está aceitando. Quem aceita um
convite no celular tem a conta ativa do notebook trocada also, sem aviso.

Provisionamento inicial é diferente do convite: se o e-mail do dono já
existe como `User`, `provisionTenant` cria a `TenantMember` **direto, sem
convite** (`packages/provisioning/src/tenant.ts:70-74`, o ramo "já existe
`User`" descrito acima). Nenhum papel de produto (MeridianRole/CharterRole/
ScaffoldRole/SignalRole) é atribuído nem pelo convite nem pelo
provisionamento inicial — só o papel de conta (`MemberRole`); ver seção 3.

## 3. Papel por produto — cinco modelos, não um

Cada produto (exceto Cosmos) tem sua própria tabela de vínculo
`(tenantId, userId) → role`, com o mesmo formato:

| Produto | Tabela | Enum de papel | Arquivo:linha |
|---|---|---|---|
| Cosmos | — (reusa `TenantMember.role`) | `MemberRole` | `tenant.prisma:7-15` |
| Meridian | `MeridianMembership` | `MeridianRole` (CONSULTANT/REVIEWER/VIEWER) | `meridian.prisma:95-99`, modelo `113-128` |
| Charter | `CharterMembership` | `CharterRole` (COMPLIANCE/LEGAL/SECURITY/HR/REQUESTER/EXEC/AUDITOR) | `charter.prisma:19-27`, modelo `152-163` |
| Scaffold | `ScaffoldMembership` | `ScaffoldRole` (TEAM_MEMBER/PROCESS_OWNER/TRANSFORMATION_LEAD/CONSULTANT/ADMIN) | `scaffold.prisma:79-85`, modelo `103-118` |
| Signal | `SignalMember` | `SignalRole` (VIEWER/OWNER/ANALYST/ADMIN) | `signal.prisma:114-119`, modelo `589-602` |

Contrato de módulo (`TenantModule.status`) e papel de produto são checados em
**cadeia**, nunca um no lugar do outro — ver `apps/app/lib/meridian/guards.ts:17-30`
(comentário do próprio arquivo, a ordem é: sessão → módulo contratado → papel
de diagnóstico → permissão do papel) e `requireMeridianContext` (linhas
81-93): um `TenantMember.ADMIN` **sem** `MeridianMembership` recebe FORBIDDEN
— comentário explícito na linha ~88: "Deliberadamente não herda de
`MemberRole.ADMIN`: um admin de plataforma que contorna o papel de consultor
invalida a trilha do override." `listModules`/`hasModule`
(`packages/rbac/src/modules.ts:23-57`) são o ponto único de leitura de
`TenantModule`, com cache de 5 min via Upstash quando configurado.

Isto já é bem próximo do "cada produto com seu próprio controle de acesso" do
modelo-alvo — o gap não está no dado, está na **UX de seleção** (seção 5).

**(addendum Alicerce)** O gap não é só de seleção — é também de
**provisionamento por produto**: dos quatro produtos com tabela dedicada, só
o **Charter** tem uma ação de app pra atribuir o papel
(`apps/app/app/(charter)/actions/settings.ts:388-395`, `upsert` em
`CharterMembership`, com regra de não remover o último `COMPLIANCE`).
Meridian, Scaffold e Signal **não têm nenhuma tela ou ação no app** para dar
`MeridianRole`/`ScaffoldRole`/`SignalRole` a alguém — hoje só script de seed
cria essas linhas. O modelo-alvo pressupõe que a conta consegue dar acesso
por produto pelo próprio portal; hoje isso só funciona de fato num dos
cinco.

## 4. Tenants especiais e feature flags

- **`isSystem`** (`tenant.prisma:36`) — tenant único, `id`/`slug` = `"system"`
  (migration `packages/database/prisma/migrations/20260728020000_system_tenant/migration.sql:13`),
  criado pra dar `tenantId` a `AuditLog` de ações de sistema (Inngest). Comentário
  do schema: listagem cliente-facing deve sempre filtrar `isSystem = false`.
  **`requirePlatformStaff`** (`apps/backoffice/lib/guard.ts:151-181`) define
  "equipe da Nebuloz" checando `TenantMember` neste tenant `system` — mais 2FA
  obrigatório (`assertSegundoFator`). É o gate de **todo** o back-office
  (dezenas de actions e páginas em `apps/backoffice`, confirmado por grep).
  **Resolvido (addendum Alicerce)**: não há drift — são dois campos
  diferentes. `id = "system"` (imutável, é o que `SYSTEM_TENANT_ID` compara)
  foi seedado pela migration `20260728020000_system_tenant` com
  `slug = "system"` também; uma segunda migration,
  `20260728030000_system_tenant_marker`, **renomeou o slug para
  `"__system__"`** deliberadamente (comentário da migration: reservar um
  formato de slug que validação de slug cliente-facing nunca produziria) e
  adicionou a própria coluna `isSystem`. A lista da Morgana bate com o slug
  real hoje.
- **`isInternalTenant`** (`tenant.prisma:42`) — usado em **um único lugar**:
  `apps/app/app/(authenticated)/_lib/resolve-post-login-destination.ts:12-21`,
  pra decidir se o login pós-autenticação cai no catálogo de produtos
  (`/produto`) ou direto no primeiro produto contratado. Grep confirma:
  nenhum outro uso no repositório (não é usado por `requirePlatformStaff`, não
  dá privilégio de staff, não afeta RBAC). Hoje só o tenant `nebuloz` tem a
  flag `true` — setado manualmente, sem UI no back-office.
- **Lista de "produtos lançados"** (`specs/008-catalogo-lancamento-escalonado/`,
  status `draft`, **ainda não implementado**) — decisão do CEO (26/set) de
  adicionar uma segunda condição pro card do catálogo ficar clicável: além de
  `TenantModule.status = ACTIVE`, o produto precisa estar numa lista fixa de
  "lançados" (hoje só Meridian, alinhado a `docs/produto/prontidao-lancamento.md`).
  Motivo registrado no `intent.md`: o tenant `nebuloz` tem os 5 módulos `ACTIVE`
  em produção, e sem essa segunda trava os 5 cards apareceriam clicáveis. Esta
  spec ainda não decidiu se a lista também bloqueia acesso direto por URL
  (`/cosmos`, etc.) ou só o card — registrado como pergunta aberta pro CEO no
  próprio `intent.md`.

`isSystem`, `isInternalTenant` e a lista de lançados (quando existir) são
**três mecanismos independentes**, sem relação de herança entre si, que hoje
coincidem em tenants diferentes (`system` vs `nebuloz`).

## 5. Provisionamento (back-office → tenant)

`packages/provisioning/src/tenant.ts`, `provisionTenant()` (linhas 53-118),
dentro de uma transação:

1. Gera slug único (`uniqueSlug`), cria `Tenant`.
2. Se já existe `User` com o e-mail do dono: cria `TenantMember` `ADMIN` direto
   (linhas 70-74). Senão: cria `TenantInvitation` `ADMIN` com TTL de 14 dias
   (linhas 78-88) — comentário: "Vender antes da pessoa se cadastrar é a ordem
   normal do comercial."
3. Para cada módulo do input: `contractModule()` (`modules.ts`) — cria/atualiza
   `TenantModule` e invalida cache de RBAC.
4. Grava `PlatformAuditEntry` (`logPlatformAudit`).

**Disparo**: `provisionTenantAction` (`apps/backoffice/app/actions/provisioning.ts:145-172`)
— ação manual de staff (`requirePlatformStaff` + `assertCanWrite`, linha
153-154), chamada da tela `apps/backoffice/app/(staff)/clientes/novo/page.tsx`.

**Gap confirmado, não suposição**: `Proposal` (`packages/database/prisma/schema/platform-ops.prisma:276-301`)
tem `clienteTenantId String?` **opcional** — comentário do schema (linhas
283-286): "proposta nasce antes do tenant existir". Conferi
`apps/backoffice/app/actions/proposals.ts`: `clienteTenantId` só é **lido/passado
adiante** (linhas 198, 287), nunca escrito a partir de uma aceitação de
proposta, e o arquivo não chama `provisionTenant` em nenhum ponto. Ou seja:
**proposta aceita e tenant provisionado são duas ações manuais de staff,
independentes** — não há pipeline automático "proposta ACEITA → tenant criado".
Preço recorrente por módulo (`PrecoDeModulo`, `comercial.prisma:49`) é uma
entidade comercial separada de `TenantModule` (acesso) — comentário em
`modules.prisma:8-14` já avisa que as duas propositalmente podem divergir
(Scaffold é vendido por projeto, sem assinatura).

**(addendum Alicerce)** `TenantModule.seats` é armazenado e exibido, mas
nenhum código encontrado conta `TenantMember`s ativos contra `seats` antes
de permitir mais um membro — é registro, não limite aplicado.

**Porta única cross-tenant**: `platformDb` (ADR-0013,
`docs/adr/0013-porta-unica-de-acesso-cross-tenant.md`) — só
`packages/provisioning` e `apps/backoffice` podem importá-lo; um teste falha
se `apps/app` importar. Todo `provisionTenantAction`/listagem de clientes passa
por aqui, filtrando `isSystem = false`.

## 6. Invariantes de segurança que qualquer mudança precisa manter

- **ADR-0012** (`docs/adr/0012-rls-anulada-por-conexao-superuser.md`) — as
  tabelas do Charter (e, por extensão, a hipótese é que vale para outras) têm
  RLS **declarada** (`ENABLE`/`FORCE ROW LEVEL SECURITY`, policy
  `tenant_isolation`), mas a aplicação conecta como `postgres` (superuser,
  `BYPASSRLS` implícito) — **a policy nunca é de fato aplicada hoje**. O
  isolamento real vem de `withTenantDb()` (seta `app.tenant_id` de sessão E
  filtra a query por `tenantId`) — é disciplina de código, não garantia de
  banco. **Qualquer redesenho do modelo de conta que assuma "o banco isola
  sozinho" está errado enquanto este ADR não fechar** (papel de aplicação sem
  `BYPASSRLS`, ainda não criado).
- **ADR-0013** — `platformDb` é a única porta legítima de leitura cross-tenant.
  Um conceito novo de "Conta" que precise listar tenants/produtos através de
  contas (cross-tenant por definição) **deve** passar por esta mesma porta, não
  criar uma segunda.
- **`docs/produto/mapa-de-fronteiras.md`** já registra, como **gap conhecido e
  não deste pedido**, duas entidades diretamente relevantes: entidade 1
  ("Tenant / cliente") diz que o dono-alvo é o Charter e que "nenhum produto
  cria tenant próprio" — hoje o tenant nasce em `provisionTenant`
  (linhas 61-62 do mapa, citando `packages/provisioning/src/tenant.ts:53-116`
  e o Big Bang). Entidade 2 ("Usuário, papel, permissão") diz que o alvo é
  **um** modelo de permissão no Charter, com personas de produto como lentes
  de UI — hoje há **cinco matrizes de permissão**, uma por produto (seção 3
  deste documento), e o próprio mapa já assinala isso como divergência a
  fechar. Um redesenho de "Conta" que crie uma sexta fonte de verdade sem
  revisitar este mapa reabriria uma decisão já tomada.

## 7. Gaps AS-IS → modelo-alvo

1. **Não existe camada "Conta" acima de `Tenant`.** Hoje `Tenant` é
   simultaneamente "cliente" e "workspace"; os 6 tenants do CEO
   (`system`, `dev-teste`, `medcore`, `nebula`, `nebuloz`, `nebuloz-novo-cliente`)
   são irmãos no mesmo nível, sem agrupamento por pessoa/empresa. O
   modelo-alvo pede pessoa → conta → (N tenants/produtos contratados); hoje é
   pessoa → N `TenantMember` diretos, sem nó intermediário.
2. **Nenhum shell de produto mostra ou permite trocar a conta ativa** —
   `WorkspaceSwitcher` só existe dentro de `(authenticated)/layout.tsx`; os
   cinco shells de produto (`(cosmos)`, `(charter)`, `(meridian)`,
   `(scaffold)`, `(signal)`) são raízes de rota irmãs, cada uma com seu
   próprio layout, nenhum importa o switcher. No Meridian, o nome do tenant
   ativo existe no dado (`getShellData`) mas só aparece como tooltip HTML
   invisível (`shell.tsx:520`). **Esta é a causa técnica direta** do incidente
   registrado em `docs/qualidade/dogfood/meridian/atrito.md` (P1, CEO confundiu
   "Nebula" com "Nebuloz", editou/criou dado no tenant errado).
3. **Troca de tenant não tem confirmação nem feedback visível.**
   `switch-tenant/route.ts` troca `activeTenantId` e apaga um cookie de cache
   — sem modal, sem "você agora está em X" na UI além do que o
   `WorkspaceSwitcher` já mostrava antes do clique.
4. **Cinco modelos de papel por produto, coerente com o pedido do CEO, mas já
   registrado como divergência-alvo pelo próprio mapa de fronteiras** — o
   dado já cumpre "cada produto com seu controle de acesso"; o mapa aponta
   pra consolidar autoria de usuário/papel/permissão no Charter. Redesenho de
   Conta precisa decidir se resolve isso junto ou adia — não é território
   novo, já está no mapa.
5. **`isInternalTenant` é um flag manual, sem UI, de escopo único (hoje só
   `nebuloz`)**, tecnicamente independente de `isSystem`/`requirePlatformStaff`
   apesar de os três resolverem perguntas parecidas ("este tenant é especial?").
   Um modelo de Conta que unifique "interno/staff" precisa decidir se são um
   conceito só ou continuam três.
6. **Provisionamento (staff cria tenant) e comercial (proposta aceita) são
   desconectados hoje** — confirmado em código, não hipótese:
   `provisionTenantAction` não é chamado a partir de `proposals.ts`, e
   `Proposal.clienteTenantId` é preenchido manualmente. Um fluxo automático
   "proposta aceita → conta provisionada" não existe.
7. ~~Nome do tenant `system`~~ — **resolvido**: `id="system"`, `slug="__system__"` desde a migration `20260728030000_system_tenant_marker`; a lista da Morgana já usa o slug certo (addendum Alicerce, seção 4).
8. **(addendum Alicerce)** Aceitar um convite muda a conta ativa de **todas**
   as sessões da pessoa, em qualquer dispositivo, sem aviso
   (`session.updateMany`, seção 2.1) — o oposto de "a pessoa sempre sabe
   qual conta está ativa" que o CEO pediu no adendo.
9. **(addendum Alicerce)** Três dos cinco produtos (Meridian, Scaffold,
   Signal) não têm nenhuma ação de app para atribuir papel de produto — só
   seed script (seção 3). Só o Charter deixa a própria conta dar acesso por
   produto sem sair do app.

## Referências citadas

- `packages/database/prisma/schema/tenant.prisma`
- `packages/database/prisma/schema/modules.prisma`
- `packages/database/prisma/schema/meridian.prisma`, `charter.prisma`, `scaffold.prisma`, `signal.prisma`
- `packages/database/prisma/schema/platform-ops.prisma` (`Proposal`)
- `packages/database/prisma/schema/comercial.prisma` (`PrecoDeModulo`)
- `packages/auth/server.ts` (`requireTenantSession`)
- `apps/app/app/api/auth/switch-tenant/route.ts`
- `apps/app/app/(authenticated)/components/workspace-switcher.tsx`, `sidebar.tsx`, `layout.tsx`
- `apps/app/app/(meridian)/layout.tsx`, `apps/app/app/(meridian)/actions/shell.ts`, `apps/app/components/meridian/shell.tsx`
- `apps/app/lib/meridian/guards.ts`
- `packages/rbac/src/modules.ts`
- `apps/backoffice/lib/guard.ts` (`requirePlatformStaff`)
- `packages/provisioning/src/tenant.ts`, `modules.ts`
- `apps/backoffice/app/actions/provisioning.ts`, `proposals.ts`
- `packages/database/prisma/migrations/20260728020000_system_tenant/migration.sql`
- `docs/adr/0012-rls-anulada-por-conexao-superuser.md`
- `docs/adr/0013-porta-unica-de-acesso-cross-tenant.md`
- `docs/produto/mapa-de-fronteiras.md`
- `docs/qualidade/dogfood/meridian/atrito.md`
- `specs/008-catalogo-lancamento-escalonado/intent.md` (draft)
- `apps/app/app/actions/auth/switch-org.ts` (addendum)
- `apps/app/app/(unauthenticated)/invite/[token]/complete/page.tsx` (addendum)
- `apps/app/app/(charter)/actions/settings.ts` (addendum)
- `packages/database/prisma/migrations/20260728030000_system_tenant_marker/migration.sql` (addendum)
- `docs/produto/modelo-de-contas/negocio-e-referencias.md` (documento irmão, Norte/CPO)

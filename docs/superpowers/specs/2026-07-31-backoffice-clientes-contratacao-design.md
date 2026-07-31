# Back-office de clientes e contratação — design

**Data**: 2026-07-31 · **Status**: aprovado, pronto para plano de implementação

## Problema

A Nebuloz não tem onde ver seus clientes nem onde registrar o que cada um
contratou. Hoje um cliente entra em produção assim: alguém abre o banco e roda
`INSERT` em `TenantModule`, depois `INSERT` em `CharterMembership`, depois cria
a política do Charter à mão porque não existe caminho de UI para isso
(ver [runbook do Charter em produção](../../runbooks/charter-em-producao.md)).

Isso não escala para o segundo cliente e não sobrevive a férias.

Esta spec cobre a **fatia A** de três:

| Fatia | O que é | Estado |
|---|---|---|
| **A — clientes e contratação** | quem é cliente, o que contratou, provisionar | **esta spec** |
| B — cobrança | Stripe ↔ `TenantModule.status` | depois |
| C — pipeline comercial | lead → proposta → fechado | depois |

A ordem é essa porque A destrava operação que hoje é SQL na mão, B fecha o ciclo
do dinheiro reusando o `status` que A consolida, e C é o que mais aguenta viver
numa planilha — feito por último, já nasce sabendo em que forma o cliente e o
contrato aterrissam.

## O que já existe

- `Tenant` — o cliente. Tem `isSystem`, marcador criado justamente prevendo que
  "um admin org list, billing export ou customer CSV" não deve listar o tenant
  interno.
- `TenantModule` — o contrato. `module` (`COSMOS` | `CHARTER` | `SIGNAL`),
  `status` (`ACTIVE` e `TRIAL` liberam; `SUSPENDED` e `CANCELED` fecham a porta
  sem apagar dado), `seats`, `contractedAt`, `expiresAt`. Unique
  `(tenantId, module)`.
- `TenantMember` — quem é da organização e com que papel SAFe.
- `AuditLog` — trilha append-only, imutável por trigger.
- Tenant `__system__` — organização interna da Nebuloz, já marcada
  `isSystem = true`.

Nada de lead, proposta ou assinatura existe. Nenhum modelo novo é necessário
para a fatia A.

## Arquitetura

### App

`apps/backoffice` — Next app próprio, projeto próprio na Vercel, domínio
próprio. Compartilha banco e Better Auth com o produto (mesma sessão, mesmo
`User`), mas nenhuma rota dele existe no bundle que o cliente carrega.

### Guard

`requirePlatformStaff()` — sessão válida **e** `TenantMember` no tenant
`__system__`. Dentro do system tenant, `MemberRole` separa leitura (`MEMBER`) de
escrita (`ADMIN`).

Toda page e toda server action começa por ele. Layout protege navegação, não
protege RPC — mesma disciplina do Charter.

### A fronteira cross-tenant

Todo acesso do produto passa por `withTenantDb(tenantId)`, que seta
`app.tenant_id` e filtra. O back-office precisa do oposto, e isso não pode virar
padrão difuso. Uma porta única:

- `platformDb` — cliente Prisma **sem** contexto de tenant.
- Exportada apenas para `apps/backoffice` e `packages/provisioning`.
- Toda listagem de cliente filtra `isSystem = false`.
- Nenhum arquivo de `apps/app` a importa.

Isso merece um ADR: o sistema é tenant-scoped por princípio, e esta é a primeira
exceção declarada.

### Relação com o ADR-0012

Enquanto `DATABASE_URL` apontar para um superuser, a RLS já não protege nada e o
isolamento real é o filtro de aplicação. O back-office não piora o banco, mas
aumenta o custo de um guard furado.

Desenho alvo, quando o papel `cosmos_app` existir: o app do cliente conecta com
um papel que **não** enxerga outros tenants, o back-office com um papel próprio
que enxerga. Aí a fronteira deixa de ser convenção e vira permissão de banco.

Dependência registrada, não pré-requisito — a fatia A não espera por isso.

## `packages/provisioning`

Server-only. A regra mora aqui, não no back-office. Toda função recebe quem está
agindo e escreve no `AuditLog` com o `tenantId` alvo e o staff como ator.

### `provisionTenant({ name, ownerEmail, modules })`

Cria `Tenant`, `TenantMember` `ADMIN` do responsável e as linhas de
`TenantModule` pedidas, numa transação. Reusa o `slugify` e o desempate de slug
que hoje vivem em `apps/app/app/actions/onboarding.ts`.

Se o e-mail ainda não tem `User`, o tenant nasce sem dono e entra uma
`TenantInvitation` em `PENDING` (o modelo já existe) — quando a pessoa aceitar,
vira o `TenantMember` `ADMIN`. Decisão explícita: exigir usuário existente
inverteria a ordem comercial — você vende antes da pessoa se cadastrar.

### `contractModule(tenantId, module, { status, seats, expiresAt })`

Upsert em `TenantModule` (a unique `(tenantId, module)` já existe), seguido de
`invalidateModuleCache(tenantId)`. Sem a invalidação o cliente espera até 5
minutos para ver o módulo, e isso vira chamado de suporte.

### `setModuleStatus(tenantId, module, status)`

`SUSPENDED` e `CANCELED` fecham a porta sem apagar dado — comportamento que
`hasModule` já implementa. É o gatilho que a fatia B vai chamar quando o
pagamento falhar; por isso a assinatura nasce independente de quem chama.

### `bootstrapCharter(tenantId, { complianceEmail })`

Fecha as duas lacunas do runbook: cria `CharterMembership` `COMPLIANCE`,
`CharterSettings` do tenant e `CharterPolicy` com as **nove seções em `DRAFT`** —
só a estrutura, sem o texto de demonstração do seed.

Roda dentro de `withTenantDb`: a RLS do Charter está `FORCE` e recusa `INSERT`
sem contexto de tenant, inclusive para o dono da tabela.

Idempotente: rodar duas vezes não duplica seção nem papel.

### Correção de lambuja

`createOnboardingWorkspace` passa a chamar `provisionTenant`. Hoje ele cria
tenant sem nenhuma linha de `TenantModule`, então todo cliente self-service
nasce sem módulo. Com uma verdade só sobre como um cliente nasce, o self-service
ganha o módulo default e o back-office não diverge dele.

## Telas

| Rota | Conteúdo |
|---|---|
| `/` | Clientes: tenants com `isSystem = false` — nome, slug, criado em, nº de membros, módulos como badges com status. Busca e filtro por módulo/status. |
| `/clientes/[slug]` | Detalhe: contratar módulo, mudar status/seats/validade; membros e papéis em leitura; bloco do Charter mostrando o que falta (módulo, papel `COMPLIANCE`, política) com o botão de bootstrap aparecendo só quando falta; trilha daquele tenant. |
| `/clientes/novo` | Provisionar: nome, e-mail do responsável, módulos e status inicial. |
| `/atividade` | `AuditLog` das ações de staff. |

UI em shadcn / `@repo/design-system`. Sem o tema Cosmos: ferramenta interna não
precisa da casca do produto, e extrair `cosmos/kit.tsx` (1.600 linhas, um único
consumidor, o Charter recém-portado em cima dele) seria refactor sem retorno
nesta fatia.

## Erros e estados

O package lança erros tipados por causa: `SlugConflict`, `TenantNotFound`,
`UserNotFound`, `CharterAlreadyBootstrapped`. O back-office tem um `safeAction`
fino próprio que os traduz — o do produto está amarrado ao contexto de tenant.

Os três estados de tela (carregando, vazio, erro) são obrigatórios, como no
produto. Um back-office que mostra lista vazia quando a query falhou faz você
vender um módulo que já está contratado.

## Testes

**No package:**

- desempate de slug em colisão
- `contractModule` idempotente, e invalidando o cache
- `bootstrapCharter` cria nove seções em `DRAFT`; rodar duas vezes não duplica
- `provisionTenant` com e-mail sem `User` deixa o tenant sem dono e cria a
  `TenantInvitation` em `PENDING`

**No app:**

- guard nega: sem sessão, usuário de tenant cliente, membro que não é do
  `__system__`
- nenhuma consulta de listagem devolve `isSystem = true`

**E2E (o teste que prova a fatia):** provisionar → contratar `CHARTER` →
bootstrap → abrir `/charter` como o cliente e ver o dashboard carregar.

## Fora de escopo

- **Stripe** — fatia B.
- **Lead, proposta, pipeline** — fatia C.
- **Editar papel de membro do cliente** — suporte vê, o cliente decide.
- **"Entrar como o cliente"** — é o primeiro pedido que todo back-office recebe
  e o que mais estraga trilha de auditoria. Se virar necessidade real, entra com
  desenho próprio: sessão marcada como impersonation e registro em log.

## Riscos

| Risco | Mitigação |
|---|---|
| Guard furado expõe todos os clientes | Superfície isolada em app próprio; testes de guard e de vazamento de listagem; ADR sobre a porta `platformDb` |
| `platformDb` vazando para o app do cliente | Export restrito e teste que falha se `apps/app` importar |
| Cache de módulos servindo dado velho após contratar | `invalidateModuleCache` dentro de `contractModule`, não na chamada |
| Divergência entre self-service e back-office | Uma função só (`provisionTenant`) usada pelos dois |

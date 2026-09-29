# Research: Tipo de conta e lançamento por coorte (Fase 1)

Sem NEEDS CLARIFICATION pendente de pesquisa técnica no Technical Context —
FR-011 é uma decisão de produto em trânsito (Morgana/CEO), não uma incógnita
técnica; fica isolada, não pesquisada aqui.

## 1. Inventário completo dos call sites de `isSystem`/`isInternalTenant`

**Decision**: 15 arquivos fora de teste/gerado/migration leem os dois
booleanos hoje; todos migram para `Tenant.type` (FR-003), sem exceção.

**Evidence** (arquivo:linha, código real — comentários/prosa não contados):

| Arquivo | Linha(s) | Uso hoje | Vira |
|---|---|---|---|
| `apps/app/app/(authenticated)/_lib/resolve-post-login-destination.ts` | 19,21 | `select: { isInternalTenant }`, retorno | `select: { type }`, `=== "INTERNA"` |
| `apps/app/scripts/seed-catalogo-e2e.ts` | 51,52 | grava `isInternalTenant: true` | grava `type: "INTERNA"` |
| `apps/app/scripts/verify-charter.ts` | 66 | `where: { isSystem: false }` | `where: { type: { not: "SISTEMA" } }` |
| `apps/app/scripts/verify-seed.ts` | 923 | `where: { isSystem: false }` | idem |
| `apps/backoffice/app/actions/provisioning.ts` | 22,24 | `select: { isSystem }`, `if (tenant.isSystem)` | `select: { type }`, `if (tenant.type === "SISTEMA")` |
| `apps/backoffice/app/actions/clientes-busca.ts` | 38 | `where: { isSystem: false }` | `where: { type: { not: "SISTEMA" } }` |
| `apps/backoffice/app/actions/scaffold.ts` | 65,133,153 | filtro + leitura + comparação | idem, com `type` |
| `apps/backoffice/app/actions/clients.ts` | 194,211 | leitura + ternário `isSystem ? null : slug` | `type === "SISTEMA" ? null : slug` |
| `apps/backoffice/app/actions/tenant-members.ts` | 50 | `where: { slug, isSystem: false }` | `where: { slug, type: { not: "SISTEMA" } }` |
| `apps/backoffice/app/actions/engagements.ts` | 134 | `where: { id, isSystem: false }` | idem |
| `apps/backoffice/app/actions/scaffold-supervision.ts` | 105,218 | filtro | idem |
| `apps/backoffice/app/actions/accounts.ts` | 178 | `where: { isSystem: false }` | idem |
| `apps/backoffice/app/actions/audit.ts` | 90 | `where: { isSystem: false }` | idem |
| `apps/backoffice/app/actions/benchmark.ts` | 78 | `where: { isSystem: false }` | idem |
| `apps/backoffice/lib/client-queries.ts` | 12,34 | `where: { isSystem: false }` (2x) | idem |

Mais 4 arquivos de teste/E2E citam os booleanos só em comentário ou fixture
de seed (`apps/app/scripts/seed-e2e.ts:1934`,
`apps/app/e2e/setup/auth.setup.ts:65`,
`apps/app/e2e/catalogo-pos-login.spec.ts:30`,
`apps/backoffice/lib/guard.ts:10`) — migram junto por consistência, mas não
mudam comportamento de query.

**Rationale**: todos os 12 sites de `apps/backoffice` seguem exatamente o
mesmo padrão (`isSystem: false` = "exclui o tenant de sistema desta
listagem de clientes") — tradução mecânica 1:1 para
`type: { not: "SISTEMA" }`, sem mudança de semântica. Nenhum deles hoje
também exclui `isInternalTenant` — ou seja, a Nebuloz (INTERNA) aparece
nessas listagens de "cliente" hoje. Esta spec **não muda** isso (não foi
pedido); é uma pergunta separada para quem revisar a implementação se
"cliente" nessas telas deveria também excluir `INTERNA`/`TESTE`/`DEMO` — fica
fora do escopo desta Fase 1.

**Alternatives considered**: migrar só os sites que a spec toca
diretamente (`resolve-post-login-destination.ts`, catálogo) e deixar o
back-office lendo os booleanos antigos atrás de uma view/campo computado.
Rejeitado — FR-003 e a decisão 5 do intent (roast) fecharam por migração
completa; um campo computado ainda deixaria dois mecanismos vivos, o oposto
do que a Fase 1 promete.

## 2. Onde a nova ação de troca de tipo entra e como audita

**Decision**: nova função em `apps/backoffice/app/actions/accounts.ts`
(mesmo arquivo que já lê `isSystem: false` na linha 178), usando
`requirePlatformStaff`/`assertCanWrite` (`apps/backoffice/lib/guard.ts`) e
`logPlatformAudit` (`@repo/provisioning`) para a auditoria.

**Evidence**: `apps/backoffice/app/actions/tenant-members.ts:142-158` é o
precedente exato — troca um campo (`role`) de uma entidade e grava
`logPlatformAudit({ tenantId, actorUserId, actorName, action: "updated",
entityType: "tenant_member", entityId, target, diff: [["role", antes,
depois]] })`. A troca de `Tenant.type` usa a mesma forma, com
`entityType: "tenant"` e `diff: [["type", antes, depois]]`.

**Rationale**: `AuditLog` (`packages/database/prisma/schema/system.prisma:81`)
já é o modelo genérico de auditoria administrativa (campo `diff: Json?`,
`entityType`, `entityId`) — não é o mesmo modelo que `AccessLog`
(`platform-ops.prisma:641`), que é só de eventos de sessão
(LOGIN/LOGOUT/RECUSADO). A spec.md original assumiu `AccessLog` por engano;
corrigido aqui para `AuditLog` via `logPlatformAudit`.

**Alternatives considered**: nenhuma — é o mesmo padrão já estabelecido,
sem motivo para inventar um novo.

## 3. Onde as duas listas de lançamento entram

**Decision**: `apps/app/app/actions/produtos/lancamento.ts` (novo),
exportando duas constantes `LANCAMENTO_ANTECIPADO: ProductModule[]` e
`LANCAMENTO_GERAL: ProductModule[]`, ao lado de `CATALOGO`/`ORDEM` já
existentes em `apps/app/app/actions/produtos/index.ts:64-108`.

**Evidence**: `apps/app/app/actions/onboarding-modules.ts` já exporta
`SELF_SERVICE_MODULES` como constante de config — mesmo padrão, mesmo
diretório de actions.

**Rationale**: `listarProdutos()` já centraliza toda a lógica de estado do
produto (`explicarAusencia`, linha 118-147); o gate de lançamento é mais um
critério ali, não uma segunda função nem uma segunda fonte de verdade sobre
acesso (FR-009).

**Alternatives considered**: tabela `TenantModuleLaunch` no banco — rejeitado
pelo intent (Fora de escopo: "sem tela administrativa nesta fase"); uma
tabela sem tela de gestão é peso de schema sem ganho sobre uma constante de
código, que já é o padrão do repo para esse tipo de lista.

## 4. Onde o catálogo aplica a checagem de lançamento

**Decision**: `listarProdutos()`
(`apps/app/app/actions/produtos/index.ts:149-193`) ganha um parâmetro
implícito — o `Tenant.type` da sessão — e o `EstadoDoProduto` ganha um novo
valor, `NAO_LANCADO`, retornado quando `abre` é `true` (contrato permite)
mas o módulo não está na lista aplicável ao tipo da conta. A página
(`apps/app/app/(authenticated)/produto/page.tsx:75`) troca
`produto.estado !== "DISPONIVEL"` por `produto.estado === "NAO_LANCADO"`
para decidir `emBreve` — preservando o Acceptance Scenario 3 de US1 (motivo
real de contrato continua aparecendo para `SUSPENSO`/`CANCELADO`/etc.).

**Evidence**: `apps/app/app/(authenticated)/produto/page.tsx:75` —
`const emBreve = catalogoPosLogin && produto.estado !== "DISPONIVEL"` é o
código atual, que hoje só nunca dispara para a Nebuloz porque os 5 módulos
estão `ACTIVE`. Trocar a condição para um estado dedicado
(`NAO_LANCADO`) em vez de "qualquer coisa que não seja DISPONIVEL" é o que
resolve o Edge Case de US1 (contrato suspenso não deve virar "Em breve").

**Rationale**: um `EstadoDoProduto` novo é mais simples que um segundo campo
booleano (`lancado: boolean`) ao lado de `estado` — mantém `href`/`estado`
como a única fonte que a página lê, sem introduzir uma segunda variável a
sincronizar.

**Alternatives considered**: filtrar no cliente (esconder o card, não
mostrar "Em breve") — rejeitado, contradiz FR-007 e a experiência já
validada da spec 004/008 ("visível mas desabilitado, com indicação clara").

## 5. Onde o acesso direto por URL é bloqueado para CLIENTE/TESTE/DEMO (FR-011, resolvido em `/speckit-clarify`)

**Decision**: `requireModule(productModule, ctx)` — hoje duplicado em 4
arquivos (`apps/app/lib/{meridian,charter,scaffold,signal}/guards.ts`,
todos chamando `hasModule` de `@repo/rbac` e lançando `FORBIDDEN` se o
módulo não está contratado) — ganha uma segunda condição: se
`ctx.tenantType !== "INTERNA"` e o módulo não está em
`LANCAMENTO_GERAL`, também lança `FORBIDDEN`, com mensagem distinta
("ainda não lançado" vs "não contratado"). Para `INTERNA`, `requireModule`
não muda — só o card do catálogo aplica a regra (FR-010, US1).

**Evidence**: `apps/app/lib/meridian/guards.ts:65-75` é o padrão — mesma
forma nos outros 3. Nenhum dos 4 hoje sabe o tipo do tenant; `TenantContext`
(`packages/auth/server.ts:155-160`) só carrega `userId`, `tenantId`, `role`,
`user` — sem `type`.

**Rationale**: `TenantContext` é o objeto central de toda sessão
multi-tenant (usado por `requireTenantSession`, o "god node" do grafo do
repo) — adicionar `tenantType` ali, resolvido uma vez por requisição junto
com a leitura que já existe, evita uma segunda consulta em cada um dos 4
`requireModule` e em `listarProdutos()`. É a mesma leitura que FR-001/002
introduzem de qualquer forma.

**Cosmos é um caso à parte**: seu guard
(`apps/app/app/(cosmos)/layout.tsx:29-66`, `resolveIdentity()`) não chama
`hasModule`/`requireModule` — não há hoje um ponto de bloqueio por contrato
visível nesse layout (Cosmos parece tratado como módulo base, sempre
acessível a quem tem sessão de tenant). **Fica como pergunta aberta para o
Alicerce** confirmar, na implementação, onde (ou se) o Cosmos precisa do
mesmo bloqueio de FR-011 — este research não encontrou o ponto
equivalente e não força uma resposta sem verificar contra o código no
momento da implementação.

**Alternatives considered**: checar `Tenant.type` de novo dentro de cada
`requireModule`, com uma query própria — rejeitado, seria 4 queries extras
por request quando uma só (dentro de `requireTenantSession`) já resolve
para todos os usos (guards, catálogo, destino pós-login).

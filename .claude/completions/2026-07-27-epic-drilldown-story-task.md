# Epic Drill-down: Feature → Story → Task — Fechamento

**Data:** 2026-07-27
**Plano:** `.superpowers/sdd/2026-07-27-epic-drilldown-story-task/` (Tasks 1–11 de implementação + Task 12 de fechamento)
**Branch:** `feat/kanban-portfolio-ai`

## O que foi entregue

Drill-down completo Epic → Feature → Story → Task na tela de épico, com edição nativa de tasks e leitura read-only de tasks importadas.

**Schema** (`packages/database/prisma/schema/team-delivery.prisma`, model `Task`):
- `externalId`, `externalSource`, `externalUrl` — mesma convenção já usada em Story/Feature para task importada.
- `noteBlocks Json?` — conteúdo do block editor nativo, sempre `null` em tasks externas.
- Migração: `packages/database/prisma/migrations/20260727000000_task_external_fields/migration.sql` (hand-written, ver "Correções" abaixo).
- `status` ganhou `REVIEW` como quarto valor possível. Na execução descobriu-se que `REVIEW` estava apenas no drill-down e não no enum compartilhado `TaskStatus` em `app/actions/_base.ts`, criando um risco de validação silenciosa. Corrigido: `REVIEW` foi adicionado ao `TaskStatus` compartilhado, e o drill-down agora deriva `TASK_STATUSES` dele.

**Quatro server actions** (`apps/app/app/(cosmos)/actions/epic-tree.ts`):
- `listFeatureStories` — lista stories de uma feature para a tabela do drill-down.
- `listStoryTasks` — lista tasks de uma story, resolvendo estado "conectado" via `Integration.status === "ACTIVE"` do tenant.
- `createNativeTask` — cria task nativa (`externalSource === null`), com verificação tenant-scoped da story antes do create (ver correção do Task 5).
- `updateNativeTask` — atualiza task nativa, write re-escopado por `{ id, tenantId }`. Mantém `completedAt`: define-o ao transicionar para DONE, limpa-o ao sair de DONE, e deixa intocado em qualquer outra transição.

**Cinco componentes** (`apps/app/components/cosmos/screens/epic-tree/`):
- `feature-table.tsx` — tabela de features ligada à tela do épico (`epic-detail-client.tsx`).
- `story-row.tsx` — linha expansível de story com fetch lazy das tasks; header é `<button>` nativo.
- `task-row.tsx` — linha de task com três estados: nativa, externa (com integração ativa), externa desconectada.
- `task-detail-modal.tsx` — modal read-only para tasks externas.
- `native-task-modal.tsx` + `blocks.tsx` — modal de edição de task nativa com block editor (autosave, sem drag-and-drop).

**E2E**: `apps/app/e2e/epic-drilldown.spec.ts` — cobre o fluxo completo de expansão Feature → Story → Task e os três estados de TaskRow.

## As 4 divergências deliberadas do handoff original

1. **Roteamento**: usa o registro de screen-id (`useNav().navigate("epic", id)`), não `/epics/[epicId]` como o handoff assumia.
2. **`Task.status` ganhou `REVIEW`** como quarto valor — sem migração, a coluna é `String` livre.
3. **Task não tinha campos de integração externa**; a Task 1 deste plano adicionou `externalId`/`externalSource`/`externalUrl`/`noteBlocks`. Uma task é nativa exatamente quando `externalSource === null`.
4. **"Conectado" é derivado** de `Integration.status === "ACTIVE"` para o tenant, não hardcoded.

## Correções feitas ao plano durante a execução

Estas importam mais que os acertos — é o que quem repetir este trabalho precisa saber:

- **Task 1**: o plano dizia que `pnpm migrate` faz `db push`. Não faz — é `prisma migrate deploy`, que só aplica arquivos de migração já existentes. Foi necessário escrever `migration.sql` manualmente. `packages/database/CLAUDE.md` e o `CLAUDE.md` raiz ainda documentam isso incorretamente.
- **Task 5**: `createNativeTask` aceitava `storyId` do chamador sem verificar se a story pertencia ao tenant do chamador — uma escrita cross-tenant. Corrigido com um lookup tenant-scoped da story antes do create. O write de `updateNativeTask` também foi re-escopado para `{ id, tenantId }`.
- **Task 9**: uma linha expansível sem elemento interativo aninhado deve ser um `<button>` real, não um `div role="button"` com keyboard handling manual. `StoryRow` foi convertido; `FeatureRow` legitimamente permanece `div` porque envolve o botão ↗.
- **Task 9**: `aria-controls` precisa apontar para um id que existe — os painéis filhos agora ficam sempre montados e escondidos com o atributo `hidden`, em vez de renderizados condicionalmente.

## Correções feitas na revisão final de branch (commit `a933841`)

- **RBAC — duas autoridades divergentes**: o plano original criava um `WRITE_ROLES` em
  `app/(cosmos)/actions/epic-tree.constants.ts`, uma segunda autoridade de permissão paralela à
  política canônica em `app/actions/permissions-policy.ts` (`Task: { create: ["SM","DEV"],
  update: ["SM","DEV"] }`, mais bypass de ADMIN), e que a suíte de RBAC não cobria. O sintoma
  observável: um PO tinha a edição de task negada na tela de time, mas permitida na mesma edição
  via drill-down do épico. O product owner decidiu que a política existente é quem governa, então
  `WRITE_ROLES` foi removido em vez de a política ser alargada. `createNativeTask` e
  `updateNativeTask` agora chamam `enforce(ctx.role, "Task", "create"|"update")` contra essa
  política canônica.
  - O teste também foi fortalecido: antes mockava o helper de autorização como no-op e só
    verificava que ele tinha sido *chamado* — o que passaria mesmo se a checagem rodasse depois da
    escrita. Agora prova bloqueio de fato: um papel negado retorna `ok: false` e o mock de
    create/update nunca é invocado.
- **Defeito de UI encontrado na revisão final**: em `StoryRow`, o botão "+ Nova task nativa"
  ficava ativo durante uma falha no fetch de tasks. Criar uma task nesse estado substituía uma
  lista nula por uma lista de um único elemento, escondendo as tasks reais da story — e como a
  guarda lazy só refaz o fetch quando a lista é nula, colapsar e reexpandir deixava de recuperar o
  estado. O botão agora fica desabilitado enquanto a lista é nula ou há erro.
- **Verificador de seed mais fraco que o contrato da UI**: `verify-seed.ts` originalmente
  verificava apenas que `noteBlocks` era não-nulo via SQL. Isso é mais fraco que o contrato real da
  UI, que passa o valor por `parseTaskBlocks` e trata qualquer incompatibilidade de schema como
  nota ausente — um payload corrompido passaria no verificador enquanto a interface mostraria a
  nota silenciosamente vazia. A asserção agora roda `parseTaskBlocks` nas linhas obtidas.

## Fora de escopo (explícito, não esquecido)

- Sync real bidirecional com Jira/Linear/GitHub/Notion — este plano lê os campos `Task.externalId/externalSource/externalUrl` do banco; popular esses campos é trabalho do pipeline de sync, que não é tocado aqui.
- INVEST em anel/gauge SVG e LifecycleFunnel visual — a tela já expressa ambos de outra forma (barras por dimensão, tab Lifecycle).
- Drag-and-drop de reordenação de blocos de nota (o `gripVertical` do protótipo) — o handle não é renderizado; fica para um plano próprio.
- Botão "Editar épico" no header do handoff — a tela hoje traz "Ver no Kanban" e edição inline por campo na tab Hipótese.

## Suíte completa

Rodado de `apps/app/`:

- **`pnpm typecheck`**: 24 erros, todos pré-existentes em `__tests__/actions/pae/*` (23) e `__tests__/actions/integrations/github-sync.test.ts` (1). Mesma contagem da baseline documentada na Task 12 (drift de 27→24 por motivos fora deste plano). Nenhum arquivo deste plano aparece na lista de erros.
- **`pnpm check`** (rodado da raiz do monorepo — não existe script `check` em `apps/app`, é um script raiz que chama `ultracite check`): 2773 erros / 15 warnings, saída truncada em 2771 diagnósticos não exibidos. Nenhum dos 18 arquivos tocados por este plano (confirmados via `git diff --name-only ff606d2..4e5f767`) aparece no log de erros — os erros visíveis são todos em `apps/app/.design-ref/cosmos-jsx/*.jsx` e `apps/web/_v0preview|v0/**` (mockups de design, pré-existentes, fora de escopo).
- **`pnpm test`**: 235 arquivos de teste passaram (2 pulados — suítes de integração de banco sem `DATABASE_URL`), 2192 testes passaram, 9 pulados. 0 falhas.

Nenhuma falha nova foi introduzida por este plano.

## Follow-ups conhecidos

- Existe um registro de migração falhada pré-existente, `20260516163559_init`, na tabela `_prisma_migrations` do banco de dev. O schema em si está correto, mas o registro falhado pode fazer `prisma migrate deploy` recusar migrações futuras. Foi deliberadamente deixado intocado e já foi levantado separadamente.
- Esse registro falhado é um risco de merge específico para esta branch: esta é a primeira branch
  a entregar um `migration.sql` escrito à mão, e `prisma migrate deploy` recusa aplicar qualquer
  migração enquanto houver um registro falhado em `_prisma_migrations`.

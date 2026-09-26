# Research: Reemitir link do respondente (Meridian)

Sem `NEEDS CLARIFICATION` no Technical Context — a única decisão de produto em aberto (`tokenExpiresAt`) já veio resolvida antes do `/speckit-specify` (ver spec.md `## Clarifications`).

## 1. Mecanismo de reemissão

**Decisão**: `reissueRespondentLink` segue exatamente o padrão de `revokeRespondent` (`apps/app/app/(meridian)/actions/collection.ts:111-144`) — busca o respondente por `id` + `tenantId`, gera token novo (`issueToken()`), regrava só `tokenHash` (e agora também `tokenExpiresAt`), **sem** tocar `status`.

**Rationale**: É o mesmo mecanismo, só sem a mudança de `status` pra `REVOKED`. Reaproveitar em vez de inventar uma segunda forma de invalidar/emitir token reduz a superfície de bugs (uma função de hash, um jeito de girar).

**Alternatives considered**: Guardar histórico de tokens antigos com flag "válido" — rejeitado, complexidade desnecessária; o requisito é só "o antigo morre, o novo funciona".

## 2. `tokenExpiresAt` na reemissão

**Decisão**: `min(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), assessment.deadline)`, calculado uma vez, na emissão, e gravado — nunca recalculado depois. Se `assessment.deadline < now`, a action recusa antes de gerar qualquer token novo (`StateConflictError`).

**Rationale**: Decisão explícita do CEO, fecha o achado P2 do Vigia (`atrito.md:42`): hoje `assignRespondent` copia `assessment.deadline` (`collection.ts:76`), então estender o prazo do assessment depois de emitir tokens dá vida extra silenciosa. Fixar na emissão desacopla definitivamente.

## 3. Bloqueio por status

**Decisão**: `DONE` e `REVOKED` recusam com `MeridianRuleError`, mesmo padrão de mensagens já usado em `sendReminder` (`collection.ts:168-179`, que já recusa `DONE` e `REVOKED` por motivos análogos).

**Rationale**: Reaproveita convenção de erro já estabelecida no mesmo arquivo — mesmo tipo de erro, mesma UX de mensagem clara e específica por motivo.

## 4. Ação em lote — transação e retorno

**Decisão**: `reissuePendingLinks(assessmentId)` roda numa única `withTenantDb`/transação: busca todos os respondentes `INVITED`/`PENDING`/`OVERDUE` do assessment, reemite cada um (mesma lógica de (1)/(2)), grava auditoria por respondente, e devolve a lista `{ id, name, axis, link }[]` pronta pro cliente montar copiar/baixar. Se a lista de elegíveis vier vazia, devolve um resultado que a UI distingue de "sucesso com lista" (ver FR-013) — não lança erro (não é uma falha, é um estado informativo), mas também não finge que reemitiu algo.

**Rationale**: Pedido explícito do CPO: "a opção c pura foi descartada porque segura tokens no estado do cliente" — a lista tem que nascer pronta do servidor a cada acionamento, não persistir no client.

**Alternatives considered**: Devolver só os tokens em claro e montar o link no client — mantido (o padrão atual de `assignRespondent` já devolve o token em claro pro client montar o link com `window.location.origin`); a alternativa de montar a URL completa no servidor foi descartada porque o servidor não deveria assumir o host público (mesma razão implícita no código atual de `tab-coleta.tsx:71`).

## 5. UI — onde entram os dois pontos de entrada

**Decisão**: Botão "Reemitir link" na linha do respondente (`tab-coleta.tsx`, ao lado de "Lembrar"/"Revogar", ~linhas 603-635), visível quando `status` é `INVITED`/`PENDING`/`OVERDUE` (mesma condição de "Lembrar", exceto por incluir `OVERDUE` que já está implícito em `!revoked && r.status !== "DONE"`). Ação em lote como um botão perto do cabeçalho da lista de respondentes (ou da seção "Respondentes por eixo"), abrindo um `ModalShell` com a lista completa, copiar tudo e baixar.

**Rationale**: Mesmo padrão visual e de modal já usado em `AssignRespondentModal`/`RevokeConfirmModal` — reaproveita `ModalShell`, `useModal`, `runWithToast`.

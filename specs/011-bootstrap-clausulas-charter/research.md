# Research: Bootstrap do Charter cria biblioteca de cláusulas

Nenhum item do Technical Context ficou como `NEEDS CLARIFICATION` — o intent aprovado e a leitura do código existente resolveram as decisões abaixo.

## Decisão 1: Onde fica o catálogo único das cláusulas

- **Decision**: novo módulo `packages/provisioning/src/charter-clauses.ts`, exportando `CHARTER_CLAUSES: { code, name, critical }[]` com as 8 entradas (CL-01–CL-08).
- **Rationale**: hoje o catálogo só existe em `apps/app/scripts/seed-charter.ts:212-233` (array `CLAUSES`). `bootstrapCharter` mora em `packages/provisioning`, que não pode depender de `apps/app` (dependência invertida quebraria o monorepo). O caminho correto é o catálogo subir para o pacote que a produção usa, e o seed (que já depende de `packages/provisioning` para outras coisas do Charter) passa a importar de lá.
- **Alternatives considered**:
  - Manter duas listas e um teste que compara as duas por igualdade — rejeitado: ainda é duplicação: FR-002 pede uma fonte, não duas fontes sincronizadas por teste.
  - Colocar o catálogo em `packages/database` (junto ao schema) — rejeitado: não é dado de schema, é dado de domínio do Charter; `packages/provisioning` já é onde vive `charter-rules.ts` (a regra que consome os códigos das cláusulas), então o catálogo fica junto da lógica que o usa.

## Decisão 2: Como fica a idempotência da criação

- **Decision**: `bootstrapCharter` cria as cláusulas com `db.charterClause.createMany({ data: CHARTER_CLAUSES.map(...), skipDuplicates: true })`.
- **Rationale**: o schema já garante `@@unique([tenantId, code])` (`packages/database/prisma/schema/charter.prisma:302-317`). `createMany` com `skipDuplicates` é a operação do Prisma que usa exatamente essa constraint para pular o que já existe, sem nunca fazer `UPDATE` — atende FR-003 (não duplica, não sobrescreve edição do Legal) sem precisar de um SELECT prévio por cláusula. É o mesmo padrão já usado para as 9 seções da política (`charterPolicySection.createMany`), só que agora tolerante a re-execução linha a linha em vez de bloquear no nível do bootstrap inteiro (a política bloqueia o bootstrap inteiro se já existe; as cláusulas não devem bloquear nada — só preencher o que falta).
- **Alternatives considered**:
  - Laço de `upsert` por cláusula (`update: {}` como no `charterMembership.upsert`) — rejeitado: um `upsert` com `update: {}` não sobrescreve campos, mas roda 8 idas ao banco em vez de uma, sem ganho sobre `createMany` + `skipDuplicates` já que não há nada para atualizar por design (FR-003 proíbe atualizar cláusula existente).
  - `findMany` prévio para calcular o diff e só criar as faltantes — rejeitado: mais código para o mesmo resultado; `skipDuplicates` já resolve a corrida e o caso de criação parcial anterior (edge case do spec) numa única chamada.

## Decisão 3: Quando a criação das cláusulas roda em relação à política

- **Decision**: a criação das cláusulas roda sempre que o bootstrap roda — inclusive quando a política já existe (`bootstrap_skipped`) — não só na primeira vez.
- **Rationale**: o edge case do spec ("tenant já tem algumas das 8 cláusulas, ex. bootstrap parcial anterior") só é coberto se a etapa de cláusulas não for pulada quando a política já existe. Hoje o `if (existing) return` da política sai cedo do bootstrap inteiro; as cláusulas precisam de um caminho que rode mesmo nesse retorno antecipado, ou o `return` precisa mover para depois da etapa de cláusulas.
- **Alternatives considered**: rodar a criação de cláusulas só quando a política é criada pela primeira vez — rejeitado: não cobre o cenário de um tenant que já tinha política (bootstrap antigo) e agora é re-bootstrapado só para ganhar as cláusulas que não existiam quando ele foi provisionado — que é exatamente o motivo desta feature existir para tenants que já rodaram o bootstrap antigo (ainda que sem backfill automático em massa, um re-bootstrap pontual deve funcionar).

## Decisão 4: Granularidade do registro de auditoria

- **Decision**: um único evento de auditoria para a criação das cláusulas (ex. `charter.clauses_bootstrapped`, com o tenant e a contagem criada), no mesmo padrão do `charter.bootstrapped` já usado para a política — não um evento por cláusula.
- **Rationale**: segue o precedente já estabelecido no próprio arquivo (a política, com 9 seções, também loga um evento agregado, não nove). FR-005 pede "seguindo o mesmo padrão já usado para o registro de bootstrap da política", que é agregado.
- **Alternatives considered**: um evento por cláusula — rejeitado: gera 8x mais linhas de auditoria por tenant sem benefício adicional (o "o quê" de cada cláusula já é fixo e público no catálogo, não é um dado que precise de rastro individual de criação).

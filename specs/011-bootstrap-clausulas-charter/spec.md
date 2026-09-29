# Feature Specification: Bootstrap do Charter cria biblioteca de cláusulas

**Feature Branch**: `011-bootstrap-clausulas-charter`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Bootstrap do Charter passa a criar a biblioteca de cláusulas CL-01 a CL-08 por tenant (fecha a questão 1 do docs/produto/charter-prd.md, linha 178; FR-9 linha 139). Hoje packages/provisioning/src/charter.ts:67-158 não cria CharterClause; só apps/app/scripts/seed-charter.ts:214-232 cria. Sem CL-01, teto de fornecedor novo para em PUBLIC."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tenant novo decide caso sem SQL nem seed (Priority: P1)

Um tenant contrata o módulo Charter pelo back-office. O time de compliance desse tenant cadastra um fornecedor e avalia um caso de uso Interno. Hoje a biblioteca de cláusulas está vazia e o teto do fornecedor trava em Público, mesmo quando o fornecedor atende exigências de retenção zero, notificação de incidente etc. Com a mudança, a biblioteca já vem com as 8 cláusulas assim que o bootstrap roda, e o teto do fornecedor reflete a postura real dele.

**Why this priority**: é o critério de sucesso do PRD do Charter (linha 164) e o risco nomeado (linha 178). Sem isto, nenhum cliente novo consegue usar o Charter além de casos Públicos.

**Independent Test**: provisionar um tenant novo pelo back-office, abrir o detalhe de um fornecedor recém-cadastrado no Charter e confirmar que a biblioteca de cláusulas não está vazia e que o teto derivado sobe acima de Público quando o fornecedor atende as cláusulas críticas — sem rodar SQL ou script de seed.

**Acceptance Scenarios**:

1. **Given** um tenant sem Charter, **When** o back-office provisiona o módulo Charter para ele, **Then** as 8 cláusulas (CL-01 a CL-08, com código, nome e criticidade) existem na biblioteca desse tenant.
2. **Given** as 8 cláusulas já existem no tenant, **When** um fornecedor é cadastrado e associado às cláusulas críticas, **Then** o teto derivado desse fornecedor sobe acima de Público, seguindo a mesma regra de derivação já existente.

---

### User Story 2 - Re-provisionar não duplica nem apaga edição do Legal (Priority: P2)

O bootstrap do Charter pode rodar mais de uma vez para o mesmo tenant (reprocessamento, correção operacional). Depois da primeira criação, alguém de Legal edita o texto de uma cláusula pela tela do Charter. O bootstrap roda de novo.

**Why this priority**: sem isto, um reprocessamento acidental apaga trabalho de Legal ou duplica cláusula, quebrando a unicidade `(tenantId, code)` e a confiança na biblioteca.

**Independent Test**: rodar o bootstrap duas vezes no mesmo tenant, editando uma cláusula entre as duas execuções, e confirmar que a segunda execução não cria cláusula duplicada nem reverte a edição.

**Acceptance Scenarios**:

1. **Given** um tenant que já tem as 8 cláusulas, **When** o bootstrap roda de novo para esse tenant, **Then** nenhuma cláusula nova é criada e nenhuma existente é alterada.
2. **Given** uma cláusula editada por Legal depois da primeira criação, **When** o bootstrap roda de novo, **Then** o texto/criticidade editado por Legal permanece como está.

---

### User Story 3 - Seed e bootstrap não divergem (Priority: P3)

Alguém precisa ajustar o nome ou a criticidade de uma cláusula (ex.: renomear CL-07). Hoje essa mudança precisa ser feita em dois lugares (seed de demonstração e, com esta feature, o bootstrap), com risco de esquecer um deles e os dois ambientes ficarem com biblioteca diferente.

**Why this priority**: é uma restrição explícita da decisão que originou esta spec, mas o impacto de não resolver é menor que os dois cenários acima — o produto funciona mesmo com a duplicação, só fica mais arriscado de manter.

**Independent Test**: alterar o nome ou a criticidade de uma cláusula em um único lugar do código e confirmar que tanto o seed de demonstração quanto o bootstrap de provisionamento passam a refletir a mudança.

**Acceptance Scenarios**:

1. **Given** a lista de cláusulas definida em um único lugar, **When** o seed de demonstração roda, **Then** ele usa essa mesma lista.
2. **Given** a mesma lista, **When** o bootstrap de provisionamento roda, **Then** ele usa essa mesma lista, sem uma segunda cópia divergente no código.

---

### Edge Cases

- Tenant já tem algumas das 8 cláusulas (ex.: bootstrap parcial anterior, ou estado inconsistente) → o bootstrap cria só as que faltam, pelo código (`CL-0N`), sem tocar nas existentes.
- Bootstrap falha antes de chegar nas cláusulas (ex.: tenant ou usuário de compliance não encontrado) → nenhuma cláusula é criada, igual ao comportamento atual da política.
- Tenant provisionado antes desta mudança, sem cláusulas → continua sem cláusulas até nova decisão de backfill; não é afetado por esta entrega (ver Assumptions).
- Duas execuções concorrentes do bootstrap para o mesmo tenant → a unicidade por `(tenant, código da cláusula)` impede duplicata; uma das execuções pode falhar ou ser no-op na criação da cláusula sem quebrar o restante do bootstrap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O bootstrap do Charter MUST criar, para um tenant que ainda não as tem, as 8 cláusulas padrão (CL-01 a CL-08), cada uma com código, nome e criticidade.
- **FR-002**: O código/nome/criticidade das 8 cláusulas MUST vir de uma única fonte, usada tanto pelo bootstrap de provisionamento quanto pelo seed de demonstração — nenhum dos dois mantém uma cópia própria dessa lista.
- **FR-003**: O bootstrap MUST ser idempotente por cláusula: executá-lo de novo no mesmo tenant não MUST criar cláusula duplicada nem alterar o conteúdo de uma cláusula que já existe (inclusive uma editada manualmente depois da primeira criação).
- **FR-004**: A criação das cláusulas MUST fazer parte do mesmo processo atômico de provisionamento do tenant — se uma etapa anterior do bootstrap falhar, nenhuma cláusula MUST ser criada.
- **FR-005**: O bootstrap MUST registrar em auditoria a criação das cláusulas, seguindo o mesmo padrão já usado para o registro de bootstrap da política (criado vs. já existia).
- **FR-006**: Tenants que já foram provisionados antes desta mudança NÃO MUST receber as cláusulas automaticamente por esta feature — backfill fica fora de escopo (decisão explícita, ver Assumptions).

### Key Entities

- **Cláusula (CharterClause)**: item da biblioteca de cláusulas contratuais de um tenant — código (`CL-01`...`CL-08`), nome, se é crítica. Pertence a um tenant; um fornecedor pode estar associado a várias cláusulas, e essa associação é o que alimenta a derivação do teto de risco do fornecedor (regra já existente, não alterada por esta feature).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um tenant provisionado pelo back-office, sem qualquer SQL manual ou script de seed, tem as 8 cláusulas visíveis na biblioteca de cláusulas do Charter imediatamente após o provisionamento.
- **SC-002**: Um fornecedor desse tenant que atende todas as cláusulas críticas recebe teto de risco acima de Público — hoje isso nunca acontece para tenant provisionado sem seed.
- **SC-003**: Provisionar o mesmo tenant uma segunda vez não muda a quantidade de cláusulas nem reverte uma edição feita manualmente em uma cláusula entre as duas execuções.
- **SC-004**: Uma alteração de nome ou criticidade de cláusula é feita em um único lugar do código-fonte e aparece tanto no ambiente de demonstração quanto em qualquer tenant provisionado depois da alteração.

## Assumptions

- O texto e a criticidade das 8 cláusulas são os mesmos já usados hoje no seed de demonstração (`apps/app/scripts/seed-charter.ts`) — esta feature não é uma revisão de conteúdo jurídico das cláusulas.
- **Pendência aberta, não bloqueante**: o conteúdo das cláusulas ainda não tem aval formal de Legal/Segurança (ADR-0003, linhas 92-94). Isso deve ser resolvido antes de o Charter ir a cliente externo, mas não bloqueia esta implementação.
- **Decisão do CEO em 2026-09-27**: tenants que já existem hoje com o módulo Charter (todos internos ou de teste) NÃO recebem backfill automático de cláusulas por esta feature. Só tenants provisionados (ou re-provisionados) depois da entrega ganham a biblioteca automaticamente.
- A regra que deriva o teto de risco do fornecedor a partir das cláusulas associadas já existe e não é alterada por esta feature — esta spec garante apenas que a biblioteca deixa de estar vazia.

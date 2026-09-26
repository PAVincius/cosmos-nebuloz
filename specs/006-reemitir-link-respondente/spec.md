# Feature Specification: Reemitir link do respondente (Meridian)

**Feature Branch**: `006-reemitir-link-respondente`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: pedido do Norte (CPO), decidido em `docs/produto/meridian-prd.md:243-277` (§10). P0: (1) "Reemitir link" por respondente — gira o `tokenHash` do mesmo respondente, bloqueado para `DONE`/`REVOKED`, com auditoria e `tokenExpiresAt` próprio. (2) "Reemitir e copiar todos os pendentes" — reemite todos `INVITED`/`PENDING`/`OVERDUE` do assessment, devolve nome·eixo·link pra copiar tudo e baixar `.txt`/`.csv`.

## Clarifications

### Session 2026-09-26

- Q: Qual o valor de `tokenExpiresAt` na reemissão, já que copiar `assessment.deadline` (comportamento atual) é o achado P2 do Vigia (`atrito.md:42`)? → A: Fixado no momento da emissão como `min(agora + 14 dias, assessment.deadline)`, nunca recalculado depois. Se `assessment.deadline` já passou, a reemissão recusa com mensagem clara ("prazo do assessment vencido").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reemitir link de um respondente (Priority: P1)

O consultor que atribuiu um respondente e perdeu (ou nunca copiou) o link consegue gerar um link novo pro mesmo respondente, sem revogar nem reatribuir.

**Why this priority**: É a causa raiz do incidente do dogfood (AS-112, dois links perdidos seguidos) — sem isso, o único remédio é revogar e reatribuir, o que perde o respondente original.

**Independent Test**: Atribuir um respondente, fechar o modal sem copiar o link, depois usar "Reemitir link" nesse respondente e confirmar que o link novo funciona e o antigo não.

**Acceptance Scenarios**:

1. **Given** um respondente em `INVITED`, `PENDING` ou `OVERDUE`, **When** o consultor aciona "Reemitir link", **Then** um link novo é gerado pro mesmo respondente (mesmo id, eixo e rascunho preservados) e o link anterior deixa de funcionar.
2. **Given** um respondente em `DONE`, **When** o consultor tenta reemitir, **Then** a ação é bloqueada, com mensagem explicando que o respondente já concluiu.
3. **Given** um respondente em `REVOKED`, **When** o consultor tenta reemitir, **Then** a ação é bloqueada, com mensagem explicando que o respondente foi revogado.
4. **Given** um assessment cujo `deadline` já passou, **When** o consultor tenta reemitir um respondente desse assessment, **Then** a ação é recusada com mensagem clara de prazo vencido.
5. **Given** uma reemissão bem-sucedida, **When** o consultor confere o histórico do assessment, **Then** existe um registro de auditoria da reemissão.

---

### User Story 2 - Reemitir e copiar todos os pendentes (Priority: P1)

O consultor que perdeu o controle de vários links de uma vez (ex.: fechou a aba no meio das atribuições) consegue, com uma única ação, reemitir todos os respondentes ainda pendentes do assessment e recuperar a lista completa de links pra copiar ou baixar.

**Why this priority**: É o cenário exato do incidente real — 10 links perdidos de uma vez. Reemitir um por um seria uma correção incompleta pro problema que motivou o pedido.

**Independent Test**: Com um assessment tendo vários respondentes `INVITED`/`PENDING`/`OVERDUE`, acionar "Reemitir e copiar todos os pendentes" e confirmar que a lista completa (nome, eixo, link) aparece, pode ser copiada de uma vez e baixada em arquivo.

**Acceptance Scenarios**:

1. **Given** um assessment com respondentes em `INVITED`, `PENDING` e `OVERDUE`, **When** o consultor aciona "Reemitir e copiar todos os pendentes", **Then** todos esses respondentes recebem link novo, e a tela mostra a lista completa (nome · eixo · link).
2. **Given** a lista exibida, **When** o consultor aciona "copiar tudo", **Then** o conteúdo completo (nome · eixo · link, um por linha) vai pra área de transferência.
3. **Given** a lista exibida, **When** o consultor opta por baixar, **Then** um arquivo `.txt` ou `.csv` com o mesmo conteúdo é gerado.
4. **Given** um assessment sem nenhum respondente `INVITED`/`PENDING`/`OVERDUE` (todos `DONE` ou `REVOKED`), **When** o consultor aciona a ação, **Then** o sistema informa que não há pendentes a reemitir, sem gerar lista vazia como se fosse sucesso.
5. **Given** respondentes `DONE` misturados com pendentes no mesmo assessment, **When** a ação roda, **Then** só os pendentes são reemitidos — os `DONE` não são tocados.

---

### Edge Cases

- Assessment com `deadline` vencido e mistura de respondentes pendentes: a ação em lote recusa reemitir os que cairiam com prazo vencido, e informa quais foram pulados (não falha silenciosamente nem trava a lista inteira por causa de um).
- Duas reemissões em sequência rápida pro mesmo respondente: cada reemissão mata a anterior — só o link mais recente funciona.
- Consultor fecha a aba antes de copiar a lista da reemissão em lote: como a lista não depende de estado do cliente pra existir, reabrir a tela e acionar de novo gera uma lista nova (reemitindo de novo) — não há como recuperar a lista anterior sem gerar tokens novos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir reemitir o link de um respondente individual sem criar um novo respondente — preserva `id`, eixo e rascunho de resposta existente.
- **FR-002**: A reemissão MUST invalidar o link anterior do respondente imediatamente.
- **FR-003**: O sistema MUST bloquear a reemissão para respondentes em `DONE`, com mensagem explicando o motivo.
- **FR-004**: O sistema MUST bloquear a reemissão para respondentes em `REVOKED`, com mensagem explicando o motivo.
- **FR-005**: O sistema MUST recusar a reemissão quando o `deadline` do assessment já tiver passado, com mensagem clara de prazo vencido.
- **FR-006**: Ao reemitir, o sistema MUST definir um `tokenExpiresAt` próprio, fixado no momento da emissão como `min(agora + 14 dias, deadline do assessment)`, sem recalcular depois mesmo que o deadline do assessment mude.
- **FR-007**: Toda reemissão (individual ou em lote) MUST gravar um registro de auditoria, identificando o respondente e o assessment.
- **FR-008**: O sistema MUST permitir reemitir, numa única ação, todos os respondentes em `INVITED`, `PENDING` ou `OVERDUE` de um assessment.
- **FR-009**: A ação em lote MUST devolver a lista completa dos respondentes reemitidos, com nome, eixo e link de cada um.
- **FR-010**: A ação em lote MUST oferecer copiar a lista inteira de uma vez.
- **FR-011**: A ação em lote MUST oferecer baixar a lista em arquivo (`.txt` ou `.csv`).
- **FR-012**: A ação em lote MUST NOT tocar respondentes em `DONE` ou `REVOKED`.
- **FR-013**: Quando não houver nenhum respondente elegível (`INVITED`/`PENDING`/`OVERDUE`) no assessment, a ação em lote MUST informar isso claramente, em vez de devolver uma lista vazia como se fosse sucesso.

### Key Entities *(include if feature involves data)*

- **Respondente**: entidade já existente — reemitir muda seu `tokenHash` e `tokenExpiresAt`, sem mudar `id`, `axis`, `status` (exceto o bloqueio de `DONE`/`REVOKED`) ou rascunho de resposta associado.
- **Registro de auditoria de reemissão**: novo tipo de evento de auditoria, vinculado ao respondente e ao assessment, distinto dos eventos já existentes de atribuição e revogação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O consultor recupera o link de um respondente perdido em um único passo, sem revogar ou reatribuir, em produção.
- **SC-002**: O consultor recupera os links de todos os respondentes pendentes de um assessment (o cenário real era 10) num único passo, em produção.
- **SC-003**: 100% das reemissões (individuais ou em lote) ficam registradas em auditoria, rastreáveis por respondente e assessment.
- **SC-004**: Nenhuma reemissão ocorre pra um assessment com prazo vencido — 100% dessas tentativas são recusadas com mensagem clara.

## Assumptions

- O mecanismo de reemissão (girar `tokenHash`) segue o mesmo padrão já usado por `revokeRespondent` — não é uma técnica nova, só um novo caminho que não muda `status` pra `REVOKED`.
- A ação em lote não depende de manter tokens em claro no estado do cliente entre reloads — cada acionamento é uma operação de servidor que devolve a lista pronta.
- E-mail automático ao respondente (opção b do PRD) fica fora desta spec — depende da spec 004 (Resend plugado no Better Auth) e de parecer jurídico.

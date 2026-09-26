# Feature Specification: Gate de maturidade + teste de carga (k6)

**Feature Branch**: `007-gate-maturidade-carga`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: pedido do Norte (CPO), aprovado pelo CEO — `docs/produto/regra-maturidade-e-carga.md` (commit `b7e467f4`). Definir um gate de maturidade (3 critérios) que cada produto precisa cumprir antes de entrar em teste de carga; escrever SC de carga formal pro Meridian (primeiro da fila); levantar com o CEO/leads o número real de concorrência por tenant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Checklist de gate reutilizável por produto (Priority: P1)

Quem decide se um produto pode entrar em teste de carga (PO, Maestro) consegue checar, produto por produto, se os três critérios do gate estão cumpridos — sem inventar critério novo a cada produto.

**Why this priority**: É a peça que falta pra qualquer teste de carga fazer sentido — sem o gate, mede-se velocidade de produto que ainda quebra na jornada básica.

**Independent Test**: Aplicar o checklist a um produto (ex.: Meridian) e a outro que claramente não cumpre (ex.: Scaffold) e confirmar que o resultado ("passa"/"não passa", com o motivo) é diferente e rastreável.

**Acceptance Scenarios**:

1. **Given** um produto com SC formal verde no E2E da persona principal, dogfood sem P0/P1 aberto (P2 com dono e data), e condições de compliance cumpridas (quando aplicável), **When** alguém aplica o checklist, **Then** o produto é marcado como apto a entrar em teste de carga.
2. **Given** um produto que falha em qualquer um dos três critérios, **When** alguém aplica o checklist, **Then** o produto é marcado como não apto, com o(s) critério(s) específico(s) que falharam.
3. **Given** um produto que não coleta dado de terceiro, **When** alguém aplica o checklist, **Then** o critério de compliance é tratado como não aplicável (não bloqueia o produto por um requisito que não se aplica a ele).

---

### User Story 2 - SC de carga formal para o Meridian (Priority: P1)

O Meridian — primeiro da fila, já com teste de volume e dogfood em curso — tem um Success Criterion de carga formal, verificável, com o critério de aprovação claramente marcado como hipótese até validação com os leads.

**Why this priority**: É o primeiro produto a efetivamente rodar k6; sem um SC formal, "testar carga" vira uma ação sem critério de sucesso definido.

**Independent Test**: Ler o SC de carga do Meridian e confirmar que ele é verificável (tem número, mesmo que hipotético e marcado como tal) — não uma frase vaga como "aguenta bem".

**Acceptance Scenarios**:

1. **Given** o gate de maturidade cumprido pelo Meridian, **When** o teste de carga roda no cenário de referência (PI Planning de um cliente ICP: RTE + 3 ou mais ARTs), **Then** o resultado é comparado contra o critério de aprovação registrado (p95 < 2s nas telas críticas, erro < 1%), marcado explicitamente como hipótese não validada.
2. **Given** o teste de carga do Meridian, **When** ele roda, **Then** roda só em ambiente local ou staging dedicado — nunca contra produção.

---

### User Story 3 - Validar o número real de concorrência com os leads (Priority: P2)

O CPO/CEO substitui a hipótese de concorrência (algumas centenas de usuários simultâneos por tenant, dezenas de tenants ativos) por um número real, validado com os 3 leads (TOTVS como lead primário), antes de esse número virar critério de aprovação definitivo.

**Why this priority**: Um número de carga sem fonte pode otimizar a coisa errada (precedente já registrado em `docs/qualidade/escala-backoffice-10k.md`) — mas não bloqueia a existência do gate nem do SC do Meridian, que já nascem com o número marcado como hipótese.

**Independent Test**: Confirmar que existe um registro explícito (nesta spec ou em decisão subsequente) de que o número de concorrência foi validado com os leads, substituindo a hipótese.

**Acceptance Scenarios**:

1. **Given** a hipótese de concorrência registrada, **When** o CPO/CEO levanta o número com os 3 leads, **Then** o critério de aprovação do gate de carga é atualizado com o número validado, e deixa de ser rotulado como hipótese.
2. **Given** o número ainda não validado, **When** alguém aplica o gate de carga do Meridian, **Then** o resultado do teste é sempre acompanhado do aviso de que o critério de aprovação é hipotético.

---

### Edge Cases

- Produto sem nenhum dado de terceiro (ex.: Cosmos, se aplicável): o critério de compliance do gate não bloqueia — é tratado como cumprido por não-aplicabilidade, não como pendência.
- Produto com P2 aberto mas sem dono ou sem data: falha o critério de dogfood do gate mesmo tendo "só" P2 (a regra exige dono e data, não apenas ausência de P0/P1).
- Tentativa de rodar teste de carga contra produção: deve ser impedida/recusada — nunca uma execução válida, independente do gate.
- Produto que passa no gate mas ainda não tem SC de carga formal escrito (ex.: Charter, Signal, nesta rodada): fica apto a entrar na fila, mas sem SC formal ele não tem contra o que comparar resultado — esse SC é trabalho de rodada futura (fora de escopo aqui, exceto Meridian).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Deve existir um checklist único e reutilizável do gate de maturidade, aplicável a qualquer produto da suíte, com os três critérios: (1) SC formal verde no E2E da jornada da persona principal; (2) dogfood sem P0/P1 aberto, e todo P2 com dono e data; (3) condições de compliance cumpridas quando o produto coleta dado de terceiro.
- **FR-002**: O checklist MUST produzir um resultado rastreável por produto: apto ou não apto, com o(s) critério(s) específico(s) que causaram reprovação quando não apto.
- **FR-003**: O critério de compliance MUST ser tratado como não-aplicável (não bloqueante) para produtos que não coletam dado de terceiro.
- **FR-004**: O Meridian MUST ter um Success Criterion de carga formal e verificável, com o critério de aprovação (p95 < 2s nas telas críticas, erro < 1%) registrado explicitamente como hipótese até validação com os leads.
- **FR-005**: O cenário de referência do teste de carga do Meridian MUST ser o PI Planning de um cliente ICP (RTE + 3 ou mais ARTs).
- **FR-006**: Teste de carga MUST NOT rodar contra produção, em nenhuma hipótese — só ambiente local ou staging dedicado.
- **FR-007**: Todo resultado de teste de carga comparado contra o critério de aprovação hipotético MUST vir acompanhado do aviso de que o número é hipótese, não validado.
- **FR-008**: A ordem de entrada dos produtos no gate (Meridian → Charter → Signal → Scaffold/Cosmos/Backoffice) MUST ser registrada e seguida, refletindo a priorização já decidida pelo CPO.
- **FR-009**: O número de concorrência por tenant usado no critério de aprovação MUST ser atualizável — quando o CPO/CEO validar o número real com os leads, ele substitui a hipótese sem exigir reescrever o gate inteiro.

### Key Entities *(include if feature involves data)*

- **Gate de maturidade**: checklist com os três critérios, aplicado por produto; resultado é apto/não apto + motivo.
- **Success Criterion de carga**: por produto, associado a um cenário de referência e um critério de aprovação (número + se é hipótese ou validado).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Qualquer pessoa (PO, Maestro) consegue determinar se um produto está apto a entrar em teste de carga em menos de 5 minutos, usando só o checklist do gate — sem precisar perguntar a alguém.
- **SC-002**: O Meridian tem um SC de carga com número (mesmo que hipotético) — zero SCs de carga vagos ("aguenta bem", sem métrica) para ele.
- **SC-003**: 100% das execuções de teste de carga (de qualquer produto) rodam fora de produção.
- **SC-004**: O número de concorrência por tenant é atualizado de hipótese para validado assim que o levantamento com os leads acontece, sem exigir uma nova spec.

## Assumptions

- O checklist do gate é um artefato de processo (documento reutilizável), não um mecanismo de CI/deploy automatizado — quem aplica é uma pessoa (PO/Maestro), não um pipeline. Automatizar a checagem fica fora de escopo, a menos que peça futuro explícito.
- Charter, Signal, Scaffold, Cosmos e Backoffice não ganham SC de carga formal nesta rodada — só o gate (aplicável a todos) e o SC do Meridian.
- A validação do número de concorrência com os 3 leads é um levantamento de negócio (CPO/CEO), não uma tarefa de engenharia — esta spec registra a necessidade, não a executa.
- O risco técnico de k6 com Server Actions (IDs gerados no build) é decisão de implementação do Maestro — não condiciona nenhum requisito desta spec.

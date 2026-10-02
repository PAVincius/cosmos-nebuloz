# Feature Specification: Dispensa visível (D-28, PR 3)

**Feature Branch**: `017-scaffold-dispensa-visivel`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: terceiro de três PRs do Scaffold (D-28, `docs/produto/scaffold-prd.md` §10, commit `7fdcdadd`). Dispensa manual do entregável A2 por instância, pela consultora, com motivo obrigatório; motivo visível na fila de supervisão do back-office (FR-020, Painel). Prazo: `github/main` até 2026-11-07.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultora dispensa manualmente um entregável de uma trilha (Priority: P1)

Uma consultora olha uma trilha específica e decide que um entregável não se aplica a esse cliente, por um motivo que não se encaixa em nenhuma regra automática (nem módulo não contratado, nem perfil, nem overlay). Ela dispensa esse entregável, informando o motivo — a instância não desaparece, fica marcada como dispensada.

**Why this priority**: Hoje a única forma de dispensar é automática (regra do template) ou por overlay (customização de toda a trilha, PR 2). Não existe caminho para o caso pontual, de uma trilha específica, decidido no momento.

**Independent Test**: Numa trilha com um entregável ativo, dispensar manualmente com um motivo e conferir que a instância aparece como dispensada, com o motivo, sem afetar outras trilhas do mesmo template.

**Acceptance Scenarios**:

1. **Given** um entregável ativo numa trilha, **When** a consultora o dispensa informando um motivo, **Then** a instância passa a aparecer como dispensada, com esse motivo visível na trilha.
2. **Given** a mesma ação, **When** a consultora tenta dispensar sem informar motivo, **Then** o sistema recusa.
3. **Given** um usuário sem o papel consultor, **When** tenta dispensar um entregável, **Then** o sistema recusa.
4. **Given** um entregável já dispensado (por qualquer via — automática, overlay, ou manual), **When** alguém tenta atribuir responsável a ele, **Then** o sistema recusa, como já decidido no PR 1.
5. **Given** um entregável dispensado manualmente, **When** a dispensa é revertida pela própria consultora, **Then** o entregável volta a ativo — a dispensa manual não é definitiva.

---

### User Story 2 - O motivo da dispensa aparece na fila de supervisão do back-office (Priority: P1)

Um membro da equipe de supervisão abre o Painel no back-office e vê, para cada entregável dispensado de qualquer trilha, o motivo da dispensa — não só que algo foi dispensado, mas por quê, e por qual via (automática, overlay, ou manual).

**Why this priority**: É a exigência de origem da D-24: entregável dispensado "não some" e precisa aparecer na supervisão. Sem isto, a dispensa continua existindo só no banco — invisível para quem deveria acompanhar.

**Independent Test**: Dispensar um entregável por qualquer via, abrir a fila de supervisão no back-office, e conferir que ele aparece com o motivo, a trilha e o cliente.

**Acceptance Scenarios**:

1. **Given** um entregável dispensado em qualquer trilha, **When** a fila de supervisão do back-office é aberta, **Then** ele aparece listado com o motivo da dispensa, a trilha e o cliente.
2. **Given** vários entregáveis dispensados por vias diferentes (automática, overlay, manual), **When** a fila é aberta, **Then** todos aparecem, sem distinção que esconda algum tipo.
3. **Given** a fila de supervisão, **When** alguém tenta dispensar ou reativar um entregável a partir dela, **Then** não há ação disponível — a fila é só leitura.

---

### Edge Cases

- **Entregável dispensado automaticamente (regra do template) ou por overlay**: aparece na mesma fila, com o motivo que o sistema já gera para esses casos — não é exclusiva da dispensa manual.
- **Entregável já aprovado ou em andamento**: dispensar exige primeiro o estado compatível — não decide aqui a máquina de estados do entregável além de recusar dispensar o que já está fora do caminho (ex.: já aprovado).
- **Trilha sem nenhum entregável dispensado**: não aparece na fila — a fila lista entregáveis, não trilhas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que um consultor dispense manualmente um entregável ativo de uma trilha específica, informando um motivo obrigatório.
- **FR-002**: Dispensar sem motivo MUST ser recusado.
- **FR-003**: Dispensar MUST ser restrito ao papel consultor.
- **FR-004**: A dispensa manual MUST poder ser revertida pela consultora, voltando o entregável a ativo.
- **FR-005**: A fila de supervisão do back-office MUST listar todo entregável dispensado de qualquer trilha, com o motivo, a trilha e o cliente — independentemente de a dispensa ter sido automática, por overlay, ou manual.
- **FR-006**: A fila de supervisão MUST ser somente leitura — nenhuma ação de dispensar ou reativar a partir dela.

### Key Entities

Nenhuma entidade nova. Reaproveita `ScaffoldDeliverableInstance` (campo `dispensedReason` já existente) — a novidade é a ação de dispensar/reverter por instância e a leitura dela no back-office.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma consultora dispensa um entregável de uma trilha com motivo, em menos de um minuto, sem sair da trilha.
- **SC-002**: Todo entregável dispensado, por qualquer via, aparece na fila de supervisão do back-office com o motivo — verificável por amostragem cobrindo os três tipos de dispensa (automática, overlay, manual).
- **SC-003**: Toda tentativa de dispensar sem motivo, ou por quem não é consultor, é recusada, em 100% das tentativas testadas.
- **SC-004**: Nenhum teste pré-existente do Scaffold fica vermelho depois desta entrega.

## Assumptions

- Esta entrega depende dos PRs 1 e 2 estarem em `github/main` antes de abrir, por sequência de produto (a dispensa por overlay do PR 2 é um dos três tipos que a fila do PR 3 lista) — não por dependência técnica de PR aberto.
- Reverter a dispensa manual é permitido pela própria consultora, pela mesma trilha — não é tratado como ação de supervisão do back-office.

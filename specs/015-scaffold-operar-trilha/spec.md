# Feature Specification: Operar a trilha pela tela (D-28, PR 1)

**Feature Branch**: `015-scaffold-operar-trilha`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: primeiro de três PRs do Scaffold (D-28, `docs/produto/scaffold-prd.md` §10, commit `7fdcdadd`). (0) achados do Vigia sobre o #331 (validação de overlay ausente em dois caminhos, atribuição a entregável dispensado, origem da trilha sem checar estado do assessment, `sourceAssessmentId` divergente do gap); (1) decisão do gate na tela via `closePhase` — critérios, evidência, motivo de bloqueio, override restrito por permissão; (3) modal "Nova trilha" — ordem do DOM, foco, Tab preso, Esc fecha. Prazo: `github/main` até 2026-10-07.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nenhum caminho contorna a regra do overlay ou do estado da trilha (Priority: P1)

Um administrador resolve um conflito de overlay, semeia uma trilha, atribui responsável a um entregável, ou cria uma trilha a partir de um gap — e em nenhum desses quatro caminhos consegue, sem querer ou sem papel, contornar as regras que a criação normal de overlay já aplica.

**Why this priority**: São furos encontrados pelo Vigia sobre o #331, já aprovado com ressalvas. Entram antes dos itens de tela porque a tela de gate passa a exercitar exatamente esses caminhos — testar a tela sobre um furo aberto provaria menos do que parece.

**Independent Test**: Para cada um dos quatro achados, reproduzir o caminho que hoje contorna a regra e confirmar que passa a ser recusado (ou a exigir o que falta), sem quebrar o caminho que já funciona (`saveOverlay`).

**Acceptance Scenarios**:

1. **Given** um overlay com conflito pendente cuja resolução `keep_overlay` manteria um REMOVE de entregável que virou obrigatório na versão nova, **When** alguém sem o papel CONSULTANT tenta resolver com `keep_overlay`, **Then** o sistema recusa, do mesmo jeito que `saveOverlay` já recusa um REMOVE de obrigatório fora do papel certo.
2. **Given** a mesma resolução `keep_overlay` sobre o mesmo conflito, **When** um CONSULTANT resolve informando motivo, **Then** é aceita.
3. **Given** um overlay que viola a regra de REMOVE de obrigatório (ex.: já ficou inválido por uma versão nova), **When** uma trilha é criada a partir da versão com esse overlay, **Then** a criação é recusada, com a mesma mensagem que `saveOverlay` usaria.
4. **Given** um entregável dispensado (automaticamente ou por overlay), **When** alguém tenta atribuir responsável ou aprovador a ele, **Then** o sistema recusa — entregável dispensado precisa ser reativado antes de receber responsável.
5. **Given** um assessment do Meridian em DRAFT ou COLLECTING, **When** alguém tenta criar uma trilha de prontidão apontando para ele, **Then** a criação é recusada; **When** o assessment está em REVIEW ou FINALISED, **Then** a criação é aceita — a exigência não é "só FINALISED", porque nenhum caminho do produto grava esse estado hoje.
6. **Given** uma trilha criada a partir de um gap promovido, **When** o `sourceAssessmentId` informado não é o mesmo assessment desse gap, **Then** a criação é recusada.

---

### User Story 2 - Decisão do gate pela tela, com evidência e override restrito (Priority: P1)

Uma consultora avalia os critérios manuais de uma fase, registra uma nota de evidência por critério, e fecha o gate — ou, se algo não está atendido, vê o botão desabilitado com o motivo e, se tiver o papel certo, registra um override.

**Why this priority**: Sem isto, nenhuma trilha passa de fase pela interface, e todo o resto do produto (entregáveis, gaps, planos) fica sem uso real. É o item que "trava tudo", segundo a própria ordem do CEO em D-28.

**Independent Test**: Levar uma trilha (o Atlas) da ASSESS ao EMBED só pela tela: fechar um gate com todos os critérios atendidos e evidência registrada; provocar um bloqueio (entregável obrigatório pendente) e ver o motivo no botão desabilitado; registrar um override como consultor e confirmar que alguém sem o papel não vê a opção.

**Acceptance Scenarios**:

1. **Given** uma fase com critérios manuais pendentes de avaliação, **When** a consultora marca cada critério como atendido ou não, com uma nota de evidência por critério, **Then** a tela guarda esses fatos para o fechamento.
2. **Given** todos os critérios atendidos e nenhum entregável obrigatório pendente, **When** a consultora fecha o gate, **Then** o fechamento é registrado com os fatos e a nota de evidência de cada critério, e a trilha de auditoria recebe a entrada.
3. **Given** um entregável obrigatório ainda pendente, **When** a tela é aberta, **Then** o botão de fechar aparece desabilitado com o motivo escrito ao lado — não só a recusa do servidor depois do clique.
4. **Given** um critério manual marcado como não atendido, **When** a consultora tenta fechar, **Then** o servidor recusa (SG-02), a fase vai a bloqueada, e só a partir daí a opção de override aparece.
5. **Given** a fase bloqueada, **When** um usuário sem a permissão de override abre a tela, **Then** a opção de override não aparece — não é só o clique que falha depois.
6. **Given** a mesma fase bloqueada, **When** um usuário com a permissão registra o override com os critérios dispensados e a justificativa, **Then** o override é aceito e auditado.
7. **Given** uma fase já fechada, **When** reaberta, **Then** exige justificativa como qualquer decisão que reescreve o histórico, e quem não tem a permissão de reabrir não vê a opção.

---

### User Story 3 - Modal "Nova trilha" navegável só pelo teclado (Priority: P2)

Alguém abre o modal de criar trilha usando só o teclado: o foco começa no primeiro campo, Tab percorre os campos antes de chegar aos botões de ação, o foco nunca escapa do modal, e Esc fecha.

**Why this priority**: É pequeno, mas está no caminho de toda trilha nova — o primeiro passo de qualquer demo e de qualquer cliente novo.

**Independent Test**: Abrir o modal só pelo teclado, confirmar a ordem de Tab (campos antes de Cancelar/Criar), confirmar que Tab não sai do modal, e que Esc fecha.

**Acceptance Scenarios**:

1. **Given** o modal "Nova trilha" aberto, **When** examinada a ordem do DOM, **Then** os campos do formulário vêm antes dos botões Cancelar e Criar trilha — hoje é o contrário, porque o componente compartilhado `ModalShell` (`apps/app/components/charter/modal.tsx`) renderiza as ações antes do corpo.
2. **Given** o modal aberto, **When** o usuário pressiona Tab repetidamente, **Then** o foco nunca sai do modal — percorre os campos e os botões e volta ao início.
3. **Given** o modal aberto, **When** o usuário pressiona Esc, **Then** o modal fecha e o foco volta ao controle que abriu.

---

### Edge Cases

- **Aprovador do gate continua fixo no dono do processo** (`track.ownerId`) nesta entrega — não existe seletor de aprovador. Entra quando houver caso real de outra pessoa assinar; não é um furo desta spec, é escopo deliberadamente não ampliado.
- **Correção no `ModalShell` compartilhado**: o achado da ordem do DOM é no componente usado por Scaffold, Charter e Meridian. O critério de pronto desta spec cobre só a tela "Nova trilha" do Scaffold; o benefício nos outros produtos é consequência, não requisito testado aqui.
- **`resolveConflict` com `take_upstream` ou `drop_operation`**: já removem a operação em disputa hoje — não precisam da mesma trava de `keep_overlay`, porque não mantêm um REMOVE que se tornou inválido.

## Requirements *(mandatory)*

### Functional Requirements — Achados do Vigia

- **FR-001**: Resolver um conflito de overlay com `keep_overlay` MUST aplicar a mesma validação (`validateOverlay`) que `saveOverlay` já aplica; quando a resolução mantém um REMOVE de entregável obrigatório, MUST exigir o papel consultor e motivo, e recusar sem os dois.
- **FR-002**: Criar uma trilha a partir de uma versão com overlay associado MUST validar esse overlay (`validateOverlay`) antes de aplicá-lo; violação bloqueante MUST recusar a criação, com a mesma mensagem que `saveOverlay` produziria.
- **FR-003**: Atribuir responsável ou aprovador a um entregável dispensado MUST ser recusado — a atribuição só vale para entregável ativo.
- **FR-004**: A origem de uma trilha de prontidão MUST exigir um assessment do Meridian com coleta fechada (estado de revisão ou finalizado) — nunca um em rascunho ou em coleta, e nunca restrito só ao estado finalizado.
- **FR-005**: Criar uma trilha a partir de um gap promovido MUST exigir que o assessment de origem informado seja o mesmo assessment desse gap; divergência MUST ser recusada.

### Functional Requirements — Gate na tela

- **FR-006**: A tela de avaliar uma fase MUST permitir registrar, para cada critério manual, se foi atendido e uma nota de evidência — o mesmo par que o servidor já aceita (`met`, `note`).
- **FR-007**: O botão de fechar gate MUST aparecer desabilitado, com o motivo de bloqueio escrito na tela, quando houver entregável obrigatório pendente — antes de qualquer tentativa de clique.
- **FR-008**: Fechar o gate, registrar override, e reabrir uma fase MUST continuar sendo auditado (comportamento já existente no servidor; a tela aciona essas mesmas ações, nunca as contorna).
- **FR-009**: A opção de registrar override MUST aparecer na tela somente para quem tem a permissão correspondente — hoje a tela mostra a opção para qualquer pessoa e deixa a recusa só para o servidor.
- **FR-010**: A opção de reabrir uma fase fechada MUST aparecer na tela somente para quem tem a permissão correspondente, pela mesma razão do FR-009.

### Functional Requirements — Modal "Nova trilha"

- **FR-011**: No modal "Nova trilha", os campos do formulário MUST vir antes dos botões de ação (Cancelar, Criar trilha) na ordem do DOM.
- **FR-012**: O foco do teclado MUST permanecer dentro do modal enquanto ele estiver aberto (Tab não escapa para o restante da página).
- **FR-013**: Pressionar Esc MUST fechar o modal e devolver o foco ao controle que o abriu.

### Key Entities

Nenhuma entidade nova. Reaproveita os modelos e os mecanismos já existentes (`ScaffoldTemplateOverlay`, `ScaffoldDeliverableInstance`, `ScaffoldGateCriterion`, `MeridianAssessment`, `MeridianGapPromotion`) e o componente `ModalShell` já compartilhado entre produtos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um E2E leva a trilha do Atlas da ASSESS ao EMBED só pela interface, incluindo pelo menos um gate bloqueado mostrando o motivo e um override registrado.
- **SC-002**: Nenhum dos quatro achados do Vigia continua reproduzível — verificável um a um, com teste dedicado por achado.
- **SC-003**: Em nenhuma fase a opção de override ou de reabrir aparece para um usuário sem a permissão correspondente, verificável testando com um papel sem essa permissão.
- **SC-004**: No modal "Nova trilha", Tab não sai do modal e Esc fecha, verificável por teste de teclado (sem mouse).
- **SC-005**: Nenhum teste pré-existente do Scaffold fica vermelho depois desta entrega.

## Assumptions

- O aprovador do gate continua sendo o dono do processo (`track.ownerId`), sem seletor — mudança de escopo futura, não desta entrega.
- A correção de ordem do DOM no `ModalShell` é feita no componente compartilhado, mas o teste de aceite desta spec cobre só o modal "Nova trilha" do Scaffold.
- Este PR não depende de nenhum outro PR aberto; os testes entram junto, por regra do CEO.

# Feature Specification: Estágio de Intent (idea → intent.md aprovado)

**Feature Branch**: `001-add-intent-stage`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Criar /speckit-intent: skill que implementa o estágio idea→intent.md aprovado por humano, rodando antes de /speckit-specify, com gate técnico via extensão before_specify"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capturar uma ideia como intent.md (Priority: P1)

Como desenvolvedor do cosmos-nebuloz, ao ter uma ideia de feature, rodo `/speckit-intent <descrição em linguagem natural>` e recebo de volta um `intent.md` versionado (problema, contexto, restrições, resultado desejado, fora de escopo) numa pasta de feature numerada, em vez de pular direto pra escrever spec ou código.

**Why this priority**: é o ponto de entrada do ciclo inteiro — sem ele não existe "estágio 1", e nenhuma das outras histórias faz sentido.

**Independent Test**: rodar `/speckit-intent "toggle de dark mode nas configurações"` e confirmar que `specs/NNN-*/intent.md` existe com as 5 seções preenchidas e frontmatter `status: draft`.

**Acceptance Scenarios**:

1. **Given** nenhuma pasta de feature existe pra essa ideia, **When** rodo `/speckit-intent <ideia>`, **Then** uma pasta numerada sequencialmente é criada em `specs/` e `intent.md` é escrito nela com `status: draft`.
2. **Given** já existe uma pasta de feature pra essa ideia (rodei `/speckit-intent` antes pra ela), **When** rodo `/speckit-intent` de novo referenciando a mesma feature, **Then** o `intent.md` existente é editado, nenhuma pasta nova é criada.

---

### User Story 2 - Ser desafiado antes de fechar o intent ("roast me") (Priority: P1)

Como desenvolvedor, antes do intent.md ser considerado pronto pra aprovação, quero que o agente me faça perguntas céticas sobre riscos e suposições não ditas — não perguntas de preenchimento de lacuna, perguntas que testam se a ideia se sustenta.

**Why this priority**: é o que diferencia esse estágio de só "escrever um README da ideia" — sem o questionamento adversarial, o intent.md vira teatro burocrático.

**Independent Test**: rodar `/speckit-intent` com uma ideia vaga de propósito e confirmar que recebo pelo menos 1 e no máximo 5 perguntas céticas, uma de cada vez, antes do resumo final.

**Acceptance Scenarios**:

1. **Given** estou no meio do fluxo de `/speckit-intent`, **When** o agente identifica riscos ou suposições não ditas na ideia, **Then** ele faz até 5 perguntas céticas, uma por vez, aguardando minha resposta antes da próxima.
2. **Given** a ideia já é bem fundamentada e não tem lacunas relevantes, **When** o agente avalia, **Then** ele pode seguir com menos de 5 perguntas (ou nenhuma) em vez de forçar o número máximo.

---

### User Story 3 - Aprovar (ou pedir mudança) explicitamente (Priority: P1)

Como desenvolvedor, depois do resumo do intent.md, quero aprovar explicitamente no chat antes do arquivo virar `status: approved` — e poder pedir mudanças em vez disso, sem que o agente marque como aprovado sozinho.

**Why this priority**: é o gate humano do ciclo inteiro — sem aprovação explícita e sem controle sobre quando o status muda, "human approves it" (do enunciado original) não existe de verdade.

**Independent Test**: no resumo final, responder "não, ajusta X" e confirmar que o `status` continua `draft` e o conteúdo é editado; numa segunda rodada, responder "aprovado" e confirmar que o `status` vira `approved` e o arquivo é commitado.

**Acceptance Scenarios**:

1. **Given** o agente apresentou o resumo do intent.md, **When** respondo com aprovação explícita, **Then** o frontmatter muda pra `status: approved` e o commit é feito.
2. **Given** o agente apresentou o resumo, **When** peço uma mudança em vez de aprovar, **Then** o conteúdo é editado e um novo resumo é apresentado, com `status` permanecendo `draft`.
3. **Given** o intent.md nunca foi aprovado, **When** eu olho o arquivo a qualquer momento, **Then** o `status` no frontmatter é `draft` — nunca muda sem minha aprovação explícita no chat.

---

### User Story 4 - Bloquear /speckit-specify sem intent aprovado (Priority: P2)

Como desenvolvedor, se eu (ou outra pessoa do time) tentar rodar `/speckit-specify` pra uma feature sem passar por `/speckit-intent` primeiro (ou com intent ainda em draft), quero ser bloqueado com uma mensagem clara, em vez de o spec ser gerado silenciosamente sem intent aprovado por trás.

**Why this priority**: é o que torna o estágio 1 obrigatório de fato, não só uma convenção que pode ser pulada — mas o ciclo já funciona (com disciplina manual) sem isso, por isso é P2 e não P1.

**Independent Test**: rodar `/speckit-specify` direto (sem intent.md na pasta da feature-alvo, ou com `status: draft`) e confirmar que a execução para com mensagem explicando o motivo e sugerindo rodar `/speckit-intent` primeiro — sem gerar `spec.md` nem seguir adiante silenciosamente.

**Acceptance Scenarios**:

1. **Given** uma feature não tem `intent.md`, **When** rodo `/speckit-specify` pra ela, **Then** a execução é bloqueada com mensagem clara, sem bypass silencioso.
2. **Given** uma feature tem `intent.md` com `status: draft`, **When** rodo `/speckit-specify` pra ela, **Then** a execução é bloqueada do mesmo jeito.
3. **Given** uma feature tem `intent.md` com `status: approved`, **When** rodo `/speckit-specify` pra ela, **Then** a execução segue normalmente, sem interferência do gate.

### Edge Cases

- O que acontece se eu editar o `status` manualmente pra `approved` no arquivo, sem passar pelo fluxo de aprovação no chat? → Fora do controle técnico do skill (é um arquivo de texto versionado); o gate confia no frontmatter como está no momento em que `/speckit-specify` roda. Aceito como limitação conhecida — a integridade do processo depende de disciplina do time, não só de enforcement técnico.
- O que acontece se `/speckit-intent` for chamado sem nenhuma descrição de ideia? → Erro claro pedindo a descrição, nenhuma pasta é criada.
- O que acontece se o hook técnico (`before_specify`) estiver desabilitado ou mal configurado (YAML inválido em `extensions.yml`)? → Segue o comportamento já existente do `speckit-specify` pra hooks quebrados: falha silenciosa do parsing do hook, mas isso significa que o gate não bloqueia nesse caso — risco aceito e documentado, não corrigido nesta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O comando `/speckit-intent <descrição>` MUST criar (ou reusar, se já existir) uma pasta de feature numerada sequencialmente em `specs/`, seguindo a mesma convenção de numeração já usada por `/speckit-specify`.
- **FR-002**: O comando MUST escrever/atualizar `intent.md` na pasta da feature, com frontmatter YAML contendo o campo `status` (`draft` ou `approved`) e as seções Problema, Contexto, Restrições, Resultado desejado e Fora de escopo.
- **FR-003**: Antes de apresentar o resumo final, o agente MUST fazer entre 0 e 5 perguntas céticas ("roast me") sobre riscos e suposições não ditas, uma de cada vez, aguardando resposta antes de prosseguir para a próxima.
- **FR-004**: O agente MUST apresentar um resumo do intent.md consolidado e pedir aprovação explícita do humano antes de alterar o `status` para `approved`.
- **FR-005**: O `status` do frontmatter MUST permanecer `draft` até aprovação explícita no chat — o agente MUST NOT mudar para `approved` por conta própria.
- **FR-006**: Quando o humano pede mudança em vez de aprovar, o agente MUST editar o conteúdo e repetir o resumo, mantendo `status: draft`.
- **FR-007**: Após aprovação, o agente MUST commitar o `intent.md` com `status: approved`.
- **FR-008**: O sistema MUST bloquear a execução de `/speckit-specify` para uma feature cujo `intent.md` não existe ou tem `status` diferente de `approved`, apresentando mensagem explicando o motivo e sugerindo rodar `/speckit-intent` primeiro.
- **FR-009**: O bloqueio do FR-008 MUST ser implementado via o mecanismo de extensão já existente no projeto (hooks em `.specify/extensions.yml`), sem modificar os templates de comando vendored do speckit.
- **FR-010**: Uma feature com `intent.md` já em `status: approved` MUST permitir a execução normal de `/speckit-specify`, sem interferência do gate.

### Key Entities

- **intent.md**: documento versionado por feature, vive em `specs/NNN-nome/intent.md`. Frontmatter: `status` (`draft` | `approved`). Corpo: Problema, Contexto, Restrições, Resultado desejado, Fora de escopo.
- **Feature directory**: pasta numerada sequencialmente (`specs/NNN-nome/`), compartilhada entre `intent.md` e o `spec.md` gerado posteriormente por `/speckit-specify` para a mesma feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Toda feature nova criada no repo a partir da adoção deste estágio tem um `intent.md` com `status: approved` antes de existir um `spec.md` correspondente.
- **SC-002**: Uma tentativa de rodar `/speckit-specify` sem intent aprovado é bloqueada em 100% dos casos (verificável rodando o cenário de teste do FR-008 repetidamente).
- **SC-003**: O ciclo completo idea → intent.md aprovado (incluindo as perguntas céticas) é percorrido em uma única sessão de chat, sem exigir comandos extras do humano além de responder perguntas e aprovar.

## Assumptions

- O humano que aprova o intent.md é sempre quem está na conversa no momento — não há fluxo de aprovação assíncrona por terceiros (ex: outro membro do time aprovando depois).
- "Commitar o intent.md" significa um `git commit` local convencional (Conventional Commits, sem Co-Authored-By, seguindo convenção já estabelecida no repo) — não inclui push nem abertura de PR.
- O mecanismo de extensão (`before_specify` hook) do speckit já documentado no projeto é estável o suficiente pra construir sobre ele; não há necessidade de validar se ele funciona antes de depender dele (já é usado por `after_specify`/`after_plan` no hook `agent-context`).
- Esta feature cobre só o Estágio 1 do ciclo maior de 7 estágios descrito pelo usuário. Os estágios 2 (spec.md lendo regras da empresa — já parcialmente coberto pela constitution.md existente), 5 (agente revisa agente em PR), 6 (hooks determinísticos gerais) e 7 (produção→intent.md) são fora de escopo, cada um vira feature própria depois.

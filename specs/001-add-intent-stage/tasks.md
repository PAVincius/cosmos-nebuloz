---

description: "Task list template for feature implementation"
---

# Tasks: Estágio de Intent (idea → intent.md aprovado)

**Input**: Design documents from `/specs/001-add-intent-stage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md — todos presentes.

**Tests**: não solicitados no spec.md — feature é tooling de skills/prompts, sem framework de teste automatizado aplicável (ver Constitution Check em plan.md, princípio III adaptado). Verificação é o walkthrough manual de `quickstart.md` (Fase de Polish).

**Organization**: tasks agrupadas por user story. US1/US2/US3 são seções sequenciais do mesmo arquivo (`speckit-intent/SKILL.md`) — não paralelizáveis entre si (mesmo arquivo), mas cada uma testável isoladamente via os cenários correspondentes em `quickstart.md`. US4 é um conjunto de arquivos independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1, US2, US3, US4 (mapeiam pra spec.md)

## Path Conventions

Tooling sob `.claude/skills/` e `.specify/` — sem `src/`/`tests/` de aplicação (ver Project Structure em plan.md).

---

## Phase 1: Setup

**Purpose**: esqueleto de diretórios pros artefatos novos

- [X] T001 Criar diretórios `.claude/skills/speckit-intent/`, `.claude/skills/speckit-intent-gate-check/`, `.specify/extensions/intent-gate/commands/`, `.specify/extensions/intent-gate/scripts/bash/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestrutura mínima que US1 depende

**⚠️ CRITICAL**: bloqueia início de US1

- [X] T002 Criar `.specify/templates/intent-template.md` — frontmatter `status: draft` + 5 seções vazias (Problema, Contexto, Restrições, Resultado desejado, Fora de escopo), resolvido pelo mesmo mecanismo de preset/template stack que `spec-template.md` já usa (ver data-model.md)

**Checkpoint**: template pronto — US1 pode começar

---

## Phase 3: User Story 1 - Capturar ideia como intent.md (Priority: P1) 🎯 MVP

**Goal**: `/speckit-intent <descrição>` cria/reusa pasta numerada e escreve `intent.md` com `status: draft`.

**Independent Test**: Cenário 1 de `quickstart.md` — `/speckit-intent toggle de dark mode nas configurações` produz `specs/NNN-toggle-dark-mode/intent.md` com as 5 seções preenchidas.

### Implementation for User Story 1

- [X] T003 [US1] Escrever `.claude/skills/speckit-intent/SKILL.md` — frontmatter do skill (name, description, argument-hint) + seção de execução: parse do argumento (erro claro se vazio, per contracts/speckit-intent-command.md), chamada de `.specify/scripts/bash/create-new-feature.sh --short-name <nome> --allow-existing-branch <descrição>`, escrita de `intent.md` a partir de `intent-template.md` com `status: draft` preenchido com os dados extraídos da descrição

**Checkpoint**: US1 funcional isoladamente — `intent.md` é criado, mesmo sem roast-me nem gate ainda (perguntas/aprovação ficam para US2/US3)

---

## Phase 4: User Story 2 - Roast me antes de fechar (Priority: P1)

**Goal**: antes do resumo final, o skill faz até 5 perguntas céticas, uma por vez.

**Independent Test**: Cenário 2 de `quickstart.md` — durante o fluxo do Cenário 1, entre 1 e 5 perguntas céticas aparecem, uma de cada vez, aguardando resposta.

### Implementation for User Story 2

- [X] T004 [US2] Adicionar a `.claude/skills/speckit-intent/SKILL.md` (mesmo arquivo de T003, depende dele) a seção "Modo roast me": instrução pro agente identificar riscos/suposições não ditas na descrição e no `intent.md` rascunhado por T003, fazer entre 0 e 5 perguntas céticas (tom cético, não colaborativo — contraste explícito com o tom de `speckit-clarify`), uma pergunta por vez, aguardando resposta antes da próxima

**Checkpoint**: US1+US2 funcionais juntas — intent.md rascunhado e desafiado, ainda sem aprovação (US3)

---

## Phase 5: User Story 3 - Aprovação explícita (Priority: P1)

**Goal**: `status` só vira `approved` com aprovação explícita do humano no chat; pedido de mudança mantém `draft` e repete o resumo.

**Independent Test**: Cenário 3 de `quickstart.md` — responder "ajusta X" mantém `draft` e edita; responder "aprovado" muda pra `approved` e commita.

### Implementation for User Story 3

- [X] T005 [US3] Adicionar a `.claude/skills/speckit-intent/SKILL.md` (mesmo arquivo, depende de T004) a seção final: apresentar resumo consolidado do `intent.md`, aguardar resposta explícita; se aprovação → editar frontmatter para `status: approved` e `git commit` (Conventional Commits, sem Co-Authored-By, seguindo convenção do repo); se pedido de mudança → editar conteúdo, manter `status: draft`, repetir o resumo (nunca mudar status sozinho)

**Checkpoint**: `/speckit-intent` completo e funcional ponta-a-ponta (US1+US2+US3) — MVP do estágio de intent pronto para uso, mesmo sem o gate técnico de US4

---

## Phase 6: User Story 4 - Bloquear /speckit-specify sem intent aprovado (Priority: P2)

**Goal**: `/speckit-specify` recusa rodar se `intent.md` da feature-alvo não existe ou não está `approved`.

**Independent Test**: Cenário 4 de `quickstart.md` — `/speckit-specify` numa feature sem intent (ou com `draft`) bloqueia com mensagem clara; com `approved`, roda normal.

### Implementation for User Story 4

- [X] T006 [P] [US4] Criar `.specify/extensions/intent-gate/extension.yml` — metadata (id: intent-gate, commands: speckit.intent-gate.check → commands/speckit.intent-gate.check.md, hooks.before_specify: optional false), seguindo o padrão de `.specify/extensions/agent-context/extension.yml`
- [X] T007 [P] [US4] Criar `.specify/extensions/intent-gate/scripts/bash/check-intent-approved.sh` — recebe `<feature-dir>`, extrai `status:` do frontmatter de `intent.md` via grep/sed (sem dependência de yq/python3, ver research.md), exit code 0 se `approved`, exit code 1 com mensagem clara nos demais casos (arquivo ausente, `status` != `approved`, `<feature-dir>` vazio) — per contracts/intent-gate-check.md
- [X] T008 [US4] Criar `.specify/extensions/intent-gate/commands/speckit.intent-gate.check.md` — doc do comando (frontmatter `description`, seção "Execution" apontando pro script de T007), mesmo padrão de `commands/speckit.agent-context.update.md` (depende de T006, T007)
- [X] T009 [US4] Criar `.claude/skills/speckit-intent-gate-check/SKILL.md` — espelho invocável do comando de T008, mesmo padrão de `speckit-agent-context-update/SKILL.md` (depende de T008)
- [X] T010 [US4] Editar `.specify/extensions.yml` (raiz) — adicionar `intent-gate` em `installed:`, adicionar entrada em `hooks.before_specify` (extension: intent-gate, command: speckit.intent-gate.check, enabled: true, optional: false, priority, description, condition: null), seguindo o formato já usado por `hooks.after_specify`/`hooks.after_plan` existentes (depende de T006, T007, T009)

**Checkpoint**: ciclo completo — US1+US2+US3+US4 — `/speckit-specify` agora exige intent aprovado

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T011 [P] Rodar os 4 cenários de `quickstart.md` manualmente, confirmar todos passam (inclui a verificação de não-regressão do cenário 4)
- [X] T012 Criar `.claude/completions/2026-08-27-add-intent-stage.md` documentando a implementação, conforme convenção da constitution ("Completion doc por task")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende de Setup — bloqueia US1
- **US1 (Phase 3)**: depende de Foundational
- **US2 (Phase 4)**: depende de US1 (mesmo arquivo, T004 edita o que T003 criou)
- **US3 (Phase 5)**: depende de US2 (mesmo arquivo, T005 edita o que T004 criou)
- **US4 (Phase 6)**: depende de Setup apenas (T006/T007 são arquivos novos, independentes de US1-3) — mas testável de ponta a ponta só depois de US1-3 existirem (precisa de um `/speckit-intent` funcional pra gerar o `intent.md` que o gate vai checar)
- **Polish (Phase 7)**: depende de todas as fases anteriores

### Within US4

T006 e T007 são paralelizáveis entre si (arquivos diferentes, sem dependência). T008 depende de ambos. T009 depende de T008. T010 depende de T006, T007 e T009.

### Parallel Opportunities

- T006 e T007 (arquivos diferentes dentro de US4)
- T011 pode rodar em paralelo com T012 (verificação vs. documentação, sem dependência entre si)

---

## Parallel Example: User Story 4

```bash
# T006 e T007 podem ser feitos em paralelo:
Task: "Criar .specify/extensions/intent-gate/extension.yml"
Task: "Criar .specify/extensions/intent-gate/scripts/bash/check-intent-approved.sh"
```

---

## Implementation Strategy

### MVP First (User Stories 1+2+3)

1. Setup (T001) + Foundational (T002)
2. US1 → US2 → US3 (mesmo arquivo, sequencial) = `/speckit-intent` completo e usável
3. **STOP e VALIDA**: rodar Cenários 1-3 de `quickstart.md`
4. US4 (gate técnico) é incremento separado — o MVP já entrega valor sem ele (disciplina manual de rodar `/speckit-intent` antes de `/speckit-specify`, sem enforcement)

### Incremental Delivery

1. Setup + Foundational → base pronta
2. US1+US2+US3 → `/speckit-intent` funcional → validar Cenários 1-3 → MVP
3. US4 → gate técnico → validar Cenário 4 → ciclo completo
4. Polish → completion doc + validação final

---

## Notes

- US1/US2/US3 não são paralelizáveis entre si (mesmo arquivo `SKILL.md`) — a "independência" delas é de teste/valor, não de execução concorrente.
- T006/T007 são o único par [P] real desta feature.
- Sem tarefas de teste automatizado — verificação é o walkthrough de `quickstart.md` (T011).
- Commit após cada task ou grupo lógico (US1+US2+US3 podem ser um commit; US4 outro).

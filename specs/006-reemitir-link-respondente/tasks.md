# Tasks: Reemitir link do respondente (Meridian)

**Input**: Design documents from `specs/006-reemitir-link-respondente/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/actions.md, quickstart.md

**Tests**: Test-First é NON-NEGOTIABLE nesta constituição (`.specify/memory/constitution.md` III) — teste antes de implementação em cada task, mesmo sem pedido explícito na spec.

**Organization**: US1 (reemitir link individual, P1), US2 (reemitir e copiar todos os pendentes, P1) — US2 reaproveita o mecanismo de US1 (o próprio PRD registra "opção c, feita em cima da a"), então depende de US1 estar pronta.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Confirmar que `hashToken`/`issueToken` (`apps/app/lib/meridian/respondent-token.ts`) já exportam o necessário pra reemissão — sem mudança esperada, só checagem antes de codar.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cálculo de `tokenExpiresAt` da reemissão — usado por US1 e, através dela, por US2.

- [x] T002 [P] Teste unitário de `calcularExpiracaoDaReemissao(deadline, now)` = `min(now + 14 dias, deadline)` — `apps/app/__tests__/meridian/respondent-token.test.ts`. Escrever e confirmar que FALHA.
- [x] T003 Implementar `calcularExpiracaoDaReemissao` em `apps/app/lib/meridian/respondent-token.ts` (depende de T002 falhando).

**Checkpoint**: Helper de expiração pronto — US1 pode prosseguir.

---

## Phase 3: User Story 1 - Reemitir link de um respondente (Priority: P1) 🎯 MVP

**Goal**: Reemitir o link de um respondente específico, sem criar novo respondente, bloqueado para `DONE`/`REVOKED`/prazo vencido, com auditoria.

**Independent Test**: Atribuir um respondente, "Reemitir link", confirmar que o link novo funciona e o antigo não; testar os três bloqueios.

### Tests for User Story 1

- [x] T004 [P] [US1] Teste de `reissueRespondentLink`: sucesso (preserva id/axis/status, invalida link antigo, grava auditoria `meridian.respondent.reissue`) — `apps/app/__tests__/meridian/collection.test.ts`. Escrever e confirmar que FALHA.
- [x] T005 [P] [US1] Teste de `reissueRespondentLink`: bloqueio para `DONE`, para `REVOKED`, e para assessment com `deadline` vencido — mesmo arquivo de T004. Escrever e confirmar que FALHA.
- [x] T006 [P] [US1] Teste E2E (Playwright) dos cenários 1–3 do quickstart — `apps/app/e2e/meridian-reemitir-link.spec.ts`. Escrever e confirmar que FALHA.

### Implementation for User Story 1

- [x] T007 [US1] Implementar `reissueRespondentLink` em `apps/app/app/(meridian)/actions/collection.ts` (usa T003, segue o padrão de `revokeRespondent`/`assignRespondent`; depende de T004/T005 falhando).
- [x] T008 [US1] Adicionar botão "Reemitir link" na linha do respondente em `apps/app/components/meridian/screens/tab-coleta.tsx` (perto de "Lembrar"/"Revogar"), mostrando o link novo no mesmo padrão de `AssignRespondentModal` (depende de T007).

**Checkpoint**: US1 completa e testável de forma independente — T004/T005/T006 devem passar.

---

## Phase 4: User Story 2 - Reemitir e copiar todos os pendentes (Priority: P1)

**Goal**: Reemitir de uma vez todos os respondentes `INVITED`/`PENDING`/`OVERDUE` de um assessment, com lista pra copiar/baixar.

**Independent Test**: Assessment com vários pendentes, acionar a ação em lote, confirmar lista completa, copiar tudo e baixar arquivo; confirmar que `DONE`/`REVOKED` não são tocados; confirmar mensagem quando não há pendentes.

**Depends on**: US1 (T007) — reaproveita a mesma lógica de reemissão por respondente, dentro de uma transação em lote.

### Tests for User Story 2

- [x] T009 [P] [US2] Teste de `reissuePendingLinks`: reemite só `INVITED`/`PENDING`/`OVERDUE`, não toca `DONE`/`REVOKED`, grava auditoria por respondente — `apps/app/__tests__/meridian/collection.test.ts`. Escrever e confirmar que FALHA.
- [x] T010 [P] [US2] Teste de `reissuePendingLinks`: assessment sem nenhum pendente devolve resultado informativo (não lista vazia como sucesso silencioso) — mesmo arquivo de T009. Escrever e confirmar que FALHA.
- [x] T011 [P] [US2] Teste E2E (Playwright) dos cenários 4–5 do quickstart (lista, copiar tudo, baixar arquivo, caso sem pendentes) — `apps/app/e2e/meridian-reemitir-lote.spec.ts`. Escrever e confirmar que FALHA.

### Implementation for User Story 2

- [x] T012 [US2] Implementar `reissuePendingLinks` em `apps/app/app/(meridian)/actions/collection.ts`, reaproveitando a lógica de reemissão de T007 numa transação por assessment (depende de T007, T009/T010 falhando).
- [x] T013 [US2] Adicionar botão "Reemitir e copiar todos os pendentes" em `apps/app/components/meridian/screens/tab-coleta.tsx`, abrindo modal de lista (nome · eixo · link) com "copiar tudo" (depende de T012).
- [x] T014 [P] [US2] Adicionar "baixar `.txt`/`.csv`" no mesmo modal de T013.

**Checkpoint**: US1 e US2 funcionando juntas — T009/T010/T011 devem passar.

---

## Phase 5: Polish & Cross-Cutting

- [ ] T015 Rodar `quickstart.md` cenário a cenário (incluindo o 6, `tokenExpiresAt` fixado) antes de considerar a feature pronta pra dev encerrar.
- [ ] T016 [P] Conferir cobertura ≥80% nos arquivos tocados (`collection.ts`, `tab-coleta.tsx`, `respondent-token.ts`), per constituição.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: bloqueia US1 (T007 usa T003).
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de US1 (T007) — não é independente de US1 nesta feature, ao contrário do padrão usual, porque o próprio PRD define US2 como "feita em cima de" US1.
- **Polish (Phase 5)**: depende de US1 e US2 completas.

### Parallel Opportunities

- T004, T005, T006 (testes de US1) em paralelo entre si.
- T009, T010, T011 (testes de US2) em paralelo entre si, mas só depois de T007 (US1) pronta.
- T013 e T014 tocam o mesmo modal — paralelizáveis com cuidado (partes diferentes do mesmo componente), mais seguro sequencial se for a mesma pessoa.

---

## Parallel Example: User Story 1

```bash
Task: "Teste de reissueRespondentLink (sucesso) em apps/app/__tests__/meridian/collection.test.ts"
Task: "Teste de reissueRespondentLink (bloqueios) em apps/app/__tests__/meridian/collection.test.ts"
Task: "Teste E2E dos cenários 1-3 em apps/app/e2e/meridian-reemitir-link.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup + Foundational.
2. US1 — já resolve a causa raiz do incidente (link individual perdido).
3. **PARAR e VALIDAR**: cenários 1–3 do quickstart.
4. US2 na sequência — fecha o cenário real de 10 links perdidos de uma vez.

### Incremental Delivery

1. Setup + Foundational → helper de expiração pronto.
2. US1 → valida cenários 1–3 → já pode ir a produção (critério de pronto do Norte já é atendido parcialmente: reemitir 1 por 1 funciona).
3. US2 → valida cenários 4–5 → atende o critério de pronto completo ("recupera os 10 links num passo").
4. Polish → valida cenário 6 e cobertura.

---

## Notes

- Tests são mandatórias por constituição (III) — não pular mesmo sem pedido explícito na spec.
- Commit a cada task ou grupo lógico, sem trailer `Co-Authored-By`.
- Sem overlap de arquivo com a spec 004 (`packages/auth`) — as duas podem rodar em paralelo por pessoas diferentes.

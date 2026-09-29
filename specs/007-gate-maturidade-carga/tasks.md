# Tasks: Gate de maturidade + teste de carga (k6)

**Input**: Design documents from `specs/007-gate-maturidade-carga/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Esta feature é majoritariamente documentação de processo + um script k6 novo — "teste" aqui é rodar o próprio quickstart e o script k6 num ambiente controlado, não suíte Vitest/Playwright (constituição III não se aplica a artefato não-código; ver Constitution Check do plan.md).

**Organization**: US1 (checklist do gate, P1), US2 (SC-011 do Meridian, P1), US3 (validar concorrência com os leads, P2).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Instalar k6 localmente (ou confirmar disponível no ambiente de CI/staging) — pré-condição pra US2. Sem dependência de código do monorepo.

---

## Phase 2: Foundational

Nenhuma — US1, US2 e US3 não compartilham um bloqueio comum além do Setup.

---

## Phase 3: User Story 1 - Checklist de gate reutilizável (Priority: P1) 🎯 MVP

**Goal**: Documento único, aplicável a qualquer produto, com os três critérios do gate e resultado rastreável.

**Independent Test**: Aplicar o checklist ao Meridian (apto) e ao Scaffold (não apto) e conferir que o resultado e o motivo diferem — cenários 1–2 do quickstart.

### Implementation for User Story 1

- [x] T002 [US1] Criar `docs/qualidade/gate-maturidade-carga.md` com os três critérios (SC formal E2E, dogfood sem P0/P1 + P2 com dono/data, compliance quando aplicável) e uma tabela por produto com o resultado (depende de T001 só por ordem documental, não por bloqueio técnico).
- [x] T003 [US1] Aplicar o checklist aos 6 produtos (Meridian, Charter, Signal, Scaffold, Cosmos, Backoffice) preenchendo a tabela de T002 com o estado real de cada um, citando fonte (SC/spec/dogfood/parecer) por critério.
- [x] T004 [P] [US1] Validar cenários 1–2 do quickstart.md contra o documento gerado (revisão humana, não teste automatizado). — **Divergência achada**: cenário 1 esperava Meridian "apto"; resultado real é "não apto" (C2 falha — P1 ativo de seleção de organização + P2s sem data). Registrado em `gate-maturidade-carga.md` § Leitura do resultado, não corrigido silenciosamente.

**Checkpoint**: Gate publicado e aplicado aos 6 produtos — US1 completa.

---

## Phase 4: User Story 2 - SC de carga formal pro Meridian (Priority: P1)

**Goal**: SC-011 (concorrência) registrado no PRD do Meridian, distinto do SC-010 (volume), com script k6 do cenário de referência.

**Independent Test**: Ler o SC-011 e confirmar que tem número verificável (hipótese, mas número); rodar o script k6 localmente e obter relatório de p95/erro — cenário 3 do quickstart.

**Depends on**: Meridian precisa estar apto no gate de US1 (T003) antes de entrar em carga — mas escrever o SC-011 e o script em si não depende disso (podem ser preparados em paralelo; só a **execução** de fato depende do gate).

### Implementation for User Story 2

- [x] T005 [US2] Adicionar linha SC-011 (concorrência) à tabela de SCs em `docs/produto/meridian-prd.md` (~linha 163), com cenário de referência (PI Planning, RTE + 3+ ARTs), critério de aprovação (p95 < 2s, erro < 1%) e status "hipótese".
- [x] T006 [US2] Criar `apps/app/load/k6/meridian-concorrencia.js` (movido de `k6/` em 2026-09-29 para a biblioteca comum `apps/app/load/k6/lib`; renomeado de `meridian-pi-planning.js` — escopo ajustado pelo Norte: dois cenários, consultores e onda de respondentes, não só PI Planning) — guard que recusa rodar contra produção (mesmo padrão de `scripts/seed-meridian-load.ts`, checando host). Fixture: `apps/app/scripts/seed-meridian-concorrencia.ts`.
- [x] T007 [US2] Chamada às Server Actions via `Next-Action: <id>` HTTP puro, IDs resolvidos de `.next/server/server-reference-manifest.json` no setup. Formato de headers/corpo confirmado empiricamente (fetch patchado num Chromium real contra o mesmo build) — ver `.claude/completions/2026-09-27-spec-007-t006-t008.md`.
- [x] T008 [US2] Rodado contra `next build`/`next start` local (produção, não dev), `cosmos-dev` (5434): 0% erro nos dois cenários, p95 278.7ms (consultores) e 198.4ms (respondentes), bem abaixo do critério do SC-011. **Rótulo explícito: não é gate** — Meridian não apto hoje (`gate-maturidade-carga.md`, C2), decisão da Morgana de rodar mesmo assim como relatório informativo. Relatório completo em `.claude/completions/2026-09-27-spec-007-t006-t008.md`.

**Checkpoint**: SC-011 registrado e primeiro relatório de carga do Meridian existe — US1 + US2 completas.

---

## Phase 5: User Story 3 - Validar concorrência com os leads (Priority: P2)

**Goal**: Substituir a hipótese de concorrência por um número real, validado com os 3 leads (TOTVS primário).

**Independent Test**: Existe um registro (decisão) de que o número foi levantado e o SC-011 foi atualizado — cenário 5 do quickstart.

### Implementation for User Story 3

- [ ] T009 [US3] CPO/CEO levanta o número real de concorrência por tenant com os 3 leads (tarefa de negócio, não de engenharia — fora do escopo de código desta spec).
- [ ] T010 [US3] Atualizar o campo de status/número do SC-011 em `meridian-prd.md` de "hipótese" para "validado", registrando a fonte (ex.: nota de decisão, como já é convenção em `regra-maturidade-e-carga.md` ## Decisões).

**Checkpoint**: Número de concorrência deixa de ser hipótese — todas as 3 stories completas.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **US1 (Phase 3)**: só depende de Setup — pode rodar imediatamente.
- **US2 (Phase 4)**: escrever o SC-011 e o script (T005/T006/T007) não depende de US1; **executar** o k6 de verdade contra o Meridian (T008) pressupõe que o Meridian está apto no gate (US1, T003).
- **US3 (Phase 5)**: independente de execução técnica — pode acontecer a qualquer momento; só precisa do SC-011 existir (T005) pra ter o que atualizar.

### Parallel Opportunities

- T002/T003 (US1) podem acontecer em paralelo com T005/T006 (US2 — escrever o SC e o script, sem rodar ainda).
- T009 (levantamento com os leads, US3) é independente de tudo — pode começar no dia 1.

---

## Implementation Strategy

### MVP First (US1)

1. Setup (instalar k6, não bloqueia US1).
2. US1 — gate publicado e aplicado aos 6 produtos. Já dá o critério que faltava pra qualquer decisão de "pode entrar em carga".
3. **PARAR e VALIDAR**: cenários 1–2 do quickstart.
4. US2 — SC-011 e primeiro script k6, quando o Meridian estiver apto.
5. US3 — corre em paralelo, assim que possível, sem bloquear US1/US2.

---

## Notes

- Commit a cada task ou grupo lógico, sem trailer `Co-Authored-By`.
- T007 e T009 têm dono explícito fora do PO (Maestro e CPO/CEO, respectivamente) — o PO não implementa nem levanta o número, só garante que a spec registra a necessidade e o formato do resultado.

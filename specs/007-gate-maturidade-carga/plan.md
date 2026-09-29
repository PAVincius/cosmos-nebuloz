# Implementation Plan: Gate de maturidade + teste de carga (k6)

**Branch**: `007-gate-maturidade-carga` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-gate-maturidade-carga/spec.md`

## Summary

Formaliza em documento reutilizável (`docs/qualidade/gate-maturidade-carga.md`) o checklist de 3 critérios que decide se um produto pode entrar em teste de carga (k6), aplicado primeiro a Meridian/Charter/Signal. Adiciona um novo Success Criterion de **concorrência** ao Meridian (SC-011, distinto do SC-010 já existente, que mede volume de dados, não usuários simultâneos), registrado como hipótese até validação com os leads. Sem código de produto tocado — é documentação de processo + o primeiro script k6 (novo, k6 não existe no repo hoje).

## Technical Context

**Language/Version**: Markdown (checklist/SC) + JavaScript (script k6, que roda em runtime próprio, não Node/TS do monorepo).

**Primary Dependencies**: k6 (novo — não instalado no repo hoje, `regra-maturidade-e-carga.md:19`). Nenhuma dependência de produto (não altera `apps/app` nem `packages/*`).

**Storage**: N/A — teste de carga roda contra ambiente local/staging, sem escrita permanente de schema.

**Testing**: O próprio artefato desta feature é um teste (k6) e um gate de qualidade — não há "testes do teste" além de rodar o script k6 num ambiente controlado e conferir que ele produz o relatório (p95, taxa de erro) que o SC-011 pede.

**Target Platform**: Ambiente local ou staging dedicado — nunca produção (restrição não-negociável do intent).

**Project Type**: Documentação de processo (`docs/qualidade/`) + script de teste de carga isolado (`k6/` ou `scripts/k6/`, a definir na Fase 1).

**Performance Goals**: O que o SC-011 do Meridian está definindo, não um goal desta feature em si — p95 < 2s nas telas críticas, erro < 1%, no cenário de referência (PI Planning, RTE + 3+ ARTs), como hipótese até validação com os leads.

**Constraints**: Nunca contra produção. Meta de concorrência é hipótese, não fato — todo relatório precisa carregar esse aviso enquanto não validada.

**Scale/Scope**: Pequeno — um documento de checklist, uma entrada de SC no PRD do Meridian, um script k6 inicial. Sem mudança em `apps/app`/`packages/*` além de, possivelmente, expor uma rota/seed para o cenário de referência do k6 (a definir na Fase 0 — ver research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Safety** — N/A direto (não há query nova de produto), mas o script k6 e qualquer seed de apoio MUST operar num tenant dedicado de teste, nunca cruzando tenant real — mesmo padrão já usado por `seed:meridian:load` (`techcorp-sa`).
- **II. Result\<T\>, não throw** — N/A (sem server action nova).
- **III. Test-First** — N/A no sentido usual de unit/integration; o "teste" aqui é o próprio artefato de carga. O gate de maturidade em si (FR-001/002) é validável por revisão (aplicar o checklist a um produto e conferir o resultado), não por suíte automatizada.
- **IV. Validação em Boundaries** — N/A (sem input de usuário novo).
- **V. Webhook Receiver Pattern** — N/A.

Nenhuma violação — sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-gate-maturidade-carga/
├── intent.md             # Aprovado
├── spec.md               # Aprovado
├── plan.md               # Este arquivo
├── research.md           # Phase 0
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
└── tasks.md              # /speckit-tasks (a seguir)
```

### Source Code (repository root)

```text
docs/qualidade/
└── gate-maturidade-carga.md      # NOVO — checklist reutilizável (US1)

docs/produto/
└── meridian-prd.md                # + linha SC-011 na tabela de SCs (~linha 163), concorrência

k6/ (ou scripts/k6/, a confirmar na Fase 0)
└── meridian-pi-planning.js        # NOVO — script k6 do cenário de referência do Meridian (US2)
```

**Structure Decision**: Segue o precedente já existente de documento de processo em `docs/qualidade/` (`checklist-avaliacao-engenharia.md`) para o gate, e a tabela de SCs já existente em `meridian-prd.md` para o SC-011 — sem inventar um novo lugar de registro. O script k6 é a única peça genuinely nova no repo (ferramenta ainda não instalada); a Fase 0 já resolveu onde ele mora e como lida com Server Actions — decisão do Maestro (2026-09-26): HTTP puro via cabeçalho `Next-Action`, IDs resolvidos de `.next/server/server-reference-manifest.json` no setup, sessão por cookie. Ver research.md §4.

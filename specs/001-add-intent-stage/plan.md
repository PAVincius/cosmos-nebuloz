# Implementation Plan: Estágio de Intent (idea → intent.md aprovado)

**Branch**: `001-add-intent-stage` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-add-intent-stage/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Novo skill `/speckit-intent` que roda antes de `/speckit-specify`: reusa `create-new-feature.sh` pra alocar a pasta numerada, escreve `intent.md` (frontmatter `status: draft|approved` + 5 seções), conduz até 5 perguntas céticas antes de fechar, e só marca `approved` com aprovação explícita do humano no chat. Gate técnico complementar: nova extensão `.specify/extensions/intent-gate/` registrada como hook `before_specify` (mandatory) em `.specify/extensions.yml`, que bloqueia `/speckit-specify` se `intent.md` não existir ou não estiver `approved` — sem editar nenhum template vendored do speckit.

## Technical Context

**Language/Version**: N/A — tooling de instrução/config (prompts Markdown, YAML de config, script POSIX Bash), não código de aplicação com versão de linguagem própria.

**Primary Dependencies**: speckit toolkit v0.10.2 já instalado (mecanismo de extensão existente); `.specify/scripts/bash/create-new-feature.sh` (reusado, não duplicado).

**Storage**: N/A — arquivos versionados em git (`intent.md`, `extensions.yml`, `extension.yml` da nova extensão).

**Testing**: sem framework automatizado aplicável — não é código de aplicação. Verificação via walkthrough manual seguindo os "Independent Test" de cada user story do spec.md (FR-001 a FR-010 mapeados 1:1 pra passos verificáveis em `quickstart.md`).

**Target Platform**: Claude Code CLI neste repo. `script: "sh"` em `.specify/init-options.json` — só bash, sem necessidade de variante PowerShell (diferente do padrão dual bash/powershell da extensão `agent-context`, que serve outros ambientes).

**Project Type**: tooling interno de desenvolvimento (skill + extensão speckit) — não é app/lib/service do produto cosmos-nebuloz.

**Performance Goals**: N/A — fluxo conversacional guiado por humano, sem requisito de throughput.

**Constraints**: FR-009 (não editar templates vendored do speckit — usar só o mecanismo de extensão); o hook de gate MUST degradar sem crash se `extensions.yml` estiver malformado (edge case já aceito no spec — falha silenciosa do parsing, sem bloqueio nesse caso específico).

**Scale/Scope**: 1 repo. Entregáveis: 2 skills novas (`speckit-intent`, `speckit-intent-gate-check`), 1 extensão nova (`intent-gate`), 1 template novo (`intent-template.md`), 1 entrada de hook em `extensions.yml` existente.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio da constitution | Aplica? | Avaliação |
|---|---|---|
| I. Multi-Tenant Safety | Não | Nenhum dado de tenant envolvido — tooling de repo, não feature multi-tenant do produto. |
| II. Result\<T\>, não throw | Não | Não é server action; scripts bash usam exit code, skills reportam erro em prosa (mesmo padrão já usado por `speckit-specify`/`create-new-feature.sh`). |
| III. Test-First (NON-NEGOTIABLE) | Adaptado | Não há suíte automatizada aplicável a prompts/skills. O equivalente aqui é RED→GREEN manual: cada Acceptance Scenario do spec.md é escrito ANTES da implementação (já está — spec.md precede este plan) e vira passo de verificação em `quickstart.md`, rodado manualmente pós-implementação. Não é uma violação — é a tradução do princípio pro domínio de tooling conversacional, não código testável por `vitest`. |
| IV. Validação em Boundaries | Sim, light | O script de gate (`check-intent-approved.sh`) trata `intent.md` ausente ou frontmatter sem `status` como "não aprovado" (fail-safe), nunca crash. |
| V. Webhook Receiver Pattern | Não | Não é endpoint webhook. |
| SAFe alignment (toda feature → 1 competência + 1 nível) | Não aplicável | Cláusula escrita pra features do PRODUTO (rastreadas como Épico/Feature no próprio cosmos-nebuloz). Esta feature é tooling interno do repo, não uma entidade SAFe do produto — não tem competência/nível a mapear. |
| Quality Gates (CI: biome → coverage → security audit → build) | Não aplicável | Gates cobrem código de aplicação sob `apps/*`. Esta feature só adiciona Markdown/YAML/um script bash fora de `apps/`, nada que os linters/coverage de TS avaliem. `typecheck`/`build` continuam verdes por não tocarem nada compilado. |
| Idioma PT-BR na prosa | Sim | spec.md, plan.md e os próprios skills novos em PT-BR (mesmo padrão de `speckit-intent`/`speckit-intent-gate-check`). |
| Completion doc por task | Sim | `.claude/completions/2026-08-27-add-intent-stage.md` a criar ao final da implementação — item de processo, não de design. |

Nenhuma violação real da constitution — as três linhas "Não aplicável"/"Adaptado" são domínio (tooling de repo ≠ feature de produto), não desvio. **Complexity Tracking não se aplica.**

**Re-check pós-Phase 1**: `data-model.md`, `contracts/` e `quickstart.md` não introduziram nada além do já avaliado acima (sem dado de tenant, sem server action, sem endpoint). Gate mantido: passa.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
.claude/skills/
├── speckit-intent/
│   └── SKILL.md                          # comando /speckit-intent (novo)
└── speckit-intent-gate-check/
    └── SKILL.md                          # espelho invocável da extensão (novo, mesmo padrão de speckit-agent-context-update)

.specify/extensions/
└── intent-gate/                          # nova extensão (mesmo padrão de extensions/agent-context/)
    ├── extension.yml
    ├── README.md
    ├── commands/
    │   └── speckit.intent-gate.check.md
    └── scripts/
        └── bash/
            └── check-intent-approved.sh   # só bash — init-options.json declara script: "sh"

.specify/templates/
└── intent-template.md                    # novo, resolvido pelo /speckit-intent (mesmo mecanismo de resolução de spec-template)

.specify/extensions.yml                   # editado: installed += intent-gate; hooks.before_specify += entrada mandatory
```

**Structure Decision**: tooling puro sob `.claude/skills/` e `.specify/`, fora de `apps/*` — não introduz projeto novo no monorepo Turborepo, não usa Option 1/2/3 do template (nenhuma delas se aplica a skills/extensões). Espelha exatamente o padrão já estabelecido pela extensão `agent-context` existente (extension.yml + commands/ + scripts/bash/ + skill espelhado em `.claude/skills/`), pra manter os dois hooks (`agent-context`, `intent-gate`) legíveis lado a lado.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

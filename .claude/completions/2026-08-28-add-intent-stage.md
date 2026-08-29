# Estágio de Intent — /speckit-intent + gate before_specify

**Data:** 2026-08-28
**Feature:** `specs/001-add-intent-stage/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, tasks.md)

## O que foi feito

Primeiro estágio do ciclo AI-native de desenvolvimento adotado pra este repo (idea → intent.md aprovado → spec → plan → tasks → implementação, o resto do ciclo — 5 estágios — fica pra features futuras). `specs/` estava vazio antes desta feature; é o primeiro uso real do pipeline speckit já instalado (`.specify/`, constitution.md v1.0.0, speckit v0.10.2).

- `.claude/skills/speckit-intent/SKILL.md` — comando novo: reusa `create-new-feature.sh` pra alocar/reusar pasta numerada, escreve `intent.md` (frontmatter `status: draft|approved` + 5 seções: Problema/Contexto/Restrições/Resultado desejado/Fora de escopo) a partir de `.specify/templates/intent-template.md`, conduz 0–5 perguntas céticas ("roast me", tom deliberadamente diferente do `speckit-clarify` colaborativo) antes do resumo, e só marca `approved` com aprovação explícita no chat — nunca sozinho.
- `.specify/extensions/intent-gate/` — nova extensão (extension.yml + commands/speckit.intent-gate.check.md + scripts/bash/check-intent-approved.sh), mesmo padrão da extensão `agent-context` já existente. Registrada como hook `before_specify` **mandatory** em `.specify/extensions.yml` — bloqueia `/speckit-specify` se `intent.md` da feature-alvo não existir ou não estiver `approved`.
- `.claude/skills/speckit-intent-gate-check/SKILL.md` — espelho invocável da extensão (mesmo padrão de `speckit-agent-context-update`).
- `.specify/templates/intent-template.md` — template novo, mesmo mecanismo de resolução que `spec-template.md` já usa.
- `CLAUDE.md` — markers `<!-- SPECKIT START/END -->` adicionados (não existiam), apontando pro plan ativo.

## Decisões

- **Migrar pra speckit em vez de estender `docs/superpowers/`**: repo já tinha os dois workflows instalados; speckit (`.specify/`) estava pronto mas nunca usado (specs/ vazio) — decisão do usuário, não técnica.
- **Gate via extensão, não editando `speckit-specify/SKILL.md`**: `.specify/extensions.yml` (before_specify) é o único ponto de extensão que não toca em arquivo vendored (`source: templates/commands/specify.md`) — sobrevive a upgrade do speckit.
- **Parsing de frontmatter sem yq/python3**: `yq` não instalado; único campo é `status`, grep/sed/awk resolve sem dependência nova (detalhado em `research.md`).
- **US1/US2/US3 no mesmo arquivo**: são facetas do mesmo fluxo conversacional (`SKILL.md`), não módulos de código separados — "independência" delas é de valor testável (`quickstart.md`), não de execução concorrente.

## Limitação conhecida (aceita, documentada no spec)

Editar `status: approved` manualmente no arquivo, sem passar pela aprovação no chat, passa o gate — é enforcement de convenção, não de integridade criptográfica do commit. Também: `extensions.yml` malformado faz o parsing do hook falhar silenciosamente (comportamento pré-existente do `speckit-specify`, não meu) — o gate não bloqueia nesse caso específico.

## Verificação

- `check-intent-approved.sh` testado diretamente: 4/4 cenários (draft→bloqueia, approved→passa, ausente→bloqueia, sem arg→erro de uso).
- Cenário 1 do `quickstart.md` (criação de `intent.md`) rodado manualmente ponta-a-ponta contra uma feature de teste descartável (`002-dark-mode-toggle`), removida depois — confirmado 5 seções + frontmatter corretos.
- Transição `draft`→`approved` e o gate contra ela testados na mesma feature de teste (bloqueia antes, passa depois).
- **Não testado via `Skill` tool**: `/speckit-intent` e `/speckit-intent-gate-check` são skills criadas nesta sessão — o registry de skills não recarrega a quente, então a invocação real via `/speckit-intent` (e a cadeia `/speckit-specify` → hook → `/speckit-intent-gate-check`) só é exercitável numa sessão nova. Verificação acima cobre a lógica (scripts) e a instrução (SKILL.md), não a invocação em si.

## Pendências (fora de escopo desta feature, spec.md já documenta)

Estágios 2 (constitution.md já cobre boa parte), 5 (agente revisa agente em PR), 6 (hooks determinísticos gerais além deste gate), 7 (produção→intent.md via Sentry) — cada um vira feature própria.

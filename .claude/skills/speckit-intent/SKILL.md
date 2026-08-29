---
name: "speckit-intent"
description: "Capture a raw idea as an approved intent.md before /speckit-specify runs — asks skeptical questions, requires explicit human approval."
argument-hint: "Describe the idea in natural language"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "cosmos-nebuloz"
  source: "specs/001-add-intent-stage/"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding. If empty, stop and ask for a one-line description of the idea — do not create any directory or file.

## Purpose

Estágio 1 do ciclo AI-native de desenvolvimento deste repo: toda feature nasce como um `intent.md` desafiado e aprovado explicitamente por um humano, ANTES de qualquer `spec.md` existir. Isto roda antes de `/speckit-specify` — que passa a exigir (via hook `before_specify` da extensão `intent-gate`) um `intent.md` com `status: approved` na pasta da feature-alvo.

## Outline

1. **Resolver a pasta da feature**:
   - Rodar `.specify/scripts/bash/create-new-feature.sh --json --allow-existing-branch --short-name "<nome-2-4-palavras>" "<descrição do usuário>"` a partir da raiz do repo.
   - O script aloca o próximo número sequencial (ou reusa a pasta se já existir uma para esse short-name) e cria `specs/NNN-nome/` — com um `spec.md` vazio como side-effect conhecido e aceito (será sobrescrito por `/speckit-specify` mais tarde).
   - Extrair `SPEC_FILE` do JSON e derivar `INTENT_FILE` = mesma pasta, `intent.md`.

2. **Escrever/atualizar `intent.md`**:
   - Se `INTENT_FILE` não existe: copiar `.specify/templates/intent-template.md` (resolvido pelo mesmo mecanismo de preset/template usado por `spec-template.md`) para `INTENT_FILE`, com `status: draft` no frontmatter.
   - Preencher as 5 seções (Problema, Contexto, Restrições, Resultado desejado, Fora de escopo) a partir da descrição do usuário — fazer inferências razoáveis, mas favorecer perguntas (próximo passo) em vez de invenção quando a lacuna for de risco/escopo.
   - Se `INTENT_FILE` já existe (reexecução na mesma feature): editar o conteúdo existente em vez de recriar; preservar o `status` atual até a etapa de aprovação decidir mudá-lo.

3. **Modo "roast me" — perguntas céticas**:
   - Releia o `intent.md` rascunhado e identifique riscos e suposições não ditas: por que isso e não uma alternativa mais simples, o que quebra ou fica pior se isso não for feito, quem é afetado e como se sabe que é prioridade, que evidência sustenta o "Resultado desejado".
   - Faça **entre 0 e 5 perguntas**, **uma de cada vez**, aguardando a resposta antes de fazer a próxima. Não é o tom colaborativo de "vamos refinar juntos" do `speckit-clarify` — é cético, tenta genuinamente derrubar a ideia antes de gastar esforço nela.
   - Se a ideia já é bem fundamentada e não há lacuna de risco relevante, é válido seguir com menos de 5 perguntas (ou nenhuma) — não force o máximo por forçar.
   - Incorpore cada resposta no `intent.md` (nas seções relevantes), não como um anexo de Q&A solto.

4. **Resumo e aprovação explícita**:
   - Apresente um resumo consolidado do `intent.md` (as 5 seções, versão final) e pergunte claramente se está aprovado.
   - **Se o humano aprova explicitamente** (ex: "aprovado", "pode seguir", "sim"): edite o frontmatter para `status: approved` e rode `git commit` (Conventional Commits — ex: `docs: aprova intent de <nome-curto>` —, sem trailer `Co-Authored-By`, seguindo a convenção já usada no repo).
   - **Se o humano pede mudança**: edite o `intent.md` conforme pedido, apresente o resumo de novo. `status` permanece `draft`. Repita até aprovação ou até o humano decidir parar.
   - **Nunca** mude `status` para `approved` sem essa aprovação explícita no chat — mesmo que o conteúdo pareça pronto.

## Erros

- Descrição vazia → erro claro pedindo a descrição, nenhuma pasta criada.
- `create-new-feature.sh` falhar (ex: nome colide sem `--allow-existing-branch` resolver) → reportar o erro do script tal como veio, não tentar workaround silencioso.

## Completion Report

Ao final (aprovado ou não), reportar: caminho do `intent.md`, `status` atual, e se aprovado, confirmação do commit. Se ainda em `draft`, deixar claro que `/speckit-specify` para essa feature está bloqueado até a aprovação acontecer.

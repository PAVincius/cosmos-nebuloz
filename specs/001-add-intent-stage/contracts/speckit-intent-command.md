# Contract: `/speckit-intent`

## Input

```
/speckit-intent <descrição da ideia em linguagem natural>
```

Vazio → erro claro pedindo a descrição, nenhuma pasta criada (edge case do spec.md).

## Comportamento (contrato observável, não implementação)

1. Aloca/reusa `specs/NNN-nome/` (via `create-new-feature.sh`).
2. Escreve/atualiza `specs/NNN-nome/intent.md` com `status: draft`.
3. Conduz 0–5 perguntas céticas, uma por vez, aguardando resposta entre elas.
4. Apresenta resumo consolidado, pede aprovação explícita.
5. Só com aprovação explícita → `status: approved` + commit.
6. Pedido de mudança → edita, repete o resumo, `status` continua `draft`.

## Output observável

- Arquivo `specs/NNN-nome/intent.md` no filesystem, com frontmatter `status` correto pro estado do fluxo no momento.
- Mensagens em prosa no chat (perguntas, resumo, confirmação de commit) — sem formato de dado estruturado (não é uma API, é um skill conversacional).

## Erros

| Condição | Comportamento |
|---|---|
| Descrição vazia | Erro claro, nenhuma pasta criada |
| Pasta da feature já existe | Reusa via `--allow-existing-branch`, edita `intent.md` existente |

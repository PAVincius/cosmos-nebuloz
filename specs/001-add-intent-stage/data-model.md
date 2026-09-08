# Data Model: Estágio de Intent

Não há schema de banco de dados — as "entidades" são arquivos versionados em git.

## intent.md

Vive em `specs/NNN-nome/intent.md`. Um por feature.

**Frontmatter (YAML)**:

| Campo | Tipo | Valores | Obrigatório |
|---|---|---|---|
| `status` | string | `draft` \| `approved` | sim |

**Corpo (Markdown, seções fixas)**:

| Seção | Conteúdo |
|---|---|
| Problema | o que está errado ou faltando hoje |
| Contexto | por que isso importa agora, quem é afetado |
| Restrições | o que não pode mudar, limites conhecidos |
| Resultado desejado | como fica quando resolvido — sem prescrever implementação |
| Fora de escopo | o que essa ideia explicitamente não cobre |

**Transições de estado**:

```
(inexistente) --/speckit-intent--> draft
draft --edição via /speckit-intent (pedido de mudança)--> draft
draft --aprovação explícita no chat--> approved
approved --/speckit-intent rodado de novo, se o humano decidir revisar--> draft
```

Não existe transição automática pra `approved` — sempre humana, sempre no chat (FR-005).

## Feature directory

`specs/NNN-nome/` — compartilhada entre `intent.md` (este estágio) e `spec.md`/`plan.md`/etc. (estágios seguintes, já existentes no speckit). `NNN` é sequencial, alocado por `create-new-feature.sh`, reusado — não há entidade nova aqui, só a extensão de uso de uma estrutura já existente.

# ADR-0007 — Versionamento de política por incremento minor

**Status**: Accepted · **lacuna de spec**
**Data**: 2026-07-28
**Contexto de origem**: `FR-2.4` — "publicar versão deve exigir resumo de mudanças e **incrementar versão**"

## Contexto

`FR-2.4` manda incrementar a versão ao publicar. `DATA-MODEL.md` tipa
`PolicyVersion.v` como string e o protótipo mostra `v3.2 → v3.1 → v3.0 → v2.4`.

**A lacuna**: nada define quando o major muda. O histórico do protótipo é
sugestivo mas não normativo — `v2.4 → v3.0` foi "reestruturação completa após
auditoria externa; 14 mudanças", `v3.0 → v3.1` foi 3 mudanças. Parece haver um
critério editorial, não uma regra.

Sem definição, as opções são: incrementar sempre o minor, pedir ao usuário, ou
inferir do tamanho da mudança.

## Decisão

**Incremento automático do minor**: `v3.2 → v3.3`. Sem política nunca publicada,
a primeira vira `v1.0`.

Major é decisão editorial e **não é automatizado no V1** — não há controle na UI
para forçá-lo. Se Compliance precisar marcar uma reestruturação, o campo
`summary` (obrigatório) carrega a informação, e a contagem de seções alteradas
fica na entrada de auditoria.

`bumpVersion` tolera formato inesperado retornando `v1.0`, em vez de quebrar a
publicação por causa de uma string legada.

## Alternativas consideradas

**Deixar o usuário digitar a versão.** Máxima flexibilidade, e a porta aberta
para duas versões com o mesmo número, ou para uma versão andar para trás. Num
produto de auditoria a numeração precisa ser monotônica sem depender de
disciplina humana. (O `@@unique([policyId, version])` barra a colisão, mas com
erro de banco, não com mensagem útil.)

**Inferir major de um limiar de mudanças** (ex.: >10 seções alteradas → major).
Rejeitada: limiar arbitrário disfarçado de regra. "Reestruturação" é julgamento,
não contagem.

**Oferecer um seletor major/minor no modal de publicação.** É a evolução
provável, e é barata — um `Segmented` a mais. Adiada por não haver ainda
demanda: nenhum critério de aceite do SRD depende do número major.

## Consequências

- A numeração é previsível e monotônica sem intervenção.
- Uma reestruturação grande sai como `v3.3`, não `v4.0`. Se o cliente lê o
  número como sinal de magnitude, o sinal se perde — o `summary` compensa
  parcialmente.
- Publicar duas vezes seguidas produz `v3.3` e `v3.4` mesmo que a segunda mude
  uma vírgula. Não há supressão de versão vazia; publicar é ato deliberado com
  resumo obrigatório, e uma versão a mais na trilha custa menos que um mecanismo
  de deduplicação que decida por conta própria que uma mudança "não contou".

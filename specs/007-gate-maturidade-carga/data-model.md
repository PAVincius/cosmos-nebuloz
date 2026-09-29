# Data Model: Gate de maturidade + teste de carga (k6)

Sem entidade de banco — os "dados" desta feature são artefatos de documentação e de teste.

## Gate de maturidade (documento)

| Campo | Notas |
|---|---|
| Produto | Meridian, Charter, Signal, Scaffold, Cosmos, Backoffice |
| Critério 1 — SC formal E2E | Passa/Não passa; referência ao SC e ao spec Playwright da persona principal |
| Critério 2 — Dogfood | Passa/Não passa; nº de P0/P1 abertos (deve ser 0); P2 com dono+data |
| Critério 3 — Compliance | Passa/Não passa/Não aplicável; referência ao parecer, quando existir |
| Resultado | Apto / Não apto (deriva dos três critérios — todos MUST passar ou ser N/A) |

## Success Criterion de carga (por produto)

| Campo | Meridian (SC-011) |
|---|---|
| Cenário de referência | PI Planning, cliente ICP, RTE + 3+ ARTs |
| Critério de aprovação | p95 < 2s nas telas críticas, erro < 1% |
| Status do critério | Hipótese (até validação com os leads) |
| Ambiente permitido | Local ou staging dedicado — nunca produção |

Quando o número de concorrência for validado (US3), só o campo "Status do critério" (e o valor numérico, se mudar) precisa atualizar — a estrutura do SC não muda.

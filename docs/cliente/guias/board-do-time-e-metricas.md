---
title: "Board do time e métricas de fluxo"
sidebar_label: Board do time e métricas
sidebar_position: 3
---

# Board do time e métricas de fluxo

Depois que o PI está planejado, o trabalho acontece na altitude de time — e
toda métrica de fluxo que aparece em Analytics nasce das transições feitas
aqui, sem nenhum lançamento manual extra.

## Board do time

Cada time trabalha seu **board** com sprint, story, task, defeito e
impedimento. A hierarquia de trabalho segue a cadeia
`Épico → Feature → Story → Task`: a story que aparece no seu board vem de
uma feature planejada no PI, que por sua vez veio de um épico priorizado no
portfólio.

Impedimentos e defeitos são tratados como itens de primeira classe no board
— não são comentário solto num card, são registros com o mesmo ciclo de vida
de uma story.

## De onde vêm as métricas de fluxo

Toda vez que um item muda de estado no board — de "a fazer" para "em
andamento", de "em andamento" para "concluído" — o Cosmos registra essa
transição. Essa tabela de transições (`StateTransitionHistory`) é a fonte
única de todas as métricas de fluxo:

- **CFD (Cumulative Flow Diagram)** — quanto trabalho está em cada estado ao
  longo do tempo.
- **Throughput** — quantos itens o time conclui por período.
- **Aging WIP** — há quanto tempo um item em andamento está parado naquele
  estado.
- **Lead time** — tempo entre início e conclusão de um item.
- **Métricas DORA** — indicadores de entrega de software derivados das
  mesmas transições.

Porque tudo deriva da mesma tabela de transições, um número de lead time em
Analytics sempre corresponde exatamente ao que aconteceu no board do time —
não existe reconciliação manual entre "o board" e "o relatório".

## Como usar isso no dia a dia

Mova o item de estado no board conforme o trabalho avança — não pule estado
nem edite data retroativamente, porque isso é exatamente o que alimenta as
métricas de fluxo do seu time em Analytics. Se o aging WIP do seu board está
alto, é o board em si que mostra qual item está parado e há quanto tempo,
antes mesmo de olhar Analytics.

---
title: "PI Planning e confidence vote"
sidebar_label: PI Planning
sidebar_position: 2
---

# PI Planning e confidence vote

O **PI Planning** é onde o ART transforma épicos priorizados em compromisso
de time para o próximo Program Increment. No Cosmos, todo o planejamento —
objetivo por time, dependência, risco e voto de confiança — fica registrado
no mesmo lugar, disponível depois em Analytics.

## Program board

O **ART Board** mostra o board de programa do PI atual: as features
distribuídas entre os times do ART, as dependências entre eles e os riscos
identificados durante o planejamento. É a visão que o RTE usa para conduzir
o PI Planning.

## PI Objectives

Cada time registra seus **PI Objectives** — os compromissos daquele time
para o PI, com o valor de negócio planejado associado a cada um
(`plannedValue`). É esse número que depois é comparado com o que foi
realmente entregue.

## Dependências e riscos

Durante o planejamento, dependências entre times de um mesmo ART (ou entre
ARTs, na altitude de Large Solution) são registradas no board de programa,
junto com os riscos identificados. Isso evita que um risco levantado numa
sala de PI Planning se perca depois de a reunião acabar.

## Confidence vote

Ao final do PI Planning, cada time registra o **confidence vote** — o voto
de confiança da equipe em relação ao compromisso que acabou de assumir. O
Cosmos persiste esse voto junto ao PI.

Esse voto não é só um ritual: ele volta a aparecer em Analytics comparado
com o resultado real do PI (`achievedValue` vs `plannedValue`), formando a
base da métrica de **previsibilidade de PI** — o quanto os times acertam o
que prometem, PI após PI.

## Depois do planejamento

Uma vez que o PI está planejado, o trabalho passa para a altitude de time:
veja [Board do time e métricas de fluxo](./board-do-time-e-metricas.md) para
como sprint, story e task funcionam no dia a dia.

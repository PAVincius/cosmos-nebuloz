---
title: Seu primeiro Program Increment
sidebar_label: Seu primeiro PI
sidebar_position: 2
---

# Seu primeiro Program Increment

Passo a passo de ponta a ponta: de uma ideia solta até um PI planejado e com
o primeiro confidence vote registrado. Pressupõe que seu ART e seus times já
existem — se ainda não existem, peça pro Admin do tenant criá-los em
**Settings**.

## 1. Registre o épico no Portfolio

Em **Portfolio → Kanban de épicos**, crie o épico com a hipótese de negócio.
Todo épico novo entra no kanban antes de virar compromisso de ART — é o gate
de governança do portfólio, com decision log de quem aprovou passar de estado.

## 2. Priorize com WSJF

Ainda no Portfolio, preencha os quatro fatores do WSJF do épico: **Business
Value**, **Time Criticality**, **Risk Reduction** e **Cost of Delay**. O
Cosmos recalcula o ranking automaticamente — o épico sobe ou desce a fila
conforme os fatores mudam, sem precisar reordenar manualmente.

## 3. Vincule a um tema estratégico e um lean budget

Todo épico que vai consumir orçamento precisa estar ligado a um
**tema estratégico** (`StrategicTheme`) com lean budget definido. É esse
vínculo que depois alimenta o **value realization** — quanto foi alocado
contra quanto foi de fato entregue.

## 4. Leve o épico para o ART

Quando o épico é aprovado no portfólio, ele aparece no **ART Board** do RTE.
O RTE quebra o épico em features e distribui entre os times do ART.

## 5. Rode o PI Planning

Em **ART Board → PI Planning**, crie o PI e registre os
**PI Objectives** de cada time — o compromisso do time para aquele PI, com
valor de negócio planejado. Registre também as dependências entre times e os
riscos identificados no board de programa.

## 6. Registre o confidence vote

Ao final do PI Planning, cada time registra seu **confidence vote** — o voto
de confiança de que vai entregar o que foi combinado. O Cosmos persiste esse
voto junto ao PI; ele volta a aparecer depois em Analytics, comparado com o
que foi de fato entregue (`plannedValue` vs `achievedValue`).

## 7. Acompanhe no board do time

Durante o PI, cada time trabalha as stories e tasks no seu
**board do time** (sprint, story, task, defeito, impedimento). Toda transição
de estado alimenta as métricas de fluxo que aparecem em Analytics — sem
lançamento manual.

Pronto: você tem um épico priorizado, um PI planejado com compromisso
registrado e um time trabalhando com métrica derivando sozinha. Para entender
cada peça em mais detalhe, veja os [Guias](../guias/).

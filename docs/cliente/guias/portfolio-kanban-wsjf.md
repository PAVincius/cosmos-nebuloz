---
title: "Portfólio: kanban de épicos e WSJF"
sidebar_label: Portfólio e WSJF
sidebar_position: 1
---

# Portfólio: kanban de épicos e WSJF

A altitude de portfólio é onde uma ideia de negócio vira épico priorizado e,
eventualmente, aposta financiada. Este guia cobre as duas peças que sustentam
essa priorização: o kanban de épicos e o WSJF.

## Kanban de épicos

Todo épico nasce no kanban do portfólio e passa por um **gate de
governança** antes de virar compromisso de ART — não existe caminho para um
épico pular direto para um time sem passar pelo portfólio. Cada mudança de
estado do épico fica registrada num **decision log**: quem aprovou, quando, e
com qual justificativa.

Esse gate existe porque decisão de portfólio move orçamento — o decision log
é o que permite, meses depois, reconstruir por que uma aposta foi financiada.

## WSJF (Weighted Shortest Job First)

WSJF é o método de priorização do Cosmos: em vez de ordenar épicos por
opinião ou por quem grita mais alto, cada épico recebe uma pontuação
calculada a partir de quatro fatores:

| Fator | Pergunta que responde |
|---|---|
| **Business Value (BV)** | Quanto valor de negócio essa aposta gera? |
| **Time Criticality (TC)** | O valor cai se atrasar? |
| **Risk Reduction (RR)** | Reduz risco ou destrava oportunidade? |
| **Cost of Delay (CoD)** | Quanto custa não fazer agora? |

O Cosmos calcula o WSJF a partir desses quatro fatores e reordena o ranking
do kanban automaticamente sempre que um deles muda — você não reordena a
fila manualmente, você ajusta o fator que mudou e o ranking se atualiza
sozinho.

## Como usar no dia a dia

1. Crie o épico no kanban com a hipótese de negócio.
2. Preencha BV, TC, RR e CoD — mesmo uma estimativa aproximada já posiciona o
   épico corretamente no ranking relativo aos outros.
3. Vincule o épico a um **tema estratégico** com lean budget definido, se ele
   for consumir orçamento.
4. Acompanhe o épico subir ou descer o ranking conforme o contexto muda —
   isso é sinal de que o WSJF está fazendo o trabalho de reprioriação por
   você.
5. Quando aprovado, o épico segue o kanban até o gate de saída para o ART —
   veja [PI Planning e confidence vote](./pi-planning.md) para o que acontece
   depois.

# DRE mensal — modelo

Demonstrativo de resultado por competência (não por caixa — receita e custo
contam no mês do fato gerador, mesmo que o dinheiro entre ou saia depois; o
caixa mora em [`caixa-13-semanas.md`](caixa-13-semanas.md)). As contas usadas
aqui vêm de [`plano-de-contas.md`](plano-de-contas.md); cada linha remete ao
código de conta correspondente.

Três meses de coluna, todas ⟨preencher⟩ — o formato é o que fica fixo, os
valores não.

---

## Receita por frente

| Linha | Definição | Mês 1 | Mês 2 | Mês 3 |
|---|---|---|---|---|
| Receita de assinatura — Meridian (1.1) | Mensalidade do Meridian contínuo faturada no mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Receita de assinatura — Charter (1.2) | Mensalidade do Charter faturada no mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Receita de assinatura — Cosmos (1.3) | Mensalidade de plataforma faturada no mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Receita de assinatura — Signal (1.4) | Mensalidade do Signal faturada no mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Receita de serviço — Meridian (1.5) | Diagnósticos reconhecidos no mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Receita de serviço — Scaffold (1.6) | Pacotes reconhecidos no mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Receita de serviço — Charter/outros (1.7 + 1.8) | Setup e add-ons de projeto reconhecidos no mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| **Receita bruta total** | Soma das linhas acima | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ |
| Deduções (2.1 + 2.2) | Impostos sobre receita e cancelamentos do mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| **Receita líquida** | Receita bruta menos deduções | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ |

## Custo de entrega e margem bruta por frente

Casamento de receita (linhas 1.x acima) com custo direto de entregar (3.x),
para saber qual frente sustenta a operação e qual só ocupa capacidade.

| Linha | Definição | Mês 1 | Mês 2 | Mês 3 |
|---|---|---|---|---|
| Custo de entrega — Meridian (3.1) | Custo direto de diagnóstico e acompanhamento | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Custo de entrega — Scaffold (3.2) | Custo direto dos pacotes executados | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Custo de entrega — Charter/outros (3.3–3.5) | Custo direto de setup, terceiros e ferramentas de entrega | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| **Custo de entrega total** | Soma das linhas acima | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ |
| **Margem bruta** | Receita líquida menos custo de entrega total | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ |
| Margem bruta % | Margem bruta ÷ receita líquida | ⟨%⟩ | ⟨%⟩ | ⟨%⟩ |

Margem bruta por frente individual (Meridian, Scaffold, Charter/outros) fica
a critério de quem lê — repetir a mesma conta (receita da frente menos custo
de entrega da mesma frente) para cada produto, se o volume já justificar o
detalhe.

## Despesas por centro de custo

Contas de 4, 5 e 6 do plano de contas, uma linha por centro.

| Linha | Definição | Mês 1 | Mês 2 | Mês 3 |
|---|---|---|---|---|
| Comercial (4.1–4.6) | Pessoal, comissão, ferramentas, mídia e discovery não faturado do mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Produto/engenharia (5.1–5.3) | Pessoal, infraestrutura e ferramentas de engenharia do mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| G&A (6.1–6.3) | Pessoal administrativo, jurídico/contábil e escritório do mês | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| **Despesas totais** | Soma das três linhas | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ |

A linha "Comercial" deste DRE é a mesma base de custo que
[`cac-modelo.md`](../comercial/cac-modelo.md) §2 usa no numerador do CAC —
os dois documentos devem sempre bater no valor mensal de vendas e marketing.

## Resultado

| Linha | Definição | Mês 1 | Mês 2 | Mês 3 |
|---|---|---|---|---|
| **EBITDA** | Margem bruta menos despesas totais | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ |
| EBITDA % | EBITDA ÷ receita líquida | ⟨%⟩ | ⟨%⟩ | ⟨%⟩ |

EBITDA aqui já é o suficiente para acompanhar operação — depreciação,
amortização, juros e impostos sobre o lucro entram só quando houver ativo
relevante para depreciar ou dívida para pagar juros, nenhum dos dois presente
hoje.

# Caixa de 13 semanas — forecast rolante

Diferente do [DRE](dre-modelo.md), que é por competência, este é por caixa —
quando o dinheiro entra e sai de fato, não quando o fato gerador ocorre.
Semana 1 é a semana corrente; a régua sempre olha 13 semanas à frente e
empurra uma semana a cada atualização.

Entradas por frente de receita (mesmos produtos do
[plano de contas](plano-de-contas.md)), separadas por certeza: recebível já
faturado, contrato assinado ainda não faturado, e pipeline ponderado pela
conversão do funil descrita em [`mapa-de-processo.md`](../comercial/mapa-de-processo.md).
Saídas por categoria, ligadas aos centros de custo do plano de contas.

---

## Tabela — semanas 1 a 13

Uma coluna por semana, todas ⟨preencher⟩. Estrutura abaixo mostra as três
primeiras e a última; replicar para as semanas 4–12.

| Linha | Definição | Sem. 1 | Sem. 2 | Sem. 3 | … | Sem. 13 |
|---|---|---|---|---|---|---|
| **Saldo inicial** | Saldo em caixa no primeiro dia da semana (= saldo final da semana anterior) | ⟨preencher⟩ | ⟨calc⟩ | ⟨calc⟩ | … | ⟨calc⟩ |
| Entradas — recebíveis previstos | Faturas já emitidas com vencimento na semana | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| Entradas — contratos assinados | `Proposal.status = ACEITA` ainda não faturada, pelo prazo de faturamento do contrato | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| Entradas — pipeline ponderado | Valor de propostas em `ENVIADA`/`AGUARDANDO_APROVACAO` × taxa de conversão `proposta enviada → ACEITA` do funil | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| **Total de entradas** | Soma das três linhas de entrada | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ | … | ⟨soma⟩ |
| Saídas — pessoal (todas as folhas) | Salário e encargos de comercial, entrega, engenharia e G&A que caem na semana | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| Saídas — fornecedores e ferramentas | Pagamento de assinaturas SaaS, infraestrutura, terceiros de entrega | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| Saídas — comercial (mídia, comissão) | Mídia paga e comissão liquidadas na semana | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| Saídas — impostos e obrigações | Tributos e encargos com vencimento na semana | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| Saídas — outras (jurídico, escritório) | Despesas de G&A não recorrentes na folha | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | … | ⟨preencher⟩ |
| **Total de saídas** | Soma das cinco linhas de saída | ⟨soma⟩ | ⟨soma⟩ | ⟨soma⟩ | … | ⟨soma⟩ |
| **Saldo final** | Saldo inicial + total de entradas − total de saídas | ⟨calc⟩ | ⟨calc⟩ | ⟨calc⟩ | … | ⟨calc⟩ |

O pipeline ponderado é deliberadamente conservador: só entra propostas que já
saíram (`ENVIADA` ou na fila de aprovação), nunca `Lead` em `DISCOVERY` ou
`EVALUATION` — antes de virar proposta o valor não tem número para ponderar.

---

## Regra de atualização semanal

1. **No início de cada semana**, a semana 1 anterior sai da tabela e uma nova
   semana 13 entra no fim, com entradas e saídas ainda a preencher.
2. **O saldo final realizado da semana que fechou** vira o saldo inicial da
   nova semana 1 — sempre valor de extrato bancário, nunca projeção.
3. **Recebíveis e contratos assinados** se atualizam com o que de fato mudou
   de estágio na semana: proposta que virou `ACEITA` sai de "pipeline
   ponderado" e entra em "contratos assinados"; fatura emitida sai de
   "contratos assinados" e entra em "recebíveis previstos".
4. **O pipeline ponderado se recalcula com a taxa de conversão mais recente**
   do funil (`mapa-de-processo.md` §8), não com uma taxa fixa herdada de
   quando a régua começou — o volume ainda é baixo o suficiente para a taxa
   mudar mês a mês.
5. **Toda saída realizada é lançada pelo valor real do extrato**, mesmo que
   divirja do valor projetado na semana anterior — a régua rolante existe
   para corrigir o desvio, não para escondê-lo.

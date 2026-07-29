# ADR-0006 — SLA em dias úteis sem calendário de feriados

**Status**: Accepted · **lacuna de spec**
**Data**: 2026-07-28
**Contexto de origem**: `DATA-MODEL.md §4.1` — "SLA em **dias úteis**, contado da submissão"

## Contexto

O SLA é contado em dias úteis. `FR-3.3` exige exibir consumido/total (`2/10`) com
tom por proximidade e a palavra "vencido" em vermelho quando estoura.

**A lacuna**: "dia útil" não é definido. Fim de semana é claro. Feriado não —
e a organização de exemplo do próprio handoff opera em `BR · UE`, dois
calendários diferentes. Um caso submetido na véspera do Carnaval tem prazo
diferente conforme a jurisdição, e nada no handoff diz qual manda: a do tenant, a
do requester ou a do revisor.

## Decisão

`businessDaysBetween` exclui **sábado e domingo**. Feriado não entra no V1.

O cálculo roda em UTC, sem fuso por tenant. `slaRemaining` retorna número
negativo quando vencido — a UI precisa distinguir "vence hoje" (`0`) de "vencido
há 3 dias" (`-3`), e escreve a palavra "vencido", porque cor não carrega estado
sozinha (`NFR-2.2`).

A limitação está comentada no código, junto da função.

## Alternativas consideradas

**Dias corridos.** Mais simples e sem ambiguidade, mas contraria o texto
normativo e infla artificialmente o atraso de todo caso submetido numa sexta.

**Calendário de feriados por geografia do tenant.** Correto. Exige: campo de
jurisdição em `CharterSettings` (existe `geo`, mas como texto livre — "BR · UE"),
uma tabela de feriados por ano e país, e uma decisão de produto sobre qual
calendário manda quando o tenant opera em vários. Fora do escopo do V1.

**Biblioteca de feriados (`date-holidays` ou similar).** Resolve a tabela, não a
decisão de produto sobre qual jurisdição manda. Adiar a dependência até haver a
decisão.

## Consequências

- Todo SLA é **otimista por até ~2 dias por feriado** no período. Num SLA de 10
  dias atravessando Carnaval, o sistema marca "vencido" antes do prazo real.
- Casos marcados fora de SLA na virada de feriado geram alerta indevido na Visão
  Geral e podem constar num pacote de evidência como atraso que não houve.
- Consequência de auditoria: se um cliente contestar um atraso registrado, a
  resposta hoje é "o cálculo não considera feriados". Aceitável em piloto,
  frágil sob contrato com penalidade de SLA.
- Para fechar: adicionar `jurisdiction` em `CharterSettings` (enum, não texto
  livre) e uma tabela de feriados. `slaRemaining` já recebe `now` por parâmetro,
  então a mudança é local à função e aos seus testes.

# ADR-0011 — Notificações e job de SLA fora do V1

**Status**: Accepted · **escopo reduzido**
**Data**: 2026-07-28
**Contexto de origem**: `DATA-MODEL.md §6`, PRD §14, `FR-12.3`

## Contexto

O handoff pede oito gatilhos de notificação (PRD §14) e um efeito colateral
explícito:

> **SLA vencido** → alerta para revisor + Compliance (**job agendado**, não
> trigger de request)

`FR-4.6` também diz que submeter "notifica os revisores do caminho derivado", e
`DATA-MODEL.md §6` que decidir "notifica requester; se `restricted`, abre
pendência de aceite das condições".

O repo tem `@repo/notifications`, `NotificationPreference` e Inngest instalado —
a infraestrutura existe.

## Decisão

**V1 entrega a configuração e a visibilidade; não entrega o envio.**

O que está implementado:

- Os 8 gatilhos em `/settings` → Notificações, com toggle persistido em
  `CharterSettings.notificationTriggers` e auditoria por alteração (FR-12.3).
- Toda condição que geraria notificação aparece na **fila de alertas da Visão
  Geral** (FR-1.2), priorizada por severidade e com CTA que navega para a
  origem: SLA vencido, caso sem revisor com SLA perto de vencer, fornecedor sem
  DPA, mitigação atrasada, seções fora de publicação, aceites pendentes.
- Os efeitos colaterais **de dado** de `DATA-MODEL.md §6` estão todos
  implementados e em transação: publicar versão invalida aceites e marca
  reatribuição; mudar tier reavalia todos os casos vinculados; decidir grava
  diff; exportar grava a si mesma.

O que **não** está:

- Nenhum e-mail, Slack ou notificação in-app é disparado.
- Não há job Inngest de varredura de SLA. A detecção de "fora de SLA" é
  calculada na leitura da Visão Geral.
- A pendência de aceite das condições de uma aprovação restrita **não é criada**
  — as condições ficam no caso (`restrictions`), visíveis no detalhe, mas o
  requester não recebe pendência formal para aceitá-las.

## Alternativas consideradas

**Implementar o job de SLA e o envio.** Exige decidir canal por gatilho, template
por idioma, e como `NotificationPreference` (por usuário, do Cosmos) se compõe
com os gatilhos do Charter (por tenant, por papel). Três decisões de produto
antes da primeira linha útil.

**Disparar notificação no request da action, sem job.** Rejeitada e o handoff
antecipa o motivo: SLA vencido é condição de passagem de tempo, não de ação. Só
seria detectado quando alguém abrisse a tela — e o caso esquecido, que é
exatamente o que precisa de alerta, nunca dispararia.

## Consequências

- A promessa de "não descobrir SLA estourado por e-mail do auditor" (user story
  de FR-1) só se cumpre **para quem abre a Visão Geral**. Quem não abre, não
  sabe. É a diferença entre painel e alerta, e o V1 entrega painel.
- A configuração de gatilhos é funcional e auditada, mas **não tem efeito
  observável**. Numa demo, isso precisa ser dito — um toggle que não faz nada é
  pior que um toggle ausente se o cliente descobrir sozinho.
- `FR-4.6` ("notifica os revisores") e a pendência de aceite de restrições de
  `DATA-MODEL.md §6` estão **parcialmente atendidos**: o dado é gravado, a
  comunicação não acontece.
- Para fechar: job Inngest de varredura diária (SLA, mitigação vencida, renovação
  de fornecedor), mais `CharterAcknowledgment` reusado ou uma tabela de pendência
  de condição para o aceite de restrições.

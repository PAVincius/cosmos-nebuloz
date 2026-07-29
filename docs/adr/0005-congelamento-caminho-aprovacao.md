# ADR-0005 — Congelamento do caminho de aprovação na submissão

**Status**: Accepted · **lacuna de spec**
**Data**: 2026-07-28
**Contexto de origem**: `DATA-MODEL.md §4.1` vs modelagem de `CharterUseCase`

## Contexto

`recommendPath(dataClass, exposure, criticality)` deriva caminho de aprovação,
SLA e nível de human-in-the-loop. `FR-4.2` exige que rode **ao vivo no intake**.
`UseCase` no `DATA-MODEL.md §1` carrega `hitl`, `sla` e `slaTotal` como campos.

**A lacuna**: nenhum documento diz o que acontece com um caso já submetido
quando (a) a regra muda, ou (b) alguém edita a classe de dado do caso. Recalcular
sempre e persistir no ato são comportamentos diferentes e ambos defensáveis.

O risco de recalcular sempre é concreto: um caso submetido com SLA de 10 dias,
em revisão há 8, veria seu SLA virar 3 dias se a regra fosse afrouxada — e
apareceria como "fora de SLA" retroativamente, ou o inverso. A trilha de
auditoria registraria uma decisão tomada sob um prazo que nunca existiu.

## Decisão

`approvalPath`, `slaTotal` e `hitl` são **persistidos no ato da submissão** e
não são recalculados depois. São o contrato firmado naquele momento.

`slaRemaining` continua derivado (`slaTotal − dias úteis desde `submittedAt``),
porque é função do tempo, não da regra.

Rascunho (`asDraft`) não congela nada: os três campos ficam `null` até a
submissão de verdade.

Mudança de classe de dado num caso já submetido não é edição — é **novo caso**
ou **pedido de ajuste** (`CHANGES`, que devolve ao requester). O V1 não oferece
edição de classe pós-submissão, e essa ausência é deliberada.

## Alternativas consideradas

**Recalcular na leitura, nunca persistir.** Mantém tudo consistente com a regra
vigente e evita drift. Rejeitada pelo motivo acima: reescreve retroativamente o
prazo sob o qual uma decisão foi tomada. Num produto cuja saída é evidência de
auditoria, isso é falsificação por conveniência de implementação.

**Persistir e recalcular quando a regra muda, versionando a regra.** Correto e
caro: exigiria versionar `recommendPath` e guardar a versão em cada caso.
Justificável quando houver mudança de regra em produção com casos em voo. Hoje
não há.

**Permitir editar a classe de dado com recálculo e nova entrada de auditoria.**
Rejeitada para o V1: cria um caminho em que o requester contorna o gate de
fornecedor submetendo como Público e editando para Restrito depois.

## Consequências

- Um caso mostra o caminho que valia quando foi submetido. Se a política mudar,
  casos antigos continuam legíveis à luz da regra da época.
- `rules.ts` pode evoluir sem migração de dados nem efeito retroativo.
- **Casos em `DRAFT` submetidos após uma mudança de regra pegam a regra nova** —
  correto, porque nunca houve contrato.
- Se surgir necessidade de re-submissão com nova avaliação, o caminho é
  `CHANGES` → requester corrige → reenvia, e o reenvio recongela. Esse fluxo
  existe no schema (`changeRequest`) mas a re-submissão pelo requester ainda não
  tem tela — ver ADR-0011.

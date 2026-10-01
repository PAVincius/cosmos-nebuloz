# Meridian — transição REVIEW → FINALISED (finalizar assessment)

Pedido do Norte (30/09): nenhum código gravava `FINALISED`; `lib/meridian/ranked-gaps.ts:38` (X-03) só lê `FINALISED`, então o endpoint de gaps ranqueados voltava vazio para qualquer assessment real.

## O que entrou
- **Action** `app/(meridian)/actions/finalize.ts` (`finalizeAssessment`): permissão `assessment.manage` (só CONSULTANT; REVIEWER e VIEWER recusados pelo guard). Pré-condições, cada uma com regra nomeada: assessment do tenant (`assessment.not-found`); em REVIEW (`finalize.not-in-review` para DRAFT/COLLECTING; `finalize.already-finalised`); cinco eixos com score (`finalize.scoring-missing`); nenhum eixo `CONTESTED` (`finalize.contested-pending`, nomeia os eixos; `OVERRIDDEN` já é decisão e não bloqueia). A escrita é `updateMany` com `status: "REVIEW"` no `where` (corrida: `finalize.state-changed`), e a auditoria `meridian.assessment.finalise` (diff Status REVIEW → FINALISED) vai na mesma transação. Sem coluna nova: quem e quando ficam no AuditLog.
- **Tela:** `screens/finalize-button.tsx`, no cabeçalho do detalhe (`assessment-detail.tsx`). Ação sem volta: confirmação em modal. Sem poder, o botão fica `disabled` de verdade e o motivo está escrito ao lado (coleta não fechada; eixo sem score; eixo contestado, nomeado). Finalizado: some.
- **Efeito:** o X-03 passa a devolver os gaps (ele já lia `FINALISED`; nada mudou nele).

## O que mais depende de FINALISED (conferido)
- `ranked-gaps.ts` (X-03): só `FINALISED`, de propósito (spec). Resolvido por esta transição.
- `collection.ts:70` (atribuir respondente) e `:416` (fechar coleta) recusam `FINALISED`; `tab-coleta.tsx:1077` desabilita; `assessments.tsx:251` não conta finalizado como ativo. Coerentes.
- Trilha de prontidão do Scaffold (#331): `listScaffoldAssessments` e `_seed-track` não filtram por status (só `hasFullScoring`), aceitam REVIEW. Nada depende só de FINALISED.

## Pontos abertos para o Norte (não implementados, sem spec)
1. **Não há caminho para "confirmar o computado".** Um eixo `CONTESTED` só sai desse estado por override com score DIFERENTE (spec 001 US2 cenário 4 recusa override sem mudança). O revisor que concorda com o computado não esvazia a fila, e o assessment não finaliza (contorno hoje: override de 1 ponto). Para a "fila vazia" fechar de verdade, falta a decisão "confirmar o computado" (com justificativa e auditoria).
2. **Depois de FINALISED, ainda é possível** registrar override, editar gap e plano, e as respostas seguem editáveis (integridade já listada no PRODUCT.md). Se "finalizado" deve congelar decisões, é regra nova.
3. **Relatório:** continua legível em REVIEW (o Scaffold e o #331 dependem disso). "Relatório final" hoje é só o estado do assessment; se o relatório deve mostrar "Preliminar × Final", é UI nova.
4. Sem volta (FINALISED → REVIEW): não foi pedido.

## Testes
`__tests__/meridian/finalize.test.ts` (12) e `finalize-button.test.tsx` (10), RED antes. `__tests__/meridian` + `__tests__/screens` + `__tests__/scaffold` 1582/0 sem `SKIP_ENV_VALIDATION`; tsc limpo nos arquivos tocados; guard de tamanho ok. **E2E não escrito/rodado** (sem banco/app local aqui): fica para o Crivo.

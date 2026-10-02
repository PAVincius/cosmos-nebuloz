# Meridian: estado travado na escrita (concorrência)

Branch `fix/meridian-concorrencia-estado`, a partir de github/main (c47fc6d8). Pedido do CEO via Morgana: deixar o Meridian apto para cliente externo, sem Inngest.

## Feito
1. `confirm.ts`: o status do eixo vira `updateMany` com `status: CONTESTED` e `assessment.status != FINALISED` no where. `count !== 1` lança `StateConflictError` `confirm.state-changed`. A escrita vem antes do código OV e da linha CONFIRMATION, então quem perde a corrida não deixa nada. Teste com duas confirmações concorrentes.
2. Trava de estado:
   - Override e confirmação: `assessment.status != FINALISED` no where do `updateMany` do eixo (override recusa com `assessment.finalised`). `requireDecisionsOpen` continua como recusa rápida, agora com `finalisedError()` compartilhado.
   - Respondente (`saveDraft`, `submitBattery`, `attachEvidence`): leitura de `COLLECTING` na mesma transação da escrita, com `SELECT ... FOR SHARE` na linha do assessment. Fechar a coleta espera quem grava. Em `attachEvidence` o upload fica fora da transação; se a coleta fechou no meio, o objeto é removido do bucket (falha da remoção vai para o log).
   - Gaps, plano e scoring: já liam o estado na transação (`withTenantDb`); sem mudança.
3. `scoring.ts` `runScoringInTx`: a confirmação só mantém COMPUTED se `result.score` for igual ao `toScore` da última CONFIRMATION do eixo (`orderBy createdAt desc`); senão o eixo volta a CONTESTED.

## Verificação
- `pnpm exec vitest run __tests__/meridian __tests__/lib` em apps/app: 748 passando.
- `tsc --noEmit`: nenhum erro nos arquivos tocados (client Prisma regenerado no worktree).
- biome check nos 9 arquivos tocados: limpo.

## Fora do escopo / a saber
- Dois overrides concorrentes no mesmo eixo ainda calculam `fromScore` de leitura antiga; não pedido aqui.
- `FOR SHARE` e o where com relação não são exercitados por teste de unidade (mocks); só o contrato (qual cliente, qual where). Vale um E2E com Postgres real quando o ambiente de E2E destravar.
- Pendente: canal do respondente em `/legal/privacy` (texto de `operadora-controladora.md` §4), depende de e-mail e encarregado do CEO.

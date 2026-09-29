# Signal — modelos de medição e plano por iniciativa (SG-DEV-04..07)

Branch `feat/signal-plano-medicao` (worktree wt-signal), a partir de `feat/signal-charter-modelos`.

- Regras puras: `lib/signal/plan.ts` (máquina de estados, quem transita, meta congelada, proposta fora do veredito).
- Actions: `actions/plan.ts` (gerar plano, propor, aprovar, mapear fonte, pausar/retomar, pedir revisão, editar) e `plan-read.ts`.
- Evento novo `signal/target-review.requested` em `lib/inngest/product-events.ts`.
- Telas: `screens/models.tsx`, `plan-tab.tsx` (aba Plano em initiative-detail), `plan-modals.tsx`, CSS responsivo 1280/1100/1024.
- Shell: contagem de modelos no menu; `loading.tsx` da rota.

Decisões/lacunas: ADMIN não transita (regra em `planActionDenial`, não na matriz); ANALYST alcança o que o OWNER faz;
Baseline na tabela só aparece com a métrica congelada (não há vínculo métrica↔dimensão de baseline); congelar métrica
(sistema, evento de baseline) e troca de primária não implementados; responsável só leitura no modal;
layout não verificado no navegador (dev server proibido nesta noite).

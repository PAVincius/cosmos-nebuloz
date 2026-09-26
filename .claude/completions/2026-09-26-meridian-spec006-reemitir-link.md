# Spec 006 — Reemitir link do respondente (US1 + US2)

**Data**: 2026-09-26
**Commits**:
- `2b1a88ee` — `calcularExpiracaoDaReemissao` (helper + teste), Fase 2/Setup
- `eda93c48` — `reissueRespondentLink` + `reissuePendingLinks` (actions + testes), US1+US2 backend
- `f771b865` — botão "Reemitir link" na aba Coleta (US1 UI + E2E)
- `dac31004` — botão "Reemitir e copiar todos os pendentes" + modal de lista (US2 UI + E2E)

**Origem**: Morgana, P0 caminho crítico do laboratório — `specs/006-reemitir-link-respondente/`
(CEO perdeu os 10 links do AS-112 três vezes em produção, `docs/qualidade/dogfood/meridian/diario.md`).

## O quê

`apps/app/lib/meridian/respondent-token.ts`:
- `calcularExpiracaoDaReemissao(deadline, now)` = `min(now + 14d, deadline)`, fixado uma vez,
  nunca recalculado (fecha o P2 do Vigia sobre `assignRespondent` copiar `deadline` direto).

`apps/app/app/(meridian)/actions/collection.ts`:
- `reissueRespondentLink(respondentId)` — gira `tokenHash` do MESMO respondente (mesmo
  mecanismo de `revokeRespondent`, sem tocar `status`), bloqueia `DONE`/`REVOKED`/deadline
  vencido, audita `meridian.respondent.reissue`.
- `reissuePendingLinks(assessmentId)` — reemite em lote todo `INVITED`/`PENDING`/`OVERDUE`
  numa única passada dentro de `withTenantDb`; `DONE`/`REVOKED` não são tocados (a própria
  query já exclui); lista vazia devolve sucesso com `reissued: []`, não erro (FR-013).

`apps/app/components/meridian/screens/tab-coleta.tsx`:
- Botão "Reemitir link" por respondente (mesma condição de visibilidade de "Lembrar").
- Botão "Reemitir e copiar todos os pendentes" no cabeçalho de "Respondentes por eixo".
- Extraí `RespondentLinkModal` (reusado por atribuir E reemitir individual) e
  `ReissuedListModal` (lote: lista nome·eixo·link, "Copiar tudo", "Baixar .txt"/"Baixar .csv").
  `buildReissuedListText`/`buildReissuedListCsv` exportadas e testadas isoladamente.
- Todos os três modais (atribuir/reemitir individual, revogar, lote) usam a mesma guarda de
  fechamento (`useCloseGuard`) — X/Esc/backdrop pedem confirmação antes de fechar sem
  copiar/baixar, mesma lição do P1 AS-112 (commit `5fad9132`).

## Refactor de robustez (achado rodando a suíte inteira)

`useCloseGuard` originalmente interceptava Esc via `document.addEventListener` manual
(fase de captura). Rodando o arquivo de teste inteiro (não só os testes novos isolados),
os testes de Esc começaram a vazar uns nos outros — o listener manual de um modal já
desmontado ocasionalmente sobrevivia até o teste seguinte, quebrando a asserção. Troquei
para `onKeyDownCapture` do próprio React, escopado ao DOM do modal via um wrapper
`<div style={{display:"contents"}}>` (não afeta layout, já que `display:contents` repassa
os filhos pro grid do `ModalHost`) — limpeza garantida pelo ciclo de vida do React, sem
`addEventListener`/`removeEventListener` manual, sem risco de vazar entre montagens.

Isso exigiu ajustar os testes existentes de Esc: `fireEvent.keyDown(document, ...)` não
alcança um `onKeyDownCapture` de React (que fica num nó mais fundo que `document`) — trocado
pra `fireEvent.keyDown(document.activeElement ?? document, ...)`, que é também a simulação
mais fiel de "usuário aperta Esc com o modal focado" (o `ModalShell` foca o primeiro
controle ao abrir).

## Testes

- `__tests__/meridian/respondent-token.test.ts` (novo): 3 testes do helper.
- `__tests__/meridian/collection.test.ts`: +9 testes (`reissueRespondentLink` ×5,
  `reissuePendingLinks` ×4). Cobertura de `collection.ts`: 95.27% stmts / 80.95% branch
  / 100% funcs — bem acima do piso (`vitest.config.mts`, 75/64).
- `__tests__/screens/meridian-tab-coleta.test.tsx`: +9 testes (reemitir individual ×2,
  formatadores de lote ×2, lote ×5, incluindo Esc/X/backdrop nos três modais).
- Total: 145/145 passam (`npx vitest run __tests__/meridian/
  __tests__/screens/meridian-tab-coleta.test.tsx`), estável em rodadas repetidas.

## E2E (T006/T011) — escritos, não executados

`e2e/meridian-reemitir-link.spec.ts` (cenários 1-3 do quickstart) e
`e2e/meridian-reemitir-lote.spec.ts` (cenários 4-5). Não rodei neste ambiente — sem
`pnpm dev`/DB local disponível na sessão. Cenário 6 (`tokenExpiresAt` fixado, não recalcula
com deadline estendido depois) é coberto pelo teste unitário do helper + pelo fato de não
haver nenhum código que recalcule o campo após a gravação — não escrevi E2E dedicado pra
esse cenário (não há passo de UI que "estenda o deadline depois", seria um teste de banco
direto, fora do padrão dos outros specs E2E do módulo).

## Obstáculo / nota pro Crivo

DONE bloqueado (spec.md cenário 2) só é verificável a nível de action nos testes — a UI
esconde o botão "Reemitir link" pra respondentes `DONE` (mesma condição de "Lembrar",
decisão do `research.md`), então não existe caminho de UI pra montar esse cenário
especificamente; o E2E de bloqueios cobre só REVOKED (onde a UI também some com o botão,
mas por um caminho que dá pra montar via "Revogar" primeiro).

## Fora do escopo

Não toquei em `packages/auth` (spec 004 rodando em paralelo, sem overlap de arquivo,
conforme `plan.md`).

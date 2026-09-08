# Scaffold — US3: shell, portfólio e detalhe de trilha (T049–T064)

**Data**: 2026-09-02 · **Branch**: `claude/scaffold-html-impl-baa4f7`
**Plano**: [`specs/002-scaffold-adoption/plan.md`](../../specs/002-scaffold-adoption/plan.md)

## O que entrou

Primeira superfície visível. O gate engine da US2 agora tem por onde ser
olhado e operado.

- **Casca** — `components/scaffold/shell.tsx`: sidebar com badges, topbar com
  breadcrumb, toggle de tema em `localStorage`, card de estagnação (S-09).
- **Navegação** — `components/scaffold/nav.ts`: `TITLES`, `NAV`, `navIdFor`.
  Dado puro, sem import de componente.
- **Telas** — `screens/portfolio.tsx` (KPIs, funil de fases, taxa de override,
  tabela filtrável) e `screens/track-detail.tsx` (stepper com losangos de gate,
  passos com artefatos, painel de gate com snapshot congelado, janela de
  observação).
- **Actions** — `steps.ts` (`setStepState`, `attachArtefact`, `readArtefact`) e
  `tracks.ts` reformado: `listTracks` devolve `PortfolioSummary`, `getTrack`
  devolve `TrackDetail`.
- **Primitivas** — `components/scaffold/base.tsx`, barril de reexport do Charter,
  igual ao do Meridian.

## Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | 0 erros |
| `biome check` (Scaffold + storage) | 0 erros |
| Suíte `apps/app` | 3458 testes, 0 falhas |
| Testes novos | 23 (140 no Scaffold) |

## Correção de US1: o CSS vazava

`scaffold.css` da US1 usava seletores globais (`[data-theme="dark"] .grain`,
`.btn`, `.mono`). O padrão do repo — documentado no cabeçalho do
`meridian.css` — escopa tudo em `.<produto>-root`, porque um tenant pode ter
Cosmos, Charter, Meridian e Scaffold na mesma sessão e o `kit.tsx` é
compartilhado.

Todo o arquivo foi reescopado em `.scaffold-root`, e a casca marca a raiz.

## Três correções no meu próprio teste de arquitetura

O `gates-architecture.test.ts` chegou à terceira versão. Vale registrar porque
as duas primeiras estavam erradas de maneiras diferentes:

| Versão | O que fazia | Por que estava errada |
|---|---|---|
| 1ª | Procurava o literal `state: "CLOSED"` | `gates.ts` escreve `state: to`, derivado de `nextState()`. Não achava nada no arquivo dono, e casava fixtures de teste |
| 2ª | Proibia `scaffoldPhaseInstance.update` fora de `gates.ts` | Larga demais. Acusou `steps.ts`, que move a fase entre OPEN e GATE_READY ao concluir passo — bookkeeping de SG-01, reversível, sem gravar resultado |
| 3ª | Proíbe o literal `CLOSED`/`OBSERVING` fora de `gates.ts`, e fixa a lista de quem mais escreve estado de fase | O perigo real é estreito: chegar a esses dois estados sem `ScaffoldGateResult` |

A 3ª versão ainda checa que `gates.ts` chama `nextState(` e
`scaffoldGateResult.create` — sem isso os outros testes virariam vacuamente
verdes se `closePhase` fosse movida.

## Correção no contrato: `AccessLog` era o veículo errado

[`contracts/server-actions.md`](../../specs/002-scaffold-adoption/contracts/server-actions.md)
dizia que `readArtefact` grava `AccessLog`. Errado: `AccessLog` é
LOGIN/LOGOUT/RECUSADO do back-office, não leitura de artefato. O veículo certo
é o `AuditLog` append-only, via `logScaffoldAudit` — que é exatamente o que o
Meridian faz em `requestEvidenceUrl`.

`AccessLog` continua certo para o `enterTenantContext` de US6: ali é travessia
de acesso de verdade.

Também descobri que `@repo/storage` não tem as funções que o contrato
presumia — é um cliente Supabase com `storageClient.storage.from(BUCKET)`.
Acrescentei `SCAFFOLD_ARTEFACT_BUCKET` e segui o padrão do Meridian.

## Decisões da fatia

**`TITLES` saiu do registry para `nav.ts`.** O registry importa as telas, que
importam server actions, que leem env de servidor — qualquer consumidor que só
queira um rótulo arrastava tudo junto, e os testes quebravam com "Attempted to
access a server-side environment variable on the client". Como efeito, a
duplicação de títulos que eu tinha posto na casca sumiu.

**Concluir passo NÃO fecha gate.** `setStepState` move a fase entre OPEN e
GATE_READY, nos dois sentidos. Só avançar deixaria o gate pronto sobre trabalho
que alguém desmarcou depois.

**O painel de gate mostra o snapshot, não os critérios de hoje.** Fase já
decidida renderiza `criteriaSnapshot`; mostrar o template atual sobre uma
decisão passada reescreveria a história do gate na tela, mesmo com o banco
correto (SG-07).

**Seletor de persona não portado**, conforme ADR-0004 e research §R11. A falta
é a decisão, e está comentada na casca para quem comparar com o mock.

## O que fica para a próxima fatia

- **US4 (T065–T082)** — caso de negócio. A âncora mínima criada na US2 ganha
  versões, métricas, contestação e `contentHash`; SG-04 passa a ter o que
  destravar.
- Upload de artefato tem action e URL assinada, mas ainda não tem controle na
  tela — entra junto do formulário de passo.
- Migration real continua pendente: worktree sem `.env`. Schema validado,
  client gerado.

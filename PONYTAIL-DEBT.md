# Ponytail debt

Simplificações deliberadas marcadas com `ponytail:` no código. Cada linha é um
atalho consciente, com o teto que ele tem e o gatilho que manda revisitar.

Regerar:

```bash
grep -rnE '(#|//) ?ponytail:' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next
```

Levantado em 2026-09-02 · 2 marcadores · 2 sem gatilho.

---

## apps/app/\_\_tests\_\_/scripts/seed-entrypoint-guard.test.ts

**`:69`** — spawn real de `tsx` em vez de mockar Prisma. `no-trigger`
_teto:_ ~5s por módulo de wall-clock no teste.
_upgrade:_ não declarado — o comentário nomeia o custo, mas não diz quando ele
deixa de valer a pena.
_dono:_ PAVincius · 2026-07-26

## apps/app/e2e/setup/auth.setup.ts

**`:4`** — sem escrita direta no banco no setup de auth; depende de
`requireTenantSession` setar `activeTenantId` na primeira request. `no-trigger`
_teto:_ não declarado.
_upgrade:_ não declarado — lê como nota, não como adiamento.
_dono:_ PAVincius · 2026-07-10

---

## Cobertura

O ledger cobre **e2e do app**. Charter, backoffice e meridian têm **zero**
marcadores `ponytail:` — isso quer dizer não-marcado, não limpo.
`lib/meridian/*` e `packages/rbac/meridian-*` subiram sem nenhuma anotação de
atalho deliberado.

## Retirados

Os dois marcadores de analytics (`release-forecast.ts:16`, piso de sprints
fixo; `epic-confidence.ts:54`, N+1 por epic) saíram junto com o Executive
Confidence Index. Era dívida em cima de código morto: nenhuma tela consumia
`getPortfolioConfidence`, então nem o piso podia ser questionado por um
cliente nem a cardinalidade do N+1 podia crescer.

`docs/superpowers/plans/2026-06-16-executive-confidence-index.md:95,614` ainda
contém os dois comentários dentro de blocos de código do plano. O grep de
regeneração acima os encontra; são cópias em doc de código que não existe
mais, não dívida.

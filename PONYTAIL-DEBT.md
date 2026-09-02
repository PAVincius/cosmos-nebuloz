# Ponytail debt

Simplificações deliberadas marcadas com `ponytail:` no código. Cada linha é um
atalho consciente, com o teto que ele tem e o gatilho que manda revisitar.

Regerar:

```bash
grep -rnE '(#|//) ?ponytail:' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next
```

Levantado em 2026-09-02 · 4 marcadores · 2 sem gatilho.

---

## apps/app/lib/analytics/release-forecast.ts

**`:16`** — `MIN_SPRINTS_HISTORY = 3` fixo, em vez de config por org.
_teto:_ um único piso global para todos os tenants.
_upgrade:_ quando um cliente pedir piso diferente.
_dono:_ PAVincius · 2026-06-16

## apps/app/app/actions/analytics/epic-confidence.ts

**`:54`** — N+1: uma query `computeEpicConfidence` por epic, em loop.
_teto:_ aceitável enquanto epics IMPLEMENTING forem dezenas.
_upgrade:_ batch das queries de feature/throughput quando essa cardinalidade crescer.
_dono:_ PAVincius · 2026-06-16

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

O ledger cobre **cosmos analytics + e2e**. Charter, backoffice e meridian têm
**zero** marcadores `ponytail:` — isso quer dizer não-marcado, não limpo.
`lib/meridian/*` e `packages/rbac/meridian-*` subiram sem nenhuma anotação de
atalho deliberado.

`docs/superpowers/plans/2026-06-16-executive-confidence-index.md:95,614` repete
os dois marcadores de analytics dentro do plano. É cópia em doc, não código
vivo — não conta como dívida separada.

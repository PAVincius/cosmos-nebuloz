// wsjf-rebalance.ts — pure WSJF rebalance ranking-diff algorithm (Tier 7,
// Task 19). Plain module, no "use server": the actions file
// (app/(cosmos)/actions/wsjf.ts) imports this for the real read/write
// actions, and it's directly unit-testable without mocking Prisma.
//
// Epic.lifecycleOrder (packages/database/prisma/schema/art-core.prisma) is
// scoped PER lifecycle column: listEpics orders by [lifecycleStatus,
// lifecycleOrder], and moveEpic (app/(cosmos)/actions/kanban.ts) always
// writes it alongside lifecycleStatus. A naive global WSJF sort across all
// epics writing a flat 1..N position would scramble the kanban board's
// column layout. This algorithm instead re-ranks epics by WSJF score
// independently *within* each lifecycleStatus column, and only
// reports/writes epics whose position within their own column actually
// changes. (H1 fix: this used to share the plain `order` column with
// legacy, statusId-scoped readers/writers — e.g. app/actions/wsjf/index.ts,
// app/actions/strategic-themes/index.ts, app/actions/epics/create-epic.ts —
// so a bulk rewrite here silently corrupted their unrelated ordering.
// lifecycleStatus and statusId are independent fields, not 1:1, so
// lifecycleOrder now gives this lifecycleStatus-scoped ordering its own
// column instead of fighting theirs. See app/(cosmos)/actions/wsjf.ts and
// the WSJF rebalance commit body for the full reasoning.)
//
// Feature has no `order`/`lifecycleOrder` field at all (confirmed by
// reading the schema) — listWsjfItems merges Epic + Feature rows for
// display, but rebalance only ever operates on Epics; Feature rows are
// simply never passed in here.
//
// H2 fix: `wsjf` is null for any epic that was never fully scored (see
// computeEpicWsjf in kanban.ts — it requires all four of bv/tc/rr/js, no
// partial rollup). Ranking null as if it were 0 silently turned "never
// scored" into "worst score", which for a tenant where most epics are
// unscored collapses the WSJF sort onto the `a.id.localeCompare(b.id)`
// tiebreak — i.e. cuid order, not WSJF. Unscored epics (wsjf === null) are
// now excluded entirely: their lifecycleOrder is left untouched, and only
// the scored epics in a column are re-ranked among themselves, redistributed
// across the same lifecycleOrder *values* the scored epics already occupied
// (so the column's full value set — scored + untouched unscored — stays
// exactly what it was, preserving 0-based density without ever touching an
// unscored epic's position). `wsjf === 0` is treated as a real score, not
// as "unscored": computeEpicWsjf only ever returns a number when all four
// components are supplied (it returns null otherwise), so a stored 0 can
// only mean bv=tc=rr=0 was deliberately entered, not "never scored" — the
// DB default for the column is null, never 0.

export type EpicForRebalance = {
  id: string;
  title: string;
  lifecycleStatus: string;
  order: number;
  wsjf: number | null;
};

export type WsjfRebalanceMove = {
  id: string;
  title: string;
  lifecycleStatus: string;
  fromRank: number; // 1-based position within its column, by current order
  toRank: number; // 1-based position within its column, by WSJF desc
  toOrder: number; // new order value to persist (0-based)
};

export type WsjfRebalanceResult = {
  moves: WsjfRebalanceMove[];
  // Tenant-wide count of epics with wsjf === null that were excluded from
  // reordering for lack of a score (order left untouched either way).
  skippedUnscored: number;
};

export function computeEpicRebalanceMoves(
  epics: EpicForRebalance[]
): WsjfRebalanceResult {
  const byColumn = new Map<string, EpicForRebalance[]>();
  for (const epic of epics) {
    const list = byColumn.get(epic.lifecycleStatus) ?? [];
    list.push(epic);
    byColumn.set(epic.lifecycleStatus, list);
  }

  const moves: WsjfRebalanceMove[] = [];
  let skippedUnscored = 0;

  for (const [lifecycleStatus, list] of byColumn) {
    const scored = list.filter((epic) => epic.wsjf !== null);
    skippedUnscored += list.length - scored.length;

    // Fewer than two scored epics: nothing to rank against, so nothing to
    // rebalance in this column — scored and unscored alike keep their order.
    if (scored.length < 2) {
      continue;
    }

    // Rank (fromRank/toRank) is reported against the WHOLE column — unscored
    // epics still occupy real positions, they just never move.
    const byCurrentOrder = [...list].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id)
    );
    const fromRankById = new Map(
      byCurrentOrder.map((epic, i) => [epic.id, i + 1])
    );
    const rankByOrderValue = new Map(
      byCurrentOrder.map((epic, i) => [epic.order, i + 1])
    );

    // The only order values ever redistributed are the ones already held by
    // scored epics — unscored epics' values are never touched, so the
    // column's full value set is unchanged, just reassigned among the
    // scored subset.
    const slots = scored.map((epic) => epic.order).sort((a, b) => a - b);

    const byWsjfDesc = [...scored].sort(
      (a, b) =>
        (b.wsjf as number) - (a.wsjf as number) || a.id.localeCompare(b.id)
    );

    for (const [index, epic] of byWsjfDesc.entries()) {
      const toOrder = slots[index];
      if (toOrder === epic.order) {
        continue;
      }
      moves.push({
        id: epic.id,
        title: epic.title,
        lifecycleStatus,
        fromRank: fromRankById.get(epic.id) ?? index + 1,
        toRank: rankByOrderValue.get(toOrder) ?? index + 1,
        toOrder,
      });
    }
  }

  return { moves, skippedUnscored };
}

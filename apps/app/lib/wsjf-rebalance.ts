// wsjf-rebalance.ts — pure WSJF rebalance ranking-diff algorithm (Tier 7,
// Task 19). Plain module, no "use server": the actions file
// (app/(cosmos)/actions/wsjf.ts) imports this for the real read/write
// actions, and it's directly unit-testable without mocking Prisma.
//
// Epic.order (packages/database/prisma/schema/art-core.prisma) is scoped
// PER lifecycle column: listEpics orders by [lifecycleStatus, order], and
// moveEpic (app/(cosmos)/actions/kanban.ts) always writes order alongside
// lifecycleStatus. A naive global WSJF sort across all epics writing a flat
// 1..N order would scramble the kanban board's column layout. This
// algorithm instead re-ranks epics by WSJF score independently *within*
// each lifecycleStatus column, and only reports/writes epics whose position
// within their own column actually changes.
//
// Feature has no `order` field at all (confirmed by reading the schema) —
// listWsjfItems merges Epic + Feature rows for display, but rebalance only
// ever operates on Epics; Feature rows are simply never passed in here.

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

export function computeEpicRebalanceMoves(
  epics: EpicForRebalance[]
): WsjfRebalanceMove[] {
  const byColumn = new Map<string, EpicForRebalance[]>();
  for (const epic of epics) {
    const list = byColumn.get(epic.lifecycleStatus) ?? [];
    list.push(epic);
    byColumn.set(epic.lifecycleStatus, list);
  }

  const moves: WsjfRebalanceMove[] = [];
  for (const [lifecycleStatus, list] of byColumn) {
    const byCurrentOrder = [...list].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id)
    );
    const fromRankById = new Map(
      byCurrentOrder.map((epic, i) => [epic.id, i + 1])
    );

    const byWsjfDesc = [...list].sort(
      (a, b) => (b.wsjf ?? 0) - (a.wsjf ?? 0) || a.id.localeCompare(b.id)
    );

    for (const [index, epic] of byWsjfDesc.entries()) {
      const toOrder = index;
      if (toOrder === epic.order) {
        continue;
      }
      moves.push({
        id: epic.id,
        title: epic.title,
        lifecycleStatus,
        fromRank: fromRankById.get(epic.id) ?? index + 1,
        toRank: index + 1,
        toOrder,
      });
    }
  }

  return moves;
}

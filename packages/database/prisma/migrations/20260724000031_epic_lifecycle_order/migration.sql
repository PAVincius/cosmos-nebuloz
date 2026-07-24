-- WSJF rebalance H1 fix: Epic.order was shared between two independent
-- ordering domains — the SAFe Kanban board (scoped by lifecycleStatus:
-- listEpics/moveEpic in app/(cosmos)/actions/kanban.ts, and the WSJF
-- rebalance) and the legacy portfolio board (scoped by statusId:
-- app/actions/wsjf/index.ts, app/actions/strategic-themes/index.ts,
-- app/actions/epics/create-epic.ts, app/actions/epics/update-status.ts,
-- app/actions/epics/get-portfolio.ts). lifecycleStatus and statusId are
-- independent fields (verified: no code path writes both together), so a
-- lifecycleStatus-scoped bulk rewrite (WSJF rebalance) could silently
-- reassign order values that the statusId-scoped readers also depend on.
--
-- lifecycleOrder gives the lifecycleStatus-scoped ordering its own column.
-- `order` + statusId keep their existing legacy meaning, untouched.
--
-- Backfill copies the current `order` value: kanban.ts already writes/reads
-- `order` scoped by lifecycleStatus today, so lifecycleOrder starts out
-- identical to the board's current visible ordering — zero behavior change
-- for existing data.

ALTER TABLE "Epic" ADD COLUMN "lifecycleOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "Epic" SET "lifecycleOrder" = "order";

DROP INDEX IF EXISTS "Epic_tenantId_lifecycleStatus_order_idx";

CREATE INDEX "Epic_tenantId_lifecycleStatus_lifecycleOrder_idx"
  ON "Epic"("tenantId", "lifecycleStatus", "lifecycleOrder");

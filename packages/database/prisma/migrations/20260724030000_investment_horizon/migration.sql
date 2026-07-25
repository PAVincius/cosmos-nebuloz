-- InvestmentHorizon — new persistent domain concept: an investment horizon
-- (e.g. Emerging/Growth/Core) groups value streams (ARTs, via their
-- LeanBudget rows) by maturity/risk bet, with a target % of portfolio
-- investment compared against the real actual % (derived from LeanBudget
-- amounts at query time, never stored). Backs HorizonDetailScreen
-- (design handoff screen-bundle-4.jsx:2309). This is the minimal shape the
-- screen needs, not a full investment-horizon subsystem — flagged for
-- product review, same as ValueStream was.

CREATE TABLE "InvestmentHorizon" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "targetPct" DOUBLE PRECISION NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentHorizon_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvestmentHorizon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvestmentHorizon" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "InvestmentHorizon"
  USING ("tenantId" = current_tenant_id());

CREATE INDEX "InvestmentHorizon_tenantId_idx"
  ON "InvestmentHorizon"("tenantId");

ALTER TABLE "InvestmentHorizon" ADD CONSTRAINT "InvestmentHorizon_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

-- LeanBudget.horizonId — classifies a value stream's budget into an
-- investment horizon. Plain app-layer reference (matches the existing
-- artId/piPlanId precedent on this table — unlike themeId, no FK
-- constraint), tenant-guarded at the query layer.
ALTER TABLE "LeanBudget" ADD COLUMN "horizonId" TEXT;

CREATE INDEX "LeanBudget_tenantId_horizonId_idx"
  ON "LeanBudget"("tenantId", "horizonId");

-- Signal: plano de métricas por iniciativa (SG-DEV-03) e histórico append-only.
-- Depende de 20260929010000_signal_measure_models.

-- CreateEnum
CREATE TYPE "SignalPlanMetricState" AS ENUM ('PROPOSED', 'NO_SOURCE', 'MEASURING', 'PAUSED', 'FROZEN');

-- CreateEnum
CREATE TYPE "SignalPlanMetricAction" AS ENUM ('PROPOSE', 'APPROVE', 'MAP_SOURCE', 'START_MEASURING', 'PAUSE', 'RESUME', 'FREEZE', 'REQUEST_TARGET_REVIEW', 'CHANGE_PRIMARY', 'EDIT');

-- CreateTable
CREATE TABLE "SignalPlanMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "modelMetricId" TEXT,
    "role" "SignalMetricRole" NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "direction" "SignalMetricDirection" NOT NULL,
    "state" "SignalPlanMetricState" NOT NULL DEFAULT 'PROPOSED',
    "sourceMappingId" TEXT,
    "baselineValue" DECIMAL(18,6),
    "targetValue" DECIMAL(18,6),
    "ownerId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrentPrimary" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalPlanMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalPlanMetricEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planMetricId" TEXT NOT NULL,
    "action" "SignalPlanMetricAction" NOT NULL,
    "actorId" TEXT,
    "fromState" "SignalPlanMetricState",
    "toState" "SignalPlanMetricState",
    "version" INTEGER NOT NULL,
    "changes" JSONB,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalPlanMetricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalPlanMetric_tenantId_idx" ON "SignalPlanMetric"("tenantId");

-- CreateIndex
CREATE INDEX "SignalPlanMetric_initiativeId_state_idx" ON "SignalPlanMetric"("initiativeId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SignalPlanMetric_initiativeId_isCurrentPrimary_key" ON "SignalPlanMetric"("initiativeId", "isCurrentPrimary");

-- CreateIndex
CREATE INDEX "SignalPlanMetricEvent_tenantId_idx" ON "SignalPlanMetricEvent"("tenantId");

-- CreateIndex
CREATE INDEX "SignalPlanMetricEvent_planMetricId_createdAt_idx" ON "SignalPlanMetricEvent"("planMetricId", "createdAt");

-- AddForeignKey
ALTER TABLE "SignalPlanMetric" ADD CONSTRAINT "SignalPlanMetric_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "SignalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalPlanMetric" ADD CONSTRAINT "SignalPlanMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalPlanMetric" ADD CONSTRAINT "SignalPlanMetric_modelMetricId_fkey" FOREIGN KEY ("modelMetricId") REFERENCES "SignalMeasureModelMetric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalPlanMetric" ADD CONSTRAINT "SignalPlanMetric_sourceMappingId_fkey" FOREIGN KEY ("sourceMappingId") REFERENCES "SignalMetricMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalPlanMetricEvent" ADD CONSTRAINT "SignalPlanMetricEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalPlanMetricEvent" ADD CONSTRAINT "SignalPlanMetricEvent_planMetricId_fkey" FOREIGN KEY ("planMetricId") REFERENCES "SignalPlanMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes do plano que o banco garante (o resto é regra de action, SG-PO-03):
--  • isCurrentPrimary é true ou NULL, só em métrica PRIMARY já aprovada. Com o
--    unique (initiativeId, isCurrentPrimary), NULLs não colidem: no máximo UMA
--    primária vigente por iniciativa (SG-PO-02); proposta não pode ser primária.
ALTER TABLE "SignalPlanMetric" ADD CONSTRAINT "SignalPlanMetric_primaria_vigente"
  CHECK ("isCurrentPrimary" IS NULL OR ("isCurrentPrimary" AND "role" = 'PRIMARY' AND "state" <> 'PROPOSED'));

--  • Congelada não edita meta nem baseline (SG-DEV-05). Mudar meta de métrica
--    congelada é pedido de revisão ao Scaffold, não UPDATE local.
CREATE OR REPLACE FUNCTION prevent_signal_frozen_target_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."state" = 'FROZEN' AND (
    NEW."targetValue" IS DISTINCT FROM OLD."targetValue" OR
    NEW."baselineValue" IS DISTINCT FROM OLD."baselineValue"
  ) THEN
    RAISE EXCEPTION 'SignalPlanMetric % is FROZEN: target and baseline cannot change. Request a target review from Scaffold.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signal_plan_metric_frozen_target
  BEFORE UPDATE ON "SignalPlanMetric"
  FOR EACH ROW EXECUTE FUNCTION prevent_signal_frozen_target_change();

-- Histórico append-only no banco, como o AuditLog. UPDATE é sempre recusado;
-- DELETE direto também. DELETE em cascata do pai passa: dentro do trigger de
-- integridade referencial pg_trigger_depth() é > 1, e recusar aí travaria a
-- remoção de tenant. Função genérica, reusada por outras tabelas de histórico.
CREATE OR REPLACE FUNCTION prevent_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only. Operation: %, Entry ID: %', TG_TABLE_NAME, TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signal_plan_metric_event_immutable
  BEFORE UPDATE OR DELETE ON "SignalPlanMetricEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

-- RLS por tenant (padrão de 20260902150000/190000). ADR-0012: inerte enquanto a
-- aplicação conectar como superuser.
ALTER TABLE "SignalPlanMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignalPlanMetric" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SignalPlanMetric";
CREATE POLICY "tenant_isolation" ON "SignalPlanMetric"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "SignalPlanMetricEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignalPlanMetricEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SignalPlanMetricEvent";
CREATE POLICY "tenant_isolation" ON "SignalPlanMetricEvent"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

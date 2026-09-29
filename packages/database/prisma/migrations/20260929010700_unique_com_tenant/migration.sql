-- Chaves únicas compostas passam a levar tenantId na frente
-- (guard apps/app/__tests__/security/tenant-unique-keys.test.ts).
-- "Primária vigente única por iniciativa" segue valendo: (tenantId, initiativeId,
-- isCurrentPrimary) com NULL nas demais + CHECK SignalPlanMetric_primaria_vigente.

-- DropIndex
DROP INDEX "CharterCaseControl_useCaseId_code_key";
DROP INDEX "ScaffoldDeliverableInstance_trackId_code_key";
DROP INDEX "ScaffoldDeliverableLink_deliverableId_provider_externalId_key";
DROP INDEX "SignalPlanMetric_initiativeId_isCurrentPrimary_key";

-- CreateIndex
CREATE UNIQUE INDEX "CharterCaseControl_tenantId_useCaseId_code_key" ON "CharterCaseControl"("tenantId", "useCaseId", "code");
CREATE UNIQUE INDEX "ScaffoldDeliverableInstance_tenantId_trackId_code_key" ON "ScaffoldDeliverableInstance"("tenantId", "trackId", "code");
CREATE UNIQUE INDEX "ScaffoldDeliverableLink_tenantId_deliverableId_provider_ext_key" ON "ScaffoldDeliverableLink"("tenantId", "deliverableId", "provider", "externalId");
CREATE UNIQUE INDEX "SignalPlanMetric_tenantId_initiativeId_isCurrentPrimary_key" ON "SignalPlanMetric"("tenantId", "initiativeId", "isCurrentPrimary");

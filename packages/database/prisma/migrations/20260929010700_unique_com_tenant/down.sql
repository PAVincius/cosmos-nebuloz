-- Reverte 20260929010700_unique_com_tenant.
DROP INDEX "CharterCaseControl_tenantId_useCaseId_code_key";
DROP INDEX "ScaffoldDeliverableInstance_tenantId_trackId_code_key";
DROP INDEX "ScaffoldDeliverableLink_tenantId_deliverableId_provider_ext_key";
DROP INDEX "SignalPlanMetric_tenantId_initiativeId_isCurrentPrimary_key";

CREATE UNIQUE INDEX "CharterCaseControl_useCaseId_code_key" ON "CharterCaseControl"("useCaseId", "code");
CREATE UNIQUE INDEX "ScaffoldDeliverableInstance_trackId_code_key" ON "ScaffoldDeliverableInstance"("trackId", "code");
CREATE UNIQUE INDEX "ScaffoldDeliverableLink_deliverableId_provider_externalId_key" ON "ScaffoldDeliverableLink"("deliverableId", "provider", "externalId");
CREATE UNIQUE INDEX "SignalPlanMetric_initiativeId_isCurrentPrimary_key" ON "SignalPlanMetric"("initiativeId", "isCurrentPrimary");

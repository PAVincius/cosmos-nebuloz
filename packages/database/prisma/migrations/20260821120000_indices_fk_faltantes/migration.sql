-- Índices nas 18 chaves estrangeiras que não tinham nenhum.
--
-- Em PostgreSQL o Prisma NÃO cria índice em FK automaticamente — diferente do
-- MySQL. Sem o índice, apagar ou atualizar a linha pai obriga o Postgres a
-- varrer a tabela filha inteira para achar os dependentes: onDelete Cascade e
-- SetNull precisam encontrá-los para escrever, e Restrict precisa provar que
-- não existem. Numa tabela pequena não aparece; numa cheia é o delete que
-- trava a transação.
--
-- Não entra tudo que termina em `Id`: só relação de verdade, declarada com
-- @relation, e só quando nenhum índice ou unique existente já serve de prefixo
-- à esquerda. Coluna como Epic.statusId é nome de coluna de kanban, não chave
-- estrangeira, e fica de fora.
--
-- Casos que o prefixo à esquerda não cobria e por isso entram aqui:
--   CharterVendorClause.clauseId   — segundo campo de @@unique([vendorId, clauseId])
--   CharterCoverage.requirementId  — segundo campo de @@unique([tenantId, requirementId])
--   TeamMemberAssignment.sprintId  — segundo campo de @@unique([tenantId, sprintId, userId])
--   BillingEntry.themeId           — segundo campo de @@index([tenantId, themeId, usageStartDate])
--   PIObjective/Risk.piPlanId      — segundo campo de @@index([tenantId, piPlanId])

-- CreateIndex
CREATE INDEX "ApprovalRequest_workflowId_idx" ON "ApprovalRequest"("workflowId");

-- CreateIndex
CREATE INDEX "BillingEntry_themeId_idx" ON "BillingEntry"("themeId");

-- CreateIndex
CREATE INDEX "CharterAcknowledgment_policyVersionId_idx" ON "CharterAcknowledgment"("policyVersionId");

-- CreateIndex
CREATE INDEX "CharterCoverage_requirementId_idx" ON "CharterCoverage"("requirementId");

-- CreateIndex
CREATE INDEX "CharterPolicySection_groundedRequirementId_idx" ON "CharterPolicySection"("groundedRequirementId");

-- CreateIndex
CREATE INDEX "CharterRequirementSet_supersedesId_idx" ON "CharterRequirementSet"("supersedesId");

-- CreateIndex
CREATE INDEX "CharterTrack_policyId_idx" ON "CharterTrack"("policyId");

-- CreateIndex
CREATE INDEX "CharterTrack_policyVersionId_idx" ON "CharterTrack"("policyVersionId");

-- CreateIndex
CREATE INDEX "CharterVendorClause_clauseId_idx" ON "CharterVendorClause"("clauseId");

-- CreateIndex
CREATE INDEX "CustomRoleAssignment_customRoleId_idx" ON "CustomRoleAssignment"("customRoleId");

-- CreateIndex
CREATE INDEX "Engagement_serviceId_idx" ON "Engagement"("serviceId");

-- CreateIndex
CREATE INDEX "ImprovementAction_assessmentId_idx" ON "ImprovementAction"("assessmentId");

-- CreateIndex
CREATE INDEX "IpAsset_origemEngagementId_idx" ON "IpAsset"("origemEngagementId");

-- CreateIndex
CREATE INDEX "LeanBudget_themeId_idx" ON "LeanBudget"("themeId");

-- CreateIndex
CREATE INDEX "PIObjective_piPlanId_idx" ON "PIObjective"("piPlanId");

-- CreateIndex
CREATE INDEX "Risk_piPlanId_idx" ON "Risk"("piPlanId");

-- CreateIndex
CREATE INDEX "SupplierDeliverable_featureId_idx" ON "SupplierDeliverable"("featureId");

-- CreateIndex
CREATE INDEX "TeamMemberAssignment_sprintId_idx" ON "TeamMemberAssignment"("sprintId");

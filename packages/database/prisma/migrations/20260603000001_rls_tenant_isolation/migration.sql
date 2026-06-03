-- Row Level Security (RLS) — multi-tenant isolation
--
-- PREREQUISITES:
--   The Prisma app role must NOT be the table owner, OR you must enable
--   FORCE ROW LEVEL SECURITY on each table (see comment below).
--   Use packages/database/tenant-db.ts to set app.tenant_id before queries.
--
-- APPLYING: Run via `pnpm migrate` or `prisma migrate deploy` after review.

-- ─── Helper: expose current tenant ID from session local variable ─────────────

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Enable RLS and create isolation policies ─────────────────────────────────
-- Policy: row visible only when its tenantId matches the session tenant.
-- If app.tenant_id is unset (NULL), no rows match → empty result set.
-- To bypass (e.g., migration scripts, cron jobs), SET LOCAL app.tenant_id = '<id>'.

ALTER TABLE "Anomaly" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Anomaly" USING ("tenantId" = current_tenant_id());

ALTER TABLE "AnomalyDetectionRun" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AnomalyDetectionRun" USING ("tenantId" = current_tenant_id());

ALTER TABLE "ApprovalRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ApprovalRequest" USING ("tenantId" = current_tenant_id());

ALTER TABLE "ApprovalStepInstance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ApprovalStepInstance" USING ("tenantId" = current_tenant_id());

ALTER TABLE "ApprovalWorkflow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ApprovalWorkflow" USING ("tenantId" = current_tenant_id());

ALTER TABLE "ART" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ART" USING ("tenantId" = current_tenant_id());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "AuditLog" USING ("tenantId" = current_tenant_id());

ALTER TABLE "BillingEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "BillingEntry" USING ("tenantId" = current_tenant_id());

ALTER TABLE "BillingEntryAllocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "BillingEntryAllocation" USING ("tenantId" = current_tenant_id());

ALTER TABLE "BillingEntryStaging" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "BillingEntryStaging" USING ("tenantId" = current_tenant_id());

ALTER TABLE "BillingSyncCursor" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "BillingSyncCursor" USING ("tenantId" = current_tenant_id());

ALTER TABLE "BillingSyncRun" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "BillingSyncRun" USING ("tenantId" = current_tenant_id());

ALTER TABLE "BpmnDefinition" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "BpmnDefinition" USING ("tenantId" = current_tenant_id());

ALTER TABLE "BudgetPlan" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "BudgetPlan" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Capability" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Capability" USING ("tenantId" = current_tenant_id());

ALTER TABLE "CommitmentDiscount" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CommitmentDiscount" USING ("tenantId" = current_tenant_id());

ALTER TABLE "CompetencyAssessment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CompetencyAssessment" USING ("tenantId" = current_tenant_id());

ALTER TABLE "ConfidenceVoteSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ConfidenceVoteSession" USING ("tenantId" = current_tenant_id());

ALTER TABLE "CopilotMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CopilotMessage" USING ("tenantId" = current_tenant_id());

ALTER TABLE "CopilotSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CopilotSession" USING ("tenantId" = current_tenant_id());

ALTER TABLE "CostAnomaly" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CostAnomaly" USING ("tenantId" = current_tenant_id());

ALTER TABLE "CostSnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CostSnapshot" USING ("tenantId" = current_tenant_id());

ALTER TABLE "CurrencyRate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "CurrencyRate" USING ("tenantId" = current_tenant_id());

ALTER TABLE "DecisionLogEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "DecisionLogEntry" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Defect" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Defect" USING ("tenantId" = current_tenant_id());

ALTER TABLE "DependencyLink" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "DependencyLink" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Epic" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Epic" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Feature" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Feature" USING ("tenantId" = current_tenant_id());

ALTER TABLE "FlowMetricSnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "FlowMetricSnapshot" USING ("tenantId" = current_tenant_id());

ALTER TABLE "GitHubSync" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "GitHubSync" USING ("tenantId" = current_tenant_id());

ALTER TABLE "GovernedEpic" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "GovernedEpic" USING ("tenantId" = current_tenant_id());

ALTER TABLE "GroupSynergy" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "GroupSynergy" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Impediment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Impediment" USING ("tenantId" = current_tenant_id());

ALTER TABLE "ImprovementAction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ImprovementAction" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Integration" USING ("tenantId" = current_tenant_id());

ALTER TABLE "IntegrationDraft" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "IntegrationDraft" USING ("tenantId" = current_tenant_id());

ALTER TABLE "KeyResult" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "KeyResult" USING ("tenantId" = current_tenant_id());

ALTER TABLE "KeyResultSnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "KeyResultSnapshot" USING ("tenantId" = current_tenant_id());

ALTER TABLE "LACE" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "LACE" USING ("tenantId" = current_tenant_id());

ALTER TABLE "LeanBudget" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "LeanBudget" USING ("tenantId" = current_tenant_id());

ALTER TABLE "LinearSync" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "LinearSync" USING ("tenantId" = current_tenant_id());

ALTER TABLE "MemberSprintMetrics" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "MemberSprintMetrics" USING ("tenantId" = current_tenant_id());

ALTER TABLE "MemberThroughputBaseline" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "MemberThroughputBaseline" USING ("tenantId" = current_tenant_id());

ALTER TABLE "MigrationConnection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "MigrationConnection" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Notification" USING ("tenantId" = current_tenant_id());

ALTER TABLE "OKR" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "OKR" USING ("tenantId" = current_tenant_id());

ALTER TABLE "OnboardingProgress" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "OnboardingProgress" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PairSynergy" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PairSynergy" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PersonCost" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PersonCost" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PersonSkillProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PersonSkillProfile" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PIKnowledgeVector" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PIKnowledgeVector" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PIObjective" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PIObjective" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PIParticipant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PIParticipant" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PIPlan" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PIPlan" USING ("tenantId" = current_tenant_id());

ALTER TABLE "PISession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PISession" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Retrospective" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Retrospective" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Risk" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Risk" USING ("tenantId" = current_tenant_id());

ALTER TABLE "RiskOKR" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "RiskOKR" USING ("tenantId" = current_tenant_id());

ALTER TABLE "RoadmapItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "RoadmapItem" USING ("tenantId" = current_tenant_id());

ALTER TABLE "SolutionEpic" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SolutionEpic" USING ("tenantId" = current_tenant_id());

ALTER TABLE "SolutionTrain" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SolutionTrain" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Sprint" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Sprint" USING ("tenantId" = current_tenant_id());

ALTER TABLE "SprintReview" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "SprintReview" USING ("tenantId" = current_tenant_id());

ALTER TABLE "StalenessAuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StalenessAuditLog" USING ("tenantId" = current_tenant_id());

ALTER TABLE "StandupEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StandupEntry" USING ("tenantId" = current_tenant_id());

ALTER TABLE "StateTransitionHistory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StateTransitionHistory" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Story" USING ("tenantId" = current_tenant_id());

ALTER TABLE "StrategicTheme" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StrategicTheme" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Supplier" USING ("tenantId" = current_tenant_id());

ALTER TABLE "TagRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TagRule" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Task" USING ("tenantId" = current_tenant_id());

ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Team" USING ("tenantId" = current_tenant_id());

ALTER TABLE "TeamCapacitySnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TeamCapacitySnapshot" USING ("tenantId" = current_tenant_id());

ALTER TABLE "TeamMemberAssignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TeamMemberAssignment" USING ("tenantId" = current_tenant_id());

ALTER TABLE "TeamWorkflowEdge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TeamWorkflowEdge" USING ("tenantId" = current_tenant_id());

ALTER TABLE "TeamWorkflowNode" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TeamWorkflowNode" USING ("tenantId" = current_tenant_id());

ALTER TABLE "TenantInvitation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TenantInvitation" USING ("tenantId" = current_tenant_id());

ALTER TABLE "TenantMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "TenantMember" USING ("tenantId" = current_tenant_id());

ALTER TABLE "ThemeART" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ThemeART" USING ("tenantId" = current_tenant_id());

ALTER TABLE "UnmappedCostBucket" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "UnmappedCostBucket" USING ("tenantId" = current_tenant_id());

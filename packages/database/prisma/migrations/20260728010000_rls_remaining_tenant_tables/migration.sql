-- Task 5 (isolamento-tenant): make RLS real.
--
-- Investigation (see task-5-report.md) found that although 20260603000001
-- through 20260724040000 all declare RLS (106 ENABLE ROW LEVEL SECURITY, 182
-- CREATE POLICY across ~16 migration files) and _prisma_migrations shows them
-- as finished, their applied_steps_count is 0 for every one of them: the
-- ledger repair (Task 3) baselined the whole history (`prisma migrate resolve
-- --applied`) against a database that had been built with `db push`, which
-- only ever materializes schema.prisma (tables/columns) — never the raw SQL
-- inside migration.sql (functions, ENABLE/FORCE ROW LEVEL SECURITY, POLICY).
-- Verified live: com_rls=0, forced=0, policies=0 before this migration, on a
-- database `prisma migrate status` calls up to date. So this migration
-- re-issues every RLS statement the schema was always supposed to have, using
-- table names verified against live pg_tables (a few migration-declared names
-- turned out to be stale — see task-5-report.md), plus the tables that were
-- genuinely never declared anywhere (the actual Task 5 target list).
--
-- All statements are idempotent: CREATE OR REPLACE FUNCTION, DROP POLICY IF
-- EXISTS before CREATE POLICY, ENABLE/FORCE ROW LEVEL SECURITY (safe to repeat).

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Direct tenantId column ───────────────────────────────────────────────

ALTER TABLE "ART" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ART" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ART";
CREATE POLICY "tenant_isolation" ON "ART"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ARTMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ARTMembership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ARTMembership";
CREATE POLICY "tenant_isolation" ON "ARTMembership"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "AccessExceptionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessExceptionRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AccessExceptionRequest";
CREATE POLICY "tenant_isolation" ON "AccessExceptionRequest"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Anomaly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Anomaly" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Anomaly";
CREATE POLICY "tenant_isolation" ON "Anomaly"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "AnomalyDetectionRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnomalyDetectionRun" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AnomalyDetectionRun";
CREATE POLICY "tenant_isolation" ON "AnomalyDetectionRun"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "AnomalyRuleConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnomalyRuleConfig" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AnomalyRuleConfig";
CREATE POLICY "tenant_isolation" ON "AnomalyRuleConfig"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ApiKey";
CREATE POLICY "tenant_isolation" ON "ApiKey"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ApiKeyUsageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKeyUsageLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ApiKeyUsageLog";
CREATE POLICY "tenant_isolation" ON "ApiKeyUsageLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ApprovalRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ApprovalRequest";
CREATE POLICY "tenant_isolation" ON "ApprovalRequest"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ApprovalStepInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalStepInstance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ApprovalStepInstance";
CREATE POLICY "tenant_isolation" ON "ApprovalStepInstance"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ApprovalWorkflow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalWorkflow" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ApprovalWorkflow";
CREATE POLICY "tenant_isolation" ON "ApprovalWorkflow"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ArtSequenceCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtSequenceCounter" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ArtSequenceCounter";
CREATE POLICY "tenant_isolation" ON "ArtSequenceCounter"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AuditLog";
CREATE POLICY "tenant_isolation" ON "AuditLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "BillingEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "BillingEntry";
CREATE POLICY "tenant_isolation" ON "BillingEntry"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "BillingEntryAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingEntryAllocation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "BillingEntryAllocation";
CREATE POLICY "tenant_isolation" ON "BillingEntryAllocation"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "BillingEntryStaging" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingEntryStaging" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "BillingEntryStaging";
CREATE POLICY "tenant_isolation" ON "BillingEntryStaging"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "BillingSyncRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingSyncRun" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "BillingSyncRun";
CREATE POLICY "tenant_isolation" ON "BillingSyncRun"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='BoardReconciliationLog') THEN
    ALTER TABLE "BoardReconciliationLog" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "BoardReconciliationLog" FORCE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON "BoardReconciliationLog"';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON "BoardReconciliationLog" USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())';
  END IF;
END $$;

ALTER TABLE "BpmnDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BpmnDefinition" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "BpmnDefinition";
CREATE POLICY "tenant_isolation" ON "BpmnDefinition"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "BudgetPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetPlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "BudgetPlan";
CREATE POLICY "tenant_isolation" ON "BudgetPlan"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Capability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Capability" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Capability";
CREATE POLICY "tenant_isolation" ON "Capability"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CapacityAdjustmentNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CapacityAdjustmentNote" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CapacityAdjustmentNote";
CREATE POLICY "tenant_isolation" ON "CapacityAdjustmentNote"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CommitmentDiscount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommitmentDiscount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CommitmentDiscount";
CREATE POLICY "tenant_isolation" ON "CommitmentDiscount"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CompetencyAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetencyAssessment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CompetencyAssessment";
CREATE POLICY "tenant_isolation" ON "CompetencyAssessment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ConfidenceVoteSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConfidenceVoteSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ConfidenceVoteSession";
CREATE POLICY "tenant_isolation" ON "ConfidenceVoteSession"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ConfidenceVoteTally" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConfidenceVoteTally" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ConfidenceVoteTally";
CREATE POLICY "tenant_isolation" ON "ConfidenceVoteTally"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "copilot_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "copilot_messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "copilot_messages";
CREATE POLICY "tenant_isolation" ON "copilot_messages"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "copilot_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "copilot_sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "copilot_sessions";
CREATE POLICY "tenant_isolation" ON "copilot_sessions"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CostAnomaly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CostAnomaly" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CostAnomaly";
CREATE POLICY "tenant_isolation" ON "CostAnomaly"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CostSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CostSnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CostSnapshot";
CREATE POLICY "tenant_isolation" ON "CostSnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CrossArtDependency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrossArtDependency" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CrossArtDependency";
CREATE POLICY "tenant_isolation" ON "CrossArtDependency"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CustomRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomRole" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CustomRole";
CREATE POLICY "tenant_isolation" ON "CustomRole"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CustomRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomRoleAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CustomRoleAssignment";
CREATE POLICY "tenant_isolation" ON "CustomRoleAssignment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "DataSubjectRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataSubjectRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "DataSubjectRequest";
CREATE POLICY "tenant_isolation" ON "DataSubjectRequest"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "DecisionLogEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DecisionLogEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "DecisionLogEntry";
CREATE POLICY "tenant_isolation" ON "DecisionLogEntry"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Defect" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Defect" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Defect";
CREATE POLICY "tenant_isolation" ON "Defect"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "DependencyLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DependencyLink" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "DependencyLink";
CREATE POLICY "tenant_isolation" ON "DependencyLink"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Epic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Epic" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Epic";
CREATE POLICY "tenant_isolation" ON "Epic"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "EpicValueMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EpicValueMetric" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "EpicValueMetric";
CREATE POLICY "tenant_isolation" ON "EpicValueMetric"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Feature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feature" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Feature";
CREATE POLICY "tenant_isolation" ON "Feature"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "FeatureFlagOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureFlagOverride" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "FeatureFlagOverride";
CREATE POLICY "tenant_isolation" ON "FeatureFlagOverride"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "FlowMetricSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlowMetricSnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "FlowMetricSnapshot";
CREATE POLICY "tenant_isolation" ON "FlowMetricSnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "github_deployment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "github_deployment_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "github_deployment_events";
CREATE POLICY "tenant_isolation" ON "github_deployment_events"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "github_syncs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "github_syncs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "github_syncs";
CREATE POLICY "tenant_isolation" ON "github_syncs"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "github_sync_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "github_sync_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "github_sync_events";
CREATE POLICY "tenant_isolation" ON "github_sync_events"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "github_unlinked_prs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "github_unlinked_prs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "github_unlinked_prs";
CREATE POLICY "tenant_isolation" ON "github_unlinked_prs"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "GovernanceEscalation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernanceEscalation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "GovernanceEscalation";
CREATE POLICY "tenant_isolation" ON "GovernanceEscalation"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "GovernedEpic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedEpic" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "GovernedEpic";
CREATE POLICY "tenant_isolation" ON "GovernedEpic"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "GroupSynergy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupSynergy" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "GroupSynergy";
CREATE POLICY "tenant_isolation" ON "GroupSynergy"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Impediment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Impediment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Impediment";
CREATE POLICY "tenant_isolation" ON "Impediment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ImprovementAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImprovementAction" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ImprovementAction";
CREATE POLICY "tenant_isolation" ON "ImprovementAction"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Integration";
CREATE POLICY "tenant_isolation" ON "Integration"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "IntegrationDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationDraft" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "IntegrationDraft";
CREATE POLICY "tenant_isolation" ON "IntegrationDraft"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "InvestmentHorizon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvestmentHorizon" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "InvestmentHorizon";
CREATE POLICY "tenant_isolation" ON "InvestmentHorizon"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- JobFallbackQueue.tenantId is nullable; NULL rows are invisible under every tenant session.
ALTER TABLE "JobFallbackQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobFallbackQueue" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "JobFallbackQueue";
CREATE POLICY "tenant_isolation" ON "JobFallbackQueue"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "KeyResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeyResult" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "KeyResult";
CREATE POLICY "tenant_isolation" ON "KeyResult"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "KeyResultSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeyResultSnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "KeyResultSnapshot";
CREATE POLICY "tenant_isolation" ON "KeyResultSnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "LACE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LACE" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LACE";
CREATE POLICY "tenant_isolation" ON "LACE"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "LACEMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LACEMember" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LACEMember";
CREATE POLICY "tenant_isolation" ON "LACEMember"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "LeanBudget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeanBudget" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeanBudget";
CREATE POLICY "tenant_isolation" ON "LeanBudget"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "LeanBudgetReallocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeanBudgetReallocation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeanBudgetReallocation";
CREATE POLICY "tenant_isolation" ON "LeanBudgetReallocation"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "linear_syncs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "linear_syncs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "linear_syncs";
CREATE POLICY "tenant_isolation" ON "linear_syncs"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "linear_sync_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "linear_sync_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "linear_sync_events";
CREATE POLICY "tenant_isolation" ON "linear_sync_events"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "MeetingInsight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingInsight" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "MeetingInsight";
CREATE POLICY "tenant_isolation" ON "MeetingInsight"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "MeetingIntegration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingIntegration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "MeetingIntegration";
CREATE POLICY "tenant_isolation" ON "MeetingIntegration"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "MeetingTranscript" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingTranscript" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "MeetingTranscript";
CREATE POLICY "tenant_isolation" ON "MeetingTranscript"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "MemberSprintMetrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberSprintMetrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "MemberSprintMetrics";
CREATE POLICY "tenant_isolation" ON "MemberSprintMetrics"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "MemberThroughputBaseline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberThroughputBaseline" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "MemberThroughputBaseline";
CREATE POLICY "tenant_isolation" ON "MemberThroughputBaseline"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "MigrationConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MigrationConnection" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "MigrationConnection";
CREATE POLICY "tenant_isolation" ON "MigrationConnection"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Notification";
CREATE POLICY "tenant_isolation" ON "Notification"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "NotificationPreference";
CREATE POLICY "tenant_isolation" ON "NotificationPreference"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "OKR" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OKR" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "OKR";
CREATE POLICY "tenant_isolation" ON "OKR"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "OnboardingProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingProgress" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "OnboardingProgress";
CREATE POLICY "tenant_isolation" ON "OnboardingProgress"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PIKnowledgeVector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PIKnowledgeVector" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PIKnowledgeVector";
CREATE POLICY "tenant_isolation" ON "PIKnowledgeVector"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PIObjective" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PIObjective" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PIObjective";
CREATE POLICY "tenant_isolation" ON "PIObjective"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PIParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PIParticipant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PIParticipant";
CREATE POLICY "tenant_isolation" ON "PIParticipant"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PIPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PIPlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PIPlan";
CREATE POLICY "tenant_isolation" ON "PIPlan"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='PIPlanFeatureAssignment') THEN
    ALTER TABLE "PIPlanFeatureAssignment" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "PIPlanFeatureAssignment" FORCE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON "PIPlanFeatureAssignment"';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON "PIPlanFeatureAssignment" USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())';
  END IF;
END $$;

ALTER TABLE "PISession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PISession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PISession";
CREATE POLICY "tenant_isolation" ON "PISession"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PairSynergy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PairSynergy" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PairSynergy";
CREATE POLICY "tenant_isolation" ON "PairSynergy"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PersonCost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonCost" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PersonCost";
CREATE POLICY "tenant_isolation" ON "PersonCost"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PersonSkillProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonSkillProfile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PersonSkillProfile";
CREATE POLICY "tenant_isolation" ON "PersonSkillProfile"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "PortfolioAnalysisReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioAnalysisReport" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PortfolioAnalysisReport";
CREATE POLICY "tenant_isolation" ON "PortfolioAnalysisReport"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "RetroActionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetroActionItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "RetroActionItem";
CREATE POLICY "tenant_isolation" ON "RetroActionItem"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "RetroItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetroItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "RetroItem";
CREATE POLICY "tenant_isolation" ON "RetroItem"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Retrospective" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Retrospective" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Retrospective";
CREATE POLICY "tenant_isolation" ON "Retrospective"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Risk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Risk" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Risk";
CREATE POLICY "tenant_isolation" ON "Risk"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "RoadmapItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoadmapItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "RoadmapItem";
CREATE POLICY "tenant_isolation" ON "RoadmapItem"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ScheduledReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledReport" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ScheduledReport";
CREATE POLICY "tenant_isolation" ON "ScheduledReport"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ScheduledReportExecution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledReportExecution" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ScheduledReportExecution";
CREATE POLICY "tenant_isolation" ON "ScheduledReportExecution"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "ScoringEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScoringEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ScoringEvent";
CREATE POLICY "tenant_isolation" ON "ScoringEvent"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "SolutionEpic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SolutionEpic" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SolutionEpic";
CREATE POLICY "tenant_isolation" ON "SolutionEpic"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "SolutionRisk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SolutionRisk" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SolutionRisk";
CREATE POLICY "tenant_isolation" ON "SolutionRisk"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "SolutionTrain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SolutionTrain" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SolutionTrain";
CREATE POLICY "tenant_isolation" ON "SolutionTrain"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Sprint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sprint" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Sprint";
CREATE POLICY "tenant_isolation" ON "Sprint"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "SprintReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SprintReview" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SprintReview";
CREATE POLICY "tenant_isolation" ON "SprintReview"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "StalenessAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StalenessAuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StalenessAuditLog";
CREATE POLICY "tenant_isolation" ON "StalenessAuditLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "StandupEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StandupEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StandupEntry";
CREATE POLICY "tenant_isolation" ON "StandupEntry"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "StateTransitionHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StateTransitionHistory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StateTransitionHistory";
CREATE POLICY "tenant_isolation" ON "StateTransitionHistory"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Story" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Story";
CREATE POLICY "tenant_isolation" ON "Story"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "StrategicTheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StrategicTheme" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StrategicTheme";
CREATE POLICY "tenant_isolation" ON "StrategicTheme"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='StrategyPillar') THEN
    ALTER TABLE "StrategyPillar" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "StrategyPillar" FORCE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON "StrategyPillar"';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON "StrategyPillar" USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())';
  END IF;
END $$;

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Supplier";
CREATE POLICY "tenant_isolation" ON "Supplier"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "SupplierDeliverable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierDeliverable" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SupplierDeliverable";
CREATE POLICY "tenant_isolation" ON "SupplierDeliverable"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "TagRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TagRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TagRule";
CREATE POLICY "tenant_isolation" ON "TagRule"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Task";
CREATE POLICY "tenant_isolation" ON "Task"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Team";
CREATE POLICY "tenant_isolation" ON "Team"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "TeamCapacitySnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamCapacitySnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TeamCapacitySnapshot";
CREATE POLICY "tenant_isolation" ON "TeamCapacitySnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "TeamMemberAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMemberAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TeamMemberAssignment";
CREATE POLICY "tenant_isolation" ON "TeamMemberAssignment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "TeamWorkflowEdge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamWorkflowEdge" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TeamWorkflowEdge";
CREATE POLICY "tenant_isolation" ON "TeamWorkflowEdge"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "TeamWorkflowNode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamWorkflowNode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TeamWorkflowNode";
CREATE POLICY "tenant_isolation" ON "TeamWorkflowNode"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "TenantInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantInvitation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TenantInvitation";
CREATE POLICY "tenant_isolation" ON "TenantInvitation"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "TenantMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantMember" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TenantMember";
CREATE POLICY "tenant_isolation" ON "TenantMember"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='TenantSSOConfig') THEN
    ALTER TABLE "TenantSSOConfig" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "TenantSSOConfig" FORCE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON "TenantSSOConfig"';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON "TenantSSOConfig" USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='TenantSecurityPolicy') THEN
    ALTER TABLE "TenantSecurityPolicy" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "TenantSecurityPolicy" FORCE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON "TenantSecurityPolicy"';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON "TenantSecurityPolicy" USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())';
  END IF;
END $$;

ALTER TABLE "UnmappedCostBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UnmappedCostBucket" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "UnmappedCostBucket";
CREATE POLICY "tenant_isolation" ON "UnmappedCostBucket"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "UserDashboardLayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserDashboardLayout" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "UserDashboardLayout";
CREATE POLICY "tenant_isolation" ON "UserDashboardLayout"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "WebhookDeliveryLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDeliveryLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "WebhookDeliveryLog";
CREATE POLICY "tenant_isolation" ON "WebhookDeliveryLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "webhook_dlq" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_dlq" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "webhook_dlq";
CREATE POLICY "tenant_isolation" ON "webhook_dlq"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEndpoint" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "WebhookEndpoint";
CREATE POLICY "tenant_isolation" ON "WebhookEndpoint"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "WsjfSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WsjfSettings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "WsjfSettings";
CREATE POLICY "tenant_isolation" ON "WsjfSettings"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- ─── Global lookup table — RLS enabled but permissive (no tenant data) ─────

ALTER TABLE "CurrencyRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CurrencyRate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON "CurrencyRate";
CREATE POLICY "allow_all" ON "CurrencyRate"
  USING (true)
  WITH CHECK (true);

-- ─── Indirect tenancy — no tenantId column, reached via a parent FK ────────

-- BillingSyncCursor: no tenantId column — route isolation through Integration
ALTER TABLE "BillingSyncCursor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingSyncCursor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "BillingSyncCursor";
CREATE POLICY "tenant_isolation" ON "BillingSyncCursor"
  USING (
    EXISTS (
      SELECT 1 FROM "Integration" p
      WHERE p."id" = "BillingSyncCursor"."integrationId"
        AND p."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Integration" p
      WHERE p."id" = "BillingSyncCursor"."integrationId"
        AND p."tenantId" = current_tenant_id()
    )
  );

-- RiskOKR: junction table — route isolation through Risk
ALTER TABLE "RiskOKR" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RiskOKR" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "RiskOKR";
CREATE POLICY "tenant_isolation" ON "RiskOKR"
  USING (
    EXISTS (
      SELECT 1 FROM "Risk" p
      WHERE p."id" = "RiskOKR"."riskId"
        AND p."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Risk" p
      WHERE p."id" = "RiskOKR"."riskId"
        AND p."tenantId" = current_tenant_id()
    )
  );

-- ThemeART: junction table — route isolation through StrategicTheme
ALTER TABLE "ThemeART" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ThemeART" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ThemeART";
CREATE POLICY "tenant_isolation" ON "ThemeART"
  USING (
    EXISTS (
      SELECT 1 FROM "StrategicTheme" p
      WHERE p."id" = "ThemeART"."themeId"
        AND p."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StrategicTheme" p
      WHERE p."id" = "ThemeART"."themeId"
        AND p."tenantId" = current_tenant_id()
    )
  );

-- TaskAssignee: join table — route isolation through Task
ALTER TABLE "TaskAssignee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskAssignee" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "TaskAssignee";
CREATE POLICY "tenant_isolation" ON "TaskAssignee"
  USING (
    EXISTS (
      SELECT 1 FROM "Task" p
      WHERE p."id" = "TaskAssignee"."taskId"
        AND p."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Task" p
      WHERE p."id" = "TaskAssignee"."taskId"
        AND p."tenantId" = current_tenant_id()
    )
  );

-- RetroVote: join table — route isolation through RetroItem
ALTER TABLE "RetroVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetroVote" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "RetroVote";
CREATE POLICY "tenant_isolation" ON "RetroVote"
  USING (
    EXISTS (
      SELECT 1 FROM "RetroItem" p
      WHERE p."id" = "RetroVote"."itemId"
        AND p."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "RetroItem" p
      WHERE p."id" = "RetroVote"."itemId"
        AND p."tenantId" = current_tenant_id()
    )
  );

-- SyncLog: child table — route isolation through Integration
ALTER TABLE "SyncLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "SyncLog";
CREATE POLICY "tenant_isolation" ON "SyncLog"
  USING (
    EXISTS (
      SELECT 1 FROM "Integration" p
      WHERE p."id" = "SyncLog"."integrationId"
        AND p."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Integration" p
      WHERE p."id" = "SyncLog"."integrationId"
        AND p."tenantId" = current_tenant_id()
    )
  );

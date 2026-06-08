-- Migration: 20260608000001_fix_rls_force_rls
-- Purpose:
--   1. Add FORCE ROW LEVEL SECURITY to all 80 RLS-enabled tables so that
--      table owner connections (e.g. migration user, pgBouncer) are also
--      subject to the tenant isolation policies.
--   2. Fix 4 broken policies that reference non-existent "tenantId" columns.
--   3. Add WITH CHECK to all tenant_isolation policies (USING-only policies
--      do not protect INSERT in some edge cases; explicit WITH CHECK is
--      defence-in-depth).

-- ─── 1. FORCE ROW LEVEL SECURITY ────────────────────────────────────────────

ALTER TABLE "Anomaly"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "AnomalyDetectionRun"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalRequest"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalStepInstance"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalWorkflow"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "ART"                       FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"                  FORCE ROW LEVEL SECURITY;
ALTER TABLE "BillingEntry"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "BillingEntryAllocation"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "BillingEntryStaging"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "BillingSyncCursor"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "BillingSyncRun"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "BpmnDefinition"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "BudgetPlan"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "Capability"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "CommitmentDiscount"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "CompetencyAssessment"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "ConfidenceVoteSession"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "CopilotMessage"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "CopilotSession"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "CostAnomaly"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "CostSnapshot"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "CurrencyRate"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "DecisionLogEntry"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "Defect"                    FORCE ROW LEVEL SECURITY;
ALTER TABLE "DependencyLink"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "Epic"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "Feature"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "FlowMetricSnapshot"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "GitHubSync"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "GovernedEpic"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "GroupSynergy"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "Impediment"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "ImprovementAction"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "Integration"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationDraft"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "KeyResult"                 FORCE ROW LEVEL SECURITY;
ALTER TABLE "KeyResultSnapshot"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "LACE"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "LeanBudget"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "LinearSync"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "MemberSprintMetrics"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "MemberThroughputBaseline"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "MigrationConnection"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "Notification"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "OKR"                       FORCE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingProgress"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "PairSynergy"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "PersonCost"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "PersonSkillProfile"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "PIKnowledgeVector"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "PIObjective"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "PIParticipant"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "PIPlan"                    FORCE ROW LEVEL SECURITY;
ALTER TABLE "PISession"                 FORCE ROW LEVEL SECURITY;
ALTER TABLE "Retrospective"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "Risk"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "RiskOKR"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "RoadmapItem"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "SolutionEpic"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "SolutionTrain"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "Sprint"                    FORCE ROW LEVEL SECURITY;
ALTER TABLE "SprintReview"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "StalenessAuditLog"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "StandupEntry"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "StateTransitionHistory"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "Story"                     FORCE ROW LEVEL SECURITY;
ALTER TABLE "StrategicTheme"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "Supplier"                  FORCE ROW LEVEL SECURITY;
ALTER TABLE "TagRule"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "Task"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "Team"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "TeamCapacitySnapshot"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "TeamMemberAssignment"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "TeamWorkflowEdge"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "TeamWorkflowNode"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "TenantInvitation"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "TenantMember"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "ThemeART"                  FORCE ROW LEVEL SECURITY;
ALTER TABLE "UnmappedCostBucket"        FORCE ROW LEVEL SECURITY;

-- ─── 2. Fix broken policies ──────────────────────────────────────────────────

-- BillingSyncCursor: no tenantId column — route isolation through Integration
DROP POLICY IF EXISTS "tenant_isolation" ON "BillingSyncCursor";
CREATE POLICY "tenant_isolation" ON "BillingSyncCursor"
  USING (
    EXISTS (
      SELECT 1 FROM "Integration" i
      WHERE i."id" = "BillingSyncCursor"."integrationId"
        AND i."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Integration" i
      WHERE i."id" = "BillingSyncCursor"."integrationId"
        AND i."tenantId" = current_tenant_id()
    )
  );

-- CurrencyRate: global/shared lookup table — no per-tenant data, allow all
DROP POLICY IF EXISTS "tenant_isolation" ON "CurrencyRate";
CREATE POLICY "allow_all" ON "CurrencyRate"
  USING (true)
  WITH CHECK (true);

-- RiskOKR: junction table — route isolation through Risk
DROP POLICY IF EXISTS "tenant_isolation" ON "RiskOKR";
CREATE POLICY "tenant_isolation" ON "RiskOKR"
  USING (
    EXISTS (
      SELECT 1 FROM "Risk" r
      WHERE r."id" = "RiskOKR"."riskId"
        AND r."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Risk" r
      WHERE r."id" = "RiskOKR"."riskId"
        AND r."tenantId" = current_tenant_id()
    )
  );

-- ThemeART: junction table — route isolation through StrategicTheme
DROP POLICY IF EXISTS "tenant_isolation" ON "ThemeART";
CREATE POLICY "tenant_isolation" ON "ThemeART"
  USING (
    EXISTS (
      SELECT 1 FROM "StrategicTheme" st
      WHERE st."id" = "ThemeART"."themeId"
        AND st."tenantId" = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StrategicTheme" st
      WHERE st."id" = "ThemeART"."themeId"
        AND st."tenantId" = current_tenant_id()
    )
  );

-- ─── 3. Add WITH CHECK to all working tenant_isolation policies ──────────────

DROP POLICY IF EXISTS "tenant_isolation" ON "Anomaly";
CREATE POLICY "tenant_isolation" ON "Anomaly"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "AnomalyDetectionRun";
CREATE POLICY "tenant_isolation" ON "AnomalyDetectionRun"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "ApprovalRequest";
CREATE POLICY "tenant_isolation" ON "ApprovalRequest"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "ApprovalStepInstance";
CREATE POLICY "tenant_isolation" ON "ApprovalStepInstance"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "ApprovalWorkflow";
CREATE POLICY "tenant_isolation" ON "ApprovalWorkflow"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "ART";
CREATE POLICY "tenant_isolation" ON "ART"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "AuditLog";
CREATE POLICY "tenant_isolation" ON "AuditLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "BillingEntry";
CREATE POLICY "tenant_isolation" ON "BillingEntry"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "BillingEntryAllocation";
CREATE POLICY "tenant_isolation" ON "BillingEntryAllocation"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "BillingEntryStaging";
CREATE POLICY "tenant_isolation" ON "BillingEntryStaging"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "BillingSyncRun";
CREATE POLICY "tenant_isolation" ON "BillingSyncRun"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "BpmnDefinition";
CREATE POLICY "tenant_isolation" ON "BpmnDefinition"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "BudgetPlan";
CREATE POLICY "tenant_isolation" ON "BudgetPlan"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Capability";
CREATE POLICY "tenant_isolation" ON "Capability"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "CommitmentDiscount";
CREATE POLICY "tenant_isolation" ON "CommitmentDiscount"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "CompetencyAssessment";
CREATE POLICY "tenant_isolation" ON "CompetencyAssessment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "ConfidenceVoteSession";
CREATE POLICY "tenant_isolation" ON "ConfidenceVoteSession"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "CopilotMessage";
CREATE POLICY "tenant_isolation" ON "CopilotMessage"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "CopilotSession";
CREATE POLICY "tenant_isolation" ON "CopilotSession"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "CostAnomaly";
CREATE POLICY "tenant_isolation" ON "CostAnomaly"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "CostSnapshot";
CREATE POLICY "tenant_isolation" ON "CostSnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "DecisionLogEntry";
CREATE POLICY "tenant_isolation" ON "DecisionLogEntry"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Defect";
CREATE POLICY "tenant_isolation" ON "Defect"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "DependencyLink";
CREATE POLICY "tenant_isolation" ON "DependencyLink"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Epic";
CREATE POLICY "tenant_isolation" ON "Epic"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Feature";
CREATE POLICY "tenant_isolation" ON "Feature"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "FlowMetricSnapshot";
CREATE POLICY "tenant_isolation" ON "FlowMetricSnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "GitHubSync";
CREATE POLICY "tenant_isolation" ON "GitHubSync"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "GovernedEpic";
CREATE POLICY "tenant_isolation" ON "GovernedEpic"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "GroupSynergy";
CREATE POLICY "tenant_isolation" ON "GroupSynergy"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Impediment";
CREATE POLICY "tenant_isolation" ON "Impediment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "ImprovementAction";
CREATE POLICY "tenant_isolation" ON "ImprovementAction"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Integration";
CREATE POLICY "tenant_isolation" ON "Integration"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "IntegrationDraft";
CREATE POLICY "tenant_isolation" ON "IntegrationDraft"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "KeyResult";
CREATE POLICY "tenant_isolation" ON "KeyResult"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "KeyResultSnapshot";
CREATE POLICY "tenant_isolation" ON "KeyResultSnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "LACE";
CREATE POLICY "tenant_isolation" ON "LACE"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "LeanBudget";
CREATE POLICY "tenant_isolation" ON "LeanBudget"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "LinearSync";
CREATE POLICY "tenant_isolation" ON "LinearSync"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "MemberSprintMetrics";
CREATE POLICY "tenant_isolation" ON "MemberSprintMetrics"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "MemberThroughputBaseline";
CREATE POLICY "tenant_isolation" ON "MemberThroughputBaseline"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "MigrationConnection";
CREATE POLICY "tenant_isolation" ON "MigrationConnection"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Notification";
CREATE POLICY "tenant_isolation" ON "Notification"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "OKR";
CREATE POLICY "tenant_isolation" ON "OKR"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "OnboardingProgress";
CREATE POLICY "tenant_isolation" ON "OnboardingProgress"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PairSynergy";
CREATE POLICY "tenant_isolation" ON "PairSynergy"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PersonCost";
CREATE POLICY "tenant_isolation" ON "PersonCost"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PersonSkillProfile";
CREATE POLICY "tenant_isolation" ON "PersonSkillProfile"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PIKnowledgeVector";
CREATE POLICY "tenant_isolation" ON "PIKnowledgeVector"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PIObjective";
CREATE POLICY "tenant_isolation" ON "PIObjective"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PIParticipant";
CREATE POLICY "tenant_isolation" ON "PIParticipant"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PIPlan";
CREATE POLICY "tenant_isolation" ON "PIPlan"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "PISession";
CREATE POLICY "tenant_isolation" ON "PISession"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Retrospective";
CREATE POLICY "tenant_isolation" ON "Retrospective"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Risk";
CREATE POLICY "tenant_isolation" ON "Risk"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "RoadmapItem";
CREATE POLICY "tenant_isolation" ON "RoadmapItem"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "SolutionEpic";
CREATE POLICY "tenant_isolation" ON "SolutionEpic"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "SolutionTrain";
CREATE POLICY "tenant_isolation" ON "SolutionTrain"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Sprint";
CREATE POLICY "tenant_isolation" ON "Sprint"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "SprintReview";
CREATE POLICY "tenant_isolation" ON "SprintReview"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "StalenessAuditLog";
CREATE POLICY "tenant_isolation" ON "StalenessAuditLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "StandupEntry";
CREATE POLICY "tenant_isolation" ON "StandupEntry"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "StateTransitionHistory";
CREATE POLICY "tenant_isolation" ON "StateTransitionHistory"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Story";
CREATE POLICY "tenant_isolation" ON "Story"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "StrategicTheme";
CREATE POLICY "tenant_isolation" ON "StrategicTheme"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Supplier";
CREATE POLICY "tenant_isolation" ON "Supplier"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "TagRule";
CREATE POLICY "tenant_isolation" ON "TagRule"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Task";
CREATE POLICY "tenant_isolation" ON "Task"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "Team";
CREATE POLICY "tenant_isolation" ON "Team"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "TeamCapacitySnapshot";
CREATE POLICY "tenant_isolation" ON "TeamCapacitySnapshot"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "TeamMemberAssignment";
CREATE POLICY "tenant_isolation" ON "TeamMemberAssignment"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "TeamWorkflowEdge";
CREATE POLICY "tenant_isolation" ON "TeamWorkflowEdge"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "TeamWorkflowNode";
CREATE POLICY "tenant_isolation" ON "TeamWorkflowNode"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "TenantInvitation";
CREATE POLICY "tenant_isolation" ON "TenantInvitation"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "TenantMember";
CREATE POLICY "tenant_isolation" ON "TenantMember"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON "UnmappedCostBucket";
CREATE POLICY "tenant_isolation" ON "UnmappedCostBucket"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

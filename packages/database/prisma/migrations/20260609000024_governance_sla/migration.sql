-- Story-040: Enterprise Governance — SLA tracking and GovernanceEscalation

-- ── Extend ApprovalStepInstance ───────────────────────────────────────────────

ALTER TABLE "ApprovalStepInstance"
  ADD COLUMN IF NOT EXISTS "backupApproverId" TEXT,
  ADD COLUMN IF NOT EXISTS "slaDeadline"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaStatus"        TEXT NOT NULL DEFAULT 'ON_TRACK',
  ADD COLUMN IF NOT EXISTS "isParallel"       BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ApprovalStepInstance_slaDeadline_idx"
  ON "ApprovalStepInstance"("slaDeadline");

-- ── GovernanceEscalation ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GovernanceEscalation" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"          TEXT NOT NULL,
  "approvalStepId"    TEXT NOT NULL,
  "epicId"            TEXT,
  "escalatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "backupNotified"    BOOLEAN NOT NULL DEFAULT false,
  "backupNotifiedAt"  TIMESTAMP(3),
  CONSTRAINT "GovernanceEscalation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GovernanceEscalation"
  ADD CONSTRAINT "GovernanceEscalation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GovernanceEscalation"
  ADD CONSTRAINT "GovernanceEscalation_approvalStepId_fkey"
    FOREIGN KEY ("approvalStepId") REFERENCES "ApprovalStepInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "GovernanceEscalation_tenantId_idx"       ON "GovernanceEscalation"("tenantId");
CREATE INDEX IF NOT EXISTS "GovernanceEscalation_approvalStepId_idx" ON "GovernanceEscalation"("approvalStepId");

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE "GovernanceEscalation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernanceEscalation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "GovernanceEscalation"
  USING ("tenantId" = current_tenant_id());

-- Charter: plano de controles por caso (CH-DEV-03) e histórico append-only.
-- Depende de 20260929010200_charter_control_profiles e 20260929010100_signal_plan_metric.

-- CreateEnum
CREATE TYPE "CharterCaseControlState" AS ENUM ('NO_EVIDENCE', 'IN_PROGRESS', 'IN_REVIEW', 'ADJUSTMENT_REQUESTED', 'ACCEPTED', 'EXPIRED', 'DISPENSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "CharterCaseControlAction" AS ENUM ('START', 'ATTACH', 'SUBMIT', 'ACCEPT', 'REQUEST_ADJUSTMENT', 'DISPENSE', 'REOPEN', 'EXPIRE', 'EDIT');

-- CreateTable
CREATE TABLE "CharterCaseControl" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "profileControlCode" TEXT,
    "name" TEXT NOT NULL,
    "category" "CharterRiskCategory" NOT NULL,
    "evidence" TEXT NOT NULL,
    "acceptanceCriteria" TEXT,
    "role" "CharterRole" NOT NULL,
    "cadence" "CharterControlCadence" NOT NULL,
    "minClass" "CharterDataClass" NOT NULL,
    "dispensable" BOOLEAN NOT NULL DEFAULT true,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "state" "CharterCaseControlState" NOT NULL DEFAULT 'NO_EVIDENCE',
    "ownerId" TEXT,
    "ownerName" TEXT,
    "summary" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "evidenceProducedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "mitigationId" TEXT,
    "dispensedUntil" TIMESTAMP(3),
    "dispensedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterCaseControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterCaseControlEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseControlId" TEXT NOT NULL,
    "action" "CharterCaseControlAction" NOT NULL,
    "actorId" TEXT,
    "fromState" "CharterCaseControlState",
    "toState" "CharterCaseControlState",
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharterCaseControlEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharterCaseControl_tenantId_idx" ON "CharterCaseControl"("tenantId");

-- CreateIndex
CREATE INDEX "CharterCaseControl_tenantId_state_idx" ON "CharterCaseControl"("tenantId", "state");

-- CreateIndex
CREATE INDEX "CharterCaseControl_useCaseId_state_idx" ON "CharterCaseControl"("useCaseId", "state");

-- CreateIndex
CREATE INDEX "CharterCaseControl_mitigationId_idx" ON "CharterCaseControl"("mitigationId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterCaseControl_useCaseId_code_key" ON "CharterCaseControl"("useCaseId", "code");

-- CreateIndex
CREATE INDEX "CharterCaseControlEvent_tenantId_idx" ON "CharterCaseControlEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CharterCaseControlEvent_caseControlId_createdAt_idx" ON "CharterCaseControlEvent"("caseControlId", "createdAt");

-- AddForeignKey
ALTER TABLE "CharterCaseControl" ADD CONSTRAINT "CharterCaseControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterCaseControl" ADD CONSTRAINT "CharterCaseControl_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "CharterUseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterCaseControl" ADD CONSTRAINT "CharterCaseControl_mitigationId_fkey" FOREIGN KEY ("mitigationId") REFERENCES "CharterMitigation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterCaseControlEvent" ADD CONSTRAINT "CharterCaseControlEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterCaseControlEvent" ADD CONSTRAINT "CharterCaseControlEvent_caseControlId_fkey" FOREIGN KEY ("caseControlId") REFERENCES "CharterCaseControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes do controle do caso que o banco garante (o resto é regra de
-- action, `case.submit` / `case.decide`):
--  • Dispensa exige motivo e prazo de revisão, e só vale para controle
--    dispensável (CH-PO-04).
ALTER TABLE "CharterCaseControl" ADD CONSTRAINT "CharterCaseControl_dispensa_valida"
  CHECK ("state" <> 'DISPENSED' OR ("dispensable" AND "dispensedUntil" IS NOT NULL AND "dispensedReason" IS NOT NULL));

--  • Enviar exige arquivo (CH-DEV-05): Em revisão, Aceita e Vencida têm evidência.
ALTER TABLE "CharterCaseControl" ADD CONSTRAINT "CharterCaseControl_revisao_exige_arquivo"
  CHECK ("state" NOT IN ('IN_REVIEW', 'ACCEPTED', 'EXPIRED') OR "fileKey" IS NOT NULL);

-- Histórico append-only no banco, como o AuditLog: UPDATE sempre recusado, DELETE
-- direto também; DELETE em cascata do pai passa (pg_trigger_depth() > 1).
-- Usa a função genérica criada em 20260929010100_signal_plan_metric.
CREATE TRIGGER charter_case_control_event_immutable
  BEFORE UPDATE OR DELETE ON "CharterCaseControlEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

-- RLS por tenant (padrão de 20260902150000/190000). ADR-0012: inerte enquanto a
-- aplicação conectar como superuser.
ALTER TABLE "CharterCaseControl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterCaseControl" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CharterCaseControl";
CREATE POLICY "tenant_isolation" ON "CharterCaseControl"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "CharterCaseControlEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterCaseControlEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CharterCaseControlEvent";
CREATE POLICY "tenant_isolation" ON "CharterCaseControlEvent"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

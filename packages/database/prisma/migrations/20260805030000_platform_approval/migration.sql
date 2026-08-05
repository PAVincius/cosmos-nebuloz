-- PlatformApproval — aprovação de operação de plataforma do Big Bang.
--
-- Não substitui "ApprovalRequest": aquele é governança do cliente sobre o
-- domínio dele (épico, guardrail, tema), com workflow, etapas e SLA. Este é
-- staff da Nebuloz aprovando operação sobre um tenant. Convivem por terem
-- semânticas opostas — ver o comentário do model em governance.prisma.
--
-- IF NOT EXISTS em tudo: este banco já recebeu migration parcial antes, e uma
-- reexecução não pode falhar por objeto que já está lá.

CREATE TABLE IF NOT EXISTS "PlatformApproval" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "acao"            TEXT NOT NULL,
    "alvoTipo"        TEXT NOT NULL,
    "alvoId"          TEXT NOT NULL,
    "alvoLabel"       TEXT NOT NULL,
    "motivo"          TEXT NOT NULL,
    "impacto"         TEXT NOT NULL,
    "payload"         JSONB NOT NULL DEFAULT '{}',
    "status"          TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "solicitanteId"   TEXT NOT NULL,
    "solicitanteNome" TEXT,
    "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisorId"       TEXT,
    "decisorNome"     TEXT,
    "decididoEm"      TIMESTAMP(3),
    "nota"            TEXT,
    "targetTenantId"  TEXT,

    CONSTRAINT "PlatformApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformApproval_tenantId_idx"          ON "PlatformApproval"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformApproval_tenantId_status_idx"   ON "PlatformApproval"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PlatformApproval_targetTenantId_idx"    ON "PlatformApproval"("targetTenantId");
CREATE INDEX IF NOT EXISTS "PlatformApproval_criadoEm_idx"          ON "PlatformApproval"("criadoEm");

DO $$
BEGIN
  ALTER TABLE "PlatformApproval"
    ADD CONSTRAINT "PlatformApproval_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

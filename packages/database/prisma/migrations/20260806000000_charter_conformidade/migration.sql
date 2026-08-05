-- Conformidade do Charter. IF NOT EXISTS em tudo: este banco já recebeu
-- migration parcial, e reexecução não pode falhar por objeto que já existe.

DO $$ BEGIN
  CREATE TYPE "CharterPolicyLinkAlvo" AS ENUM ('USE_CASE', 'VENDOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CharterPolicyLink" (
  "id"       TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "alvoTipo" "CharterPolicyLinkAlvo" NOT NULL,
  "alvoId"   TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharterPolicyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CharterPolicyLink_policyId_alvoTipo_alvoId_key"
  ON "CharterPolicyLink"("policyId", "alvoTipo", "alvoId");
CREATE INDEX IF NOT EXISTS "CharterPolicyLink_tenantId_idx"
  ON "CharterPolicyLink"("tenantId");
CREATE INDEX IF NOT EXISTS "CharterPolicyLink_tenantId_alvo_idx"
  ON "CharterPolicyLink"("tenantId", "alvoTipo", "alvoId");

DO $$ BEGIN
  ALTER TABLE "CharterPolicyLink" ADD CONSTRAINT "CharterPolicyLink_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CharterPolicyLink" ADD CONSTRAINT "CharterPolicyLink_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "CharterPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: mesmo padrão de 20260728010000_rls_remaining_tenant_tables e do bloco
-- final de 20260728120000_charter_module — current_tenant_id() lê
-- app.tenant_id (setado por withTenantDb()), não current_setting(...) inline,
-- e FORCE é obrigatório: sem ele, o dono da tabela contorna a policy.
ALTER TABLE "CharterPolicyLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterPolicyLink" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CharterPolicyLink";
CREATE POLICY "tenant_isolation" ON "CharterPolicyLink"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

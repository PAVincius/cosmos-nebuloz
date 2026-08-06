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

-- Default 1, e não 0: linha existente tem de manter a severidade que já tinha.
-- Com 0, impacto × probabilidade zeraria todo risco histórico de uma vez.
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probPrivacy"      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probRegulatory"   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probSecurity"     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probBias"         INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probIp"           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probOperational"  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probReputational" INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN CREATE TYPE "CharterReqOrigem"      AS ENUM ('RFP','REGULACAO');            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CharterReqEditor"      AS ENUM ('TENANT','NEBULOZ');           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CharterReqLicenca"     AS ENUM ('LIVRE','REFERENCIA');         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CharterCoverageStatus" AS ENUM ('ATENDE','PARCIAL','NAO_ATENDE','SEM_VEREDITO','REVISAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CharterRequirementSet" (
  "id" TEXT NOT NULL, "tenantId" TEXT, "nome" TEXT NOT NULL,
  "origem" "CharterReqOrigem" NOT NULL, "editor" "CharterReqEditor" NOT NULL,
  "jurisdicao" TEXT, "versao" TEXT NOT NULL DEFAULT '1', "supersedesId" TEXT,
  "licenca" "CharterReqLicenca" NOT NULL DEFAULT 'LIVRE',
  "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notas" TEXT,
  CONSTRAINT "CharterRequirementSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CharterRequirement" (
  "id" TEXT NOT NULL, "setId" TEXT NOT NULL, "codigo" TEXT NOT NULL,
  "citacao" TEXT NOT NULL, "resumo" TEXT NOT NULL, "texto" TEXT,
  "peso" INTEGER, "categoria" TEXT,
  CONSTRAINT "CharterRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CharterCoverage" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "requirementId" TEXT NOT NULL,
  "status" "CharterCoverageStatus" NOT NULL DEFAULT 'SEM_VEREDITO',
  "comentario" TEXT, "capabilityId" TEXT,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharterCoverage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX        IF NOT EXISTS "CharterRequirementSet_tenantId_idx" ON "CharterRequirementSet"("tenantId");
CREATE INDEX        IF NOT EXISTS "CharterRequirementSet_origem_idx"   ON "CharterRequirementSet"("origem");
CREATE UNIQUE INDEX IF NOT EXISTS "CharterRequirement_setId_codigo_key" ON "CharterRequirement"("setId","codigo");
CREATE INDEX        IF NOT EXISTS "CharterRequirement_setId_idx"        ON "CharterRequirement"("setId");
-- tenantId compõe a chave (não só requirementId): CharterRequirementSet.tenantId
-- pode ser nulo (regulação global), e N tenants referenciam o mesmo
-- requirementId, cada um com seu próprio veredito. Ver comentário no schema
-- (model CharterCoverage) para o raciocínio completo.
CREATE UNIQUE INDEX IF NOT EXISTS "CharterCoverage_tenantId_requirementId_key" ON "CharterCoverage"("tenantId","requirementId");
CREATE INDEX        IF NOT EXISTS "CharterCoverage_tenantId_idx"        ON "CharterCoverage"("tenantId");
CREATE INDEX        IF NOT EXISTS "CharterCoverage_tenantId_status_idx" ON "CharterCoverage"("tenantId","status");

DO $$ BEGIN ALTER TABLE "CharterRequirementSet" ADD CONSTRAINT "CharterRequirementSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterRequirementSet" ADD CONSTRAINT "CharterRequirementSet_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "CharterRequirementSet"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterRequirement" ADD CONSTRAINT "CharterRequirement_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CharterRequirementSet"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterCoverage" ADD CONSTRAINT "CharterCoverage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterCoverage" ADD CONSTRAINT "CharterCoverage_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "CharterRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS só em CharterCoverage. CharterRequirementSet e CharterRequirement são
-- legíveis por todos quando tenantId é nulo (regulação global), e o filtro por
-- tenant fica na action — política de RLS com OR de nulo abre buraco fácil.
--
-- Mesmo padrão do bloco CharterPolicyLink logo acima (e de
-- 20260728010000_rls_remaining_tenant_tables / 20260728120000_charter_module):
-- current_tenant_id(), não current_setting(...) inline, e FORCE ROW LEVEL
-- SECURITY, sem o qual o dono da tabela contorna a policy.
ALTER TABLE "CharterCoverage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterCoverage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CharterCoverage";
CREATE POLICY "tenant_isolation" ON "CharterCoverage"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Task 7: fundamento citado no rascunho gerado. Sem esta coluna, um rascunho
-- gerado (generated = true) não aponta para nenhuma exigência — texto de
-- política sem citação é o que o auditor encontra antes de você.
ALTER TABLE "CharterPolicySection" ADD COLUMN IF NOT EXISTS "groundedRequirementId" TEXT;

-- SET NULL, não CASCADE (diferente de CharterCoverage_requirementId_fkey
-- acima): perder a exigência (ex.: set superado sendo retirado) deve limpar
-- a citação, nunca apagar a seção de política que um humano escreveu.
DO $$ BEGIN
  ALTER TABLE "CharterPolicySection" ADD CONSTRAINT "CharterPolicySection_groundedRequirementId_fkey"
    FOREIGN KEY ("groundedRequirementId") REFERENCES "CharterRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Operação da Nebuloz: catálogo, propostas, engajamentos, capacidade, IP e
-- acesso ao painel.
--
-- Tudo IF NOT EXISTS e as FKs em EXCEPTION: reexecutar não pode falhar por
-- objeto que já está lá.

-- ─────────────────────────── Catálogo ───────────────────────────

CREATE TABLE IF NOT EXISTS "Service" (
    "id"                TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL,
    "codigo"            TEXT NOT NULL,
    "nome"              TEXT NOT NULL,
    "descricao"         TEXT,
    "modalidade"        TEXT NOT NULL DEFAULT 'PROJETO',
    "precoBaseCentavos" INTEGER NOT NULL DEFAULT 0,
    "unidade"           TEXT NOT NULL DEFAULT 'projeto',
    "ativo"             BOOLEAN NOT NULL DEFAULT true,
    "criadoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Service_tenantId_codigo_key" ON "Service"("tenantId", "codigo");
CREATE INDEX IF NOT EXISTS "Service_tenantId_idx"       ON "Service"("tenantId");
CREATE INDEX IF NOT EXISTS "Service_tenantId_ativo_idx" ON "Service"("tenantId", "ativo");

-- ─────────────────────────── Propostas ───────────────────────────

CREATE TABLE IF NOT EXISTS "Proposal" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "numero"          TEXT NOT NULL,
    "titulo"          TEXT NOT NULL,
    "clienteTenantId" TEXT,
    "clienteNome"     TEXT,
    "status"          TEXT NOT NULL DEFAULT 'RASCUNHO',
    "descontoPercent" INTEGER NOT NULL DEFAULT 0,
    "totalCentavos"   INTEGER NOT NULL DEFAULT 0,
    "aprovacaoId"     TEXT,
    "criadoPorId"     TEXT NOT NULL,
    "criadoPorNome"   TEXT,
    "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_tenantId_numero_key" ON "Proposal"("tenantId", "numero");
CREATE INDEX IF NOT EXISTS "Proposal_tenantId_idx"          ON "Proposal"("tenantId");
CREATE INDEX IF NOT EXISTS "Proposal_tenantId_status_idx"   ON "Proposal"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Proposal_clienteTenantId_idx"   ON "Proposal"("clienteTenantId");

CREATE TABLE IF NOT EXISTS "ProposalItem" (
    "id"                TEXT NOT NULL,
    "proposalId"        TEXT NOT NULL,
    "serviceId"         TEXT NOT NULL,
    "descricao"         TEXT NOT NULL,
    "quantidade"        INTEGER NOT NULL DEFAULT 1,
    "precoUnitCentavos" INTEGER NOT NULL DEFAULT 0,
    "ordem"             INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProposalItem_proposalId_idx" ON "ProposalItem"("proposalId");
CREATE INDEX IF NOT EXISTS "ProposalItem_serviceId_idx"  ON "ProposalItem"("serviceId");

-- ─────────────────────────── Delivery ───────────────────────────

CREATE TABLE IF NOT EXISTS "Engagement" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "nome"            TEXT NOT NULL,
    "codigo"          TEXT NOT NULL,
    "clienteTenantId" TEXT NOT NULL,
    "serviceId"       TEXT,
    "escopo"          TEXT,
    "status"          TEXT NOT NULL DEFAULT 'PROPOSTO',
    "inicioEm"        TIMESTAMP(3),
    "fimEm"           TIMESTAMP(3),
    "valorCentavos"   INTEGER NOT NULL DEFAULT 0,
    "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Engagement_tenantId_codigo_key" ON "Engagement"("tenantId", "codigo");
CREATE INDEX IF NOT EXISTS "Engagement_tenantId_idx"        ON "Engagement"("tenantId");
CREATE INDEX IF NOT EXISTS "Engagement_tenantId_status_idx" ON "Engagement"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Engagement_clienteTenantId_idx" ON "Engagement"("clienteTenantId");

CREATE TABLE IF NOT EXISTS "StaffPerson" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "nome"         TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "habilidades"  TEXT[] DEFAULT ARRAY[]::TEXT[],
    "horasSemana"  INTEGER NOT NULL DEFAULT 40,
    "ativo"        BOOLEAN NOT NULL DEFAULT true,
    "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPerson_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffPerson_tenantId_email_key" ON "StaffPerson"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "StaffPerson_tenantId_idx"       ON "StaffPerson"("tenantId");
CREATE INDEX IF NOT EXISTS "StaffPerson_tenantId_ativo_idx" ON "StaffPerson"("tenantId", "ativo");

CREATE TABLE IF NOT EXISTS "StaffAllocation" (
    "id"           TEXT NOT NULL,
    "personId"     TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "percentual"   INTEGER NOT NULL DEFAULT 0,
    "inicioEm"     TIMESTAMP(3) NOT NULL,
    "fimEm"        TIMESTAMP(3),
    "nota"         TEXT,
    "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAllocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffAllocation_personId_idx"          ON "StaffAllocation"("personId");
CREATE INDEX IF NOT EXISTS "StaffAllocation_engagementId_idx"      ON "StaffAllocation"("engagementId");
CREATE INDEX IF NOT EXISTS "StaffAllocation_personId_inicioEm_idx" ON "StaffAllocation"("personId", "inicioEm");

-- ─────────────────────── Biblioteca de IP ───────────────────────

CREATE TABLE IF NOT EXISTS "IpAsset" (
    "id"                 TEXT NOT NULL,
    "tenantId"           TEXT NOT NULL,
    "nome"               TEXT NOT NULL,
    "slug"               TEXT NOT NULL,
    "tipo"               TEXT NOT NULL DEFAULT 'DOCUMENTO',
    "descricao"          TEXT,
    "conteudo"           TEXT NOT NULL,
    "origemEngagementId" TEXT,
    "criadoPorId"        TEXT NOT NULL,
    "criadoPorNome"      TEXT,
    "criadoEm"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IpAsset_tenantId_slug_key" ON "IpAsset"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "IpAsset_tenantId_idx"      ON "IpAsset"("tenantId");
CREATE INDEX IF NOT EXISTS "IpAsset_tenantId_tipo_idx" ON "IpAsset"("tenantId", "tipo");

CREATE TABLE IF NOT EXISTS "IpAssetVersion" (
    "id"        TEXT NOT NULL,
    "assetId"   TEXT NOT NULL,
    "versao"    INTEGER NOT NULL,
    "conteudo"  TEXT NOT NULL,
    "nota"      TEXT,
    "autorId"   TEXT NOT NULL,
    "autorNome" TEXT,
    "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpAssetVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IpAssetVersion_assetId_versao_key" ON "IpAssetVersion"("assetId", "versao");
CREATE INDEX IF NOT EXISTS "IpAssetVersion_assetId_idx" ON "IpAssetVersion"("assetId");

-- ─────────────────────── Acesso ao painel ───────────────────────

CREATE TABLE IF NOT EXISTS "AccessLog" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "userId"    TEXT,
    "email"     TEXT NOT NULL,
    "evento"    TEXT NOT NULL,
    "motivo"    TEXT,
    "ip"        TEXT,
    "userAgent" TEXT,
    "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AccessLog_tenantId_idx"          ON "AccessLog"("tenantId");
CREATE INDEX IF NOT EXISTS "AccessLog_tenantId_criadoEm_idx" ON "AccessLog"("tenantId", "criadoEm");
CREATE INDEX IF NOT EXISTS "AccessLog_email_idx"             ON "AccessLog"("email");

-- ─────────────────────────── Chaves ───────────────────────────

DO $$
BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Restrict: apagar um serviço que já está em proposta deve falhar. Cascade
-- aqui apagaria linhas de um documento comercial já emitido.
DO $$
BEGIN
  ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "StaffPerson" ADD CONSTRAINT "StaffPerson_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "StaffAllocation" ADD CONSTRAINT "StaffAllocation_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "StaffPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "StaffAllocation" ADD CONSTRAINT "StaffAllocation_engagementId_fkey"
    FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "IpAsset" ADD CONSTRAINT "IpAsset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "IpAsset" ADD CONSTRAINT "IpAsset_origemEngagementId_fkey"
    FOREIGN KEY ("origemEngagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "IpAssetVersion" ADD CONSTRAINT "IpAssetVersion_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "IpAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

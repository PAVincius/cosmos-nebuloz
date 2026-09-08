-- Catálogo de IP: procedência, licença, dono, endereço, serviços e reuso.

ALTER TABLE "IpAsset"
  ADD COLUMN "link" TEXT,
  ADD COLUMN "donoPersonId" TEXT,
  ADD COLUMN "procedencia" TEXT NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN "reusoConfirmado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "licenca" TEXT NOT NULL DEFAULT 'NENHUMA',
  ADD COLUMN "licencaRef" TEXT;

-- COMPONENTE e ACELERADOR são o mesmo conceito com dois nomes, e dois nomes
-- para uma coisa divergem. DOCUMENTO fica: já tem linhas e é o caso genérico.
UPDATE "IpAsset" SET "tipo" = 'ACELERADOR' WHERE "tipo" = 'COMPONENTE';

DO $$
DECLARE restantes BIGINT;
BEGIN
  SELECT count(*) INTO restantes FROM "IpAsset" WHERE "tipo" = 'COMPONENTE';
  IF restantes <> 0 THEN
    RAISE EXCEPTION 'renomeacao de tipo incompleta: % linhas ainda em COMPONENTE', restantes;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IpAsset_donoPersonId_idx" ON "IpAsset"("donoPersonId");

ALTER TABLE "IpAsset" ADD CONSTRAINT "IpAsset_donoPersonId_fkey"
  FOREIGN KEY ("donoPersonId") REFERENCES "StaffPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IpAssetService" (
  "assetId"   TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "IpAssetService_pkey" PRIMARY KEY ("assetId", "serviceId")
);
CREATE INDEX IF NOT EXISTS "IpAssetService_serviceId_idx" ON "IpAssetService"("serviceId");

ALTER TABLE "IpAssetService" ADD CONSTRAINT "IpAssetService_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "IpAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IpAssetService" ADD CONSTRAINT "IpAssetService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IpAssetReuse" (
  "id"                TEXT NOT NULL,
  "assetId"           TEXT NOT NULL,
  "engagementId"      TEXT NOT NULL,
  "horasPoupadas"     INTEGER NOT NULL DEFAULT 0,
  "nota"              TEXT,
  "registradoPorId"   TEXT NOT NULL,
  "registradoPorNome" TEXT,
  "criadoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IpAssetReuse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IpAssetReuse_assetId_engagementId_key"
  ON "IpAssetReuse"("assetId", "engagementId");
CREATE INDEX IF NOT EXISTS "IpAssetReuse_assetId_idx" ON "IpAssetReuse"("assetId");
CREATE INDEX IF NOT EXISTS "IpAssetReuse_engagementId_idx" ON "IpAssetReuse"("engagementId");

ALTER TABLE "IpAssetReuse" ADD CONSTRAINT "IpAssetReuse_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "IpAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IpAssetReuse" ADD CONSTRAINT "IpAssetReuse_engagementId_fkey"
  FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sem RLS nas duas tabelas novas, de propósito: elas não têm `tenantId` e só
-- se alcança por `IpAsset`, que tem RLS forçada. É a mesma forma de
-- `IpAssetVersion` e `StaffAllocation` nesta base.

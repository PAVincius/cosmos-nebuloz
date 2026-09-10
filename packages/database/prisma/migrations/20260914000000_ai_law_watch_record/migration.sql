-- AiLawWatchRecord — leis/PLs de IA no Brasil já vistas pelo cron que
-- monitora a API AI Law Tracker. Dado interno da Nebuloz (tenant `system`).
--
-- IF NOT EXISTS em tudo, e a FK embrulhada em EXCEPTION: reexecutar não pode
-- falhar por objeto que já está lá.

CREATE TABLE IF NOT EXISTS "AiLawWatchRecord" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "source"       TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "identifier"   TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "recordType"   TEXT,
    "inForce"      BOOLEAN NOT NULL,
    "officialUrl"  TEXT NOT NULL,
    "firstSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiLawWatchRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiLawWatchRecord_tenantId_source_jurisdiction_identifier_key" ON "AiLawWatchRecord"("tenantId", "source", "jurisdiction", "identifier");
CREATE INDEX IF NOT EXISTS "AiLawWatchRecord_tenantId_source_jurisdiction_idx"            ON "AiLawWatchRecord"("tenantId", "source", "jurisdiction");

DO $$
BEGIN
  ALTER TABLE "AiLawWatchRecord"
    ADD CONSTRAINT "AiLawWatchRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

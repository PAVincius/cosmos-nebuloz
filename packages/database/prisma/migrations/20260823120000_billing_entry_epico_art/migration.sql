-- BillingEntry.epicId / BillingEntry.artId — NEB-185.
--
-- resolveMapping() (tag-rule-engine.ts) já calcula epicId e artId junto com
-- themeId, mas mapStagedRowToEntry() só copiava themeId para o insert porque
-- BillingEntry não tinha coluna para os outros dois: o custo por épico/ART
-- era calculado e descartado. Espelha exatamente o que já existe para
-- themeId — coluna opcional, relation SetNull (apagar um épico ou ART não
-- pode apagar o histórico de custo já registrado) e os mesmos dois índices
-- (composto com tenantId+usageStartDate para consulta por período, e solo
-- para a FK, no padrão de 20260821120000_indices_fk_faltantes).
--
-- IF NOT EXISTS em tudo: migrate deploy roda no deploy de produção agora, e
-- uma reexecução não pode falhar por objeto que já está lá.

ALTER TABLE "BillingEntry"
  ADD COLUMN IF NOT EXISTS "epicId" TEXT,
  ADD COLUMN IF NOT EXISTS "artId"  TEXT;

CREATE INDEX IF NOT EXISTS "BillingEntry_tenantId_epicId_usageStartDate_idx" ON "BillingEntry"("tenantId", "epicId", "usageStartDate");
CREATE INDEX IF NOT EXISTS "BillingEntry_tenantId_artId_usageStartDate_idx"  ON "BillingEntry"("tenantId", "artId", "usageStartDate");
CREATE INDEX IF NOT EXISTS "BillingEntry_epicId_idx" ON "BillingEntry"("epicId");
CREATE INDEX IF NOT EXISTS "BillingEntry_artId_idx"  ON "BillingEntry"("artId");

DO $$
BEGIN
  ALTER TABLE "BillingEntry"
    ADD CONSTRAINT "BillingEntry_epicId_fkey"
    FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "BillingEntry"
    ADD CONSTRAINT "BillingEntry_artId_fkey"
    FOREIGN KEY ("artId") REFERENCES "ART"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

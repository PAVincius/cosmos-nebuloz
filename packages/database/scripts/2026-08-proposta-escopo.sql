-- Escopo de assinatura na proposta: plano, assentos, módulos, add-ons, prazo,
-- e os totais congelados (ACV, TCV, setup).
--
-- Propostas anteriores continuam válidas: escopo vazio, e o total delas segue
-- sendo o que já está gravado em `totalCentavos`.

BEGIN;

ALTER TABLE "Proposal"
  ADD COLUMN IF NOT EXISTS "planoSlug"              TEXT,
  ADD COLUMN IF NOT EXISTS "assentos"               INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "modulos"                "ProductModule"[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "addOnSlugs"             TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "termoSlug"              TEXT,
  ADD COLUMN IF NOT EXISTS "acvCentavos"            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tcvCentavos"            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "umaVezCentavos"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "contatoEmail"           TEXT,
  ADD COLUMN IF NOT EXISTS "tenantProvisionadoSlug" TEXT;

COMMIT;

-- Conferência:
--   SELECT numero, titulo, "planoSlug", assentos, modulos, "acvCentavos"
--   FROM "Proposal" ORDER BY "criadoEm" DESC LIMIT 10;

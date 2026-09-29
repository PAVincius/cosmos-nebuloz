-- Reverte 20260929000000_work_form_enum. Postgres não remove valor de enum;
-- recria ScaffoldArchetype com os 3 originais e troca o tipo das duas colunas.
-- Falha (de propósito) se alguma linha já usa CONVERSATIONAL ou ANALYSIS.
-- Reverta 20260929000100_process_registry antes (ele usa WorkForm).
CREATE TYPE "ScaffoldArchetype_old" AS ENUM ('TRIAGE', 'DOC_REVIEW', 'REPORTING');
ALTER TABLE "ScaffoldTemplate" ALTER COLUMN "archetype" TYPE "ScaffoldArchetype_old" USING ("archetype"::text::"ScaffoldArchetype_old");
ALTER TABLE "ScaffoldTrack" ALTER COLUMN "archetype" TYPE "ScaffoldArchetype_old" USING ("archetype"::text::"ScaffoldArchetype_old");
DROP TYPE "WorkForm";
ALTER TYPE "ScaffoldArchetype_old" RENAME TO "ScaffoldArchetype";

-- Tipo da revisão do consultor sobre a nota de um eixo (D-29, PR #334).
-- OVERRIDE muda a nota; CONFIRMATION confirma a calculada. As linhas que já
-- existem são todas ajustes, então o default é OVERRIDE e não há backfill (o
-- Postgres preenche a coluna nova com o default, sem reescrever a tabela).
CREATE TYPE "MeridianOverrideKind" AS ENUM ('OVERRIDE', 'CONFIRMATION');

ALTER TABLE "MeridianOverride" ADD COLUMN "kind" "MeridianOverrideKind" NOT NULL DEFAULT 'OVERRIDE';

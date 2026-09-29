-- Reverte 20260929000400_scaffold_role_sponsor_team_lead. Postgres não remove
-- valor de enum: recria o tipo com os 5 originais. Falha (de propósito) se
-- houver ScaffoldMembership com SPONSOR ou TEAM_LEAD; remova essas linhas antes.
CREATE TYPE "ScaffoldRole_old" AS ENUM ('TEAM_MEMBER', 'PROCESS_OWNER', 'TRANSFORMATION_LEAD', 'CONSULTANT', 'ADMIN');
ALTER TABLE "ScaffoldMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "ScaffoldMembership" ALTER COLUMN "role" TYPE "ScaffoldRole_old" USING ("role"::text::"ScaffoldRole_old");
ALTER TABLE "ScaffoldMembership" ALTER COLUMN "role" SET DEFAULT 'TEAM_MEMBER';
DROP TYPE "ScaffoldRole";
ALTER TYPE "ScaffoldRole_old" RENAME TO "ScaffoldRole";

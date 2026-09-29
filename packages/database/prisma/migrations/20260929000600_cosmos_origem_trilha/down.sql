-- Reverte 20260929000600_cosmos_origem_trilha.
DROP INDEX "Feature_tenantId_originTrackId_originPhase_key";
DROP INDEX "Epic_tenantId_originTrackId_key";
ALTER TABLE "Feature" DROP COLUMN "originPhase", DROP COLUMN "originTrackId";
ALTER TABLE "Epic" DROP COLUMN "originTrackId";

-- Reverte 20260929010200_charter_control_profiles. Reverta 20260929010300_charter_case_controls antes.
ALTER TABLE "CharterUseCase" DROP CONSTRAINT "CharterUseCase_controlProfileVersionId_fkey";
DROP INDEX "CharterUseCase_controlProfileVersionId_idx";
ALTER TABLE "CharterUseCase" DROP COLUMN "controlProfileVersionId", DROP COLUMN "workForm";
DROP TABLE "CharterControlProfileControl";
DROP TABLE "CharterControlProfileVersion";
DROP TABLE "CharterControlProfile";
DROP TYPE "CharterControlCadence";

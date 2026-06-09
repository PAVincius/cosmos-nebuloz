-- Migration 025: SolutionRisk + CrossArtDependency (story-043)

CREATE TYPE "SolutionROAMStatus" AS ENUM ('RESOLVED', 'OWNED', 'ACCEPTED', 'MITIGATED');
CREATE TYPE "CrossArtDependencyType" AS ENUM ('PROVIDES', 'NEEDS', 'BLOCKS');

CREATE TABLE "SolutionRisk" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL,
  "solutionTrainId" TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "roamStatus"      "SolutionROAMStatus" NOT NULL DEFAULT 'RESOLVED',
  "owner"           TEXT,
  "affectedArtIds"  TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SolutionRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrossArtDependency" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"          TEXT NOT NULL,
  "solutionTrainId"   TEXT NOT NULL,
  "sourceFeatureId"   TEXT NOT NULL,
  "targetFeatureId"   TEXT NOT NULL,
  "sourceArtId"       TEXT NOT NULL,
  "targetArtId"       TEXT NOT NULL,
  "type"              "CrossArtDependencyType" NOT NULL DEFAULT 'NEEDS',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrossArtDependency_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SolutionRisk"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SolutionRisk"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "CrossArtDependency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrossArtDependency" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "SolutionRisk"
  USING ("tenantId" = current_tenant_id());
CREATE POLICY "tenant_isolation" ON "CrossArtDependency"
  USING ("tenantId" = current_tenant_id());

CREATE INDEX "SolutionRisk_solutionTrainId_roamStatus_idx"  ON "SolutionRisk"("solutionTrainId", "roamStatus");
CREATE INDEX "SolutionRisk_tenantId_idx"                    ON "SolutionRisk"("tenantId");
CREATE INDEX "CrossArtDependency_solutionTrainId_idx"       ON "CrossArtDependency"("solutionTrainId");
CREATE INDEX "CrossArtDependency_tenantId_idx"              ON "CrossArtDependency"("tenantId");

ALTER TABLE "SolutionRisk"       ADD CONSTRAINT "SolutionRisk_solutionTrainId_fkey"
  FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE CASCADE;
ALTER TABLE "CrossArtDependency" ADD CONSTRAINT "CrossArtDependency_solutionTrainId_fkey"
  FOREIGN KEY ("solutionTrainId") REFERENCES "SolutionTrain"("id") ON DELETE CASCADE;

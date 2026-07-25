-- Layout denorm fields for dashboard cards and entity detail pages
-- All fields are nullable or have defaults — zero downtime, no data loss

-- ART: active PI pointer (no FK — app layer keeps in sync)
ALTER TABLE "ART" ADD COLUMN "currentPiPlanId" TEXT;

-- Team: visual identity + WIP counter
ALTER TABLE "Team" ADD COLUMN "avatarUrl"  TEXT;
ALTER TABLE "Team" ADD COLUMN "color"      TEXT NOT NULL DEFAULT '#6366f1';
ALTER TABLE "Team" ADD COLUMN "wip"        INTEGER NOT NULL DEFAULT 0;

-- PIPlan: completion % for PI cards
ALTER TABLE "PIPlan" ADD COLUMN "completionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Epic: feature counts for kanban cards (avoid N+1 on listing)
ALTER TABLE "Epic" ADD COLUMN "featureCount"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Epic" ADD COLUMN "doneFeatureCount" INTEGER NOT NULL DEFAULT 0;

-- Feature: % stories done for feature detail page
ALTER TABLE "Feature" ADD COLUMN "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Sprint: burndown snapshots array [{date, remaining, ideal}]
ALTER TABLE "Sprint" ADD COLUMN "burndownSnapshots" JSONB NOT NULL DEFAULT '[]';

-- Impediment: sprint IDs blocked by this impediment
ALTER TABLE "Impediment" ADD COLUMN "blockedSprintIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- StandupEntry: AI sentiment classification
ALTER TABLE "StandupEntry" ADD COLUMN "sentiment" TEXT;

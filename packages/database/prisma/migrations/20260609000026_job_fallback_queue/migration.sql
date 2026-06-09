-- Migration 026: JobFallbackQueue for Inngest degradation (story-044)

CREATE TABLE "JobFallbackQueue" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT,
  "jobType"   TEXT NOT NULL,
  "payload"   JSONB NOT NULL DEFAULT '{}',
  "status"    TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobFallbackQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobFallbackQueue_status_createdAt_idx" ON "JobFallbackQueue"("status", "createdAt");

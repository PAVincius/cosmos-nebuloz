-- Duas tabelas do schema nunca ganharam migration: nasceram de `prisma db push`
-- em desenvolvimento e só existiam nos bancos de dev. Em banco novo a cadeia
-- morria na migration seguinte (20260728010000), que liga RLS nelas:
--   ERROR: relation "github_syncs" does not exist
--
-- `IF NOT EXISTS` porque os bancos de dev já têm as tabelas vindas do push.

-- CreateTable
CREATE TABLE IF NOT EXISTS "copilot_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'global',
    "surface" TEXT,
    "title" TEXT,
    "messages" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "copilot_sessions_tenantId_idx" ON "copilot_sessions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "copilot_sessions_tenantId_userId_idx" ON "copilot_sessions"("tenantId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "copilot_sessions_tenantId_updatedAt_idx" ON "copilot_sessions"("tenantId", "updatedAt" DESC);

-- CreateTable
CREATE TABLE IF NOT EXISTS "github_syncs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "githubRepo" TEXT NOT NULL,
    "githubNumber" INTEGER NOT NULL,
    "githubType" TEXT NOT NULL,
    "cosmosId" TEXT NOT NULL,
    "cosmosType" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "github_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "github_syncs_tenantId_idx" ON "github_syncs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "github_syncs_tenantId_githubRepo_githubNumber_githubType_key" ON "github_syncs"("tenantId", "githubRepo", "githubNumber", "githubType");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "copilot_sessions"
        ADD CONSTRAINT "copilot_sessions_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

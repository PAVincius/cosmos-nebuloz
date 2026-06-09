-- Story-025: GitHub SAFe-Aware Sync & DORA Metrics

-- Story.prStatus and Story.prUrl for PR linking (AC-001/AC-002)
ALTER TABLE "stories" ADD COLUMN "prStatus" TEXT;
ALTER TABLE "stories" ADD COLUMN "prUrl"    TEXT;

-- Feature.deployedAt for deployment tracking (AC-003)
ALTER TABLE "features" ADD COLUMN "deployedAt" TIMESTAMP(3);

-- GitHubSyncEvent: per-entity sync event log
CREATE TABLE "github_sync_events" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "direction"     TEXT NOT NULL,
    "source"        TEXT NOT NULL DEFAULT 'GITHUB',
    "action"        TEXT NOT NULL,
    "entityType"    TEXT NOT NULL,
    "entityId"      TEXT NOT NULL,
    "externalId"    TEXT,
    "field"         TEXT,
    "payload"       JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_sync_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "github_sync_events_tenantId_integrationId_createdAt_idx"
    ON "github_sync_events"("tenantId", "integrationId", "createdAt");

CREATE INDEX "github_sync_events_tenantId_entityType_entityId_idx"
    ON "github_sync_events"("tenantId", "entityType", "entityId");

ALTER TABLE "github_sync_events"
    ADD CONSTRAINT "github_sync_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GitHubUnlinkedPR: merged PRs with no Cosmos link (AC-004)
CREATE TABLE "github_unlinked_prs" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "githubRepo"   TEXT NOT NULL,
    "prNumber"     INTEGER NOT NULL,
    "prTitle"      TEXT NOT NULL,
    "prUrl"        TEXT NOT NULL,
    "prStatus"     TEXT NOT NULL,
    "headBranch"   TEXT,
    "mergedAt"     TIMESTAMP(3),
    "receivedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedAt"     TIMESTAMP(3),
    "linkedToId"   TEXT,
    "linkedToType" TEXT,

    CONSTRAINT "github_unlinked_prs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "github_unlinked_prs_tenantId_prStatus_linkedAt_idx"
    ON "github_unlinked_prs"("tenantId", "prStatus", "linkedAt");

ALTER TABLE "github_unlinked_prs"
    ADD CONSTRAINT "github_unlinked_prs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GitHubDeploymentEvent: raw events for DORA computation (AC-005)
CREATE TABLE "github_deployment_events" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "githubRepo"    TEXT NOT NULL,
    "deploymentId"  TEXT NOT NULL,
    "environment"   TEXT NOT NULL,
    "state"         TEXT NOT NULL,
    "sha"           TEXT,
    "prNumber"      INTEGER,
    "firstCommitAt" TIMESTAMP(3),
    "deployedAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_deployment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "github_deployment_events_tenantId_environment_deployedAt_idx"
    ON "github_deployment_events"("tenantId", "environment", "deployedAt");

CREATE INDEX "github_deployment_events_tenantId_githubRepo_deploymentId_idx"
    ON "github_deployment_events"("tenantId", "githubRepo", "deploymentId");

ALTER TABLE "github_deployment_events"
    ADD CONSTRAINT "github_deployment_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

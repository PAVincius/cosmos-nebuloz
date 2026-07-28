-- Sec 2: tenant-scope the unique keys used by upsert() calls that let a
-- caller-supplied foreign id (sprintId/teamId) reach an existing row without
-- checking it belongs to the caller's tenant. Without tenantId in the key,
-- upsertMemberAssignment(sprintId, teamId, userId, ...) and
-- upsertStandupEntry(...) can match another tenant's row by id and fall into
-- the `update` branch, overwriting that tenant's data cross-tenant.
--
-- The new keys are strict supersets of the old ones, so they cannot be
-- violated by data that was valid under the narrower key. Sanity-checked
-- against the live database before this migration was written: 0 rows in
-- TeamMemberAssignment, 17 rows in StandupEntry, 0 duplicate groups under
-- either new key in either table.

-- DropIndex
DROP INDEX "TeamMemberAssignment_sprintId_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberAssignment_tenantId_sprintId_userId_key" ON "TeamMemberAssignment"("tenantId", "sprintId", "userId");

-- DropIndex
DROP INDEX "StandupEntry_teamId_userId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "StandupEntry_tenantId_teamId_userId_date_key" ON "StandupEntry"("tenantId", "teamId", "userId", "date");

CREATE TABLE IF NOT EXISTS "PIParticipant" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "piPlanId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      TEXT NOT NULL DEFAULT 'INVITED',
  "confirmed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PIParticipant_piPlanId_fkey" FOREIGN KEY ("piPlanId") REFERENCES "PIPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PIParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PIParticipant_piPlanId_userId_key" ON "PIParticipant"("piPlanId", "userId");
CREATE INDEX IF NOT EXISTS "PIParticipant_tenantId_idx" ON "PIParticipant"("tenantId");
CREATE INDEX IF NOT EXISTS "PIParticipant_piPlanId_idx" ON "PIParticipant"("piPlanId");

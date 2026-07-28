-- Sec 6: create the "system" Tenant row that lib/inngest/isolation-audit.ts
-- (and other system-actor audit writes) needs to exist before it can write
-- an AuditLog row with tenantId = 'system'. AuditLog.tenantId is a required
-- FK to Tenant (onDelete: Restrict) — without this row, every write attempt
-- fails with a foreign key violation, which is why the monthly isolation
-- audit has never once recorded a result.
--
-- Idempotent: ON CONFLICT DO NOTHING so this migration is safe to have run
-- already re-run against environments where a "system" tenant slug exists
-- for some other reason (it should not, but this keeps the migration from
-- becoming a new ledger blocker like the one Sec 3 spent a cycle repairing).
INSERT INTO "Tenant" ("id", "name", "slug", "plan", "createdAt", "updatedAt")
VALUES ('system', 'System', 'system', 'ORBIT', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- Task 6 review, Finding 3: the "system" Tenant row created by
-- 20260728020000_system_tenant is otherwise indistinguishable from a real
-- customer tenant (same columns, same shape). Nothing today calls
-- tenant.findMany() in tenant-facing output, so there is no live leak, but
-- an admin org list, billing export, or customer CSV added later could
-- silently include "System" as a paying customer.
--
-- 1) Add an explicit marker column, default false so every existing/future
--    real tenant is unaffected by default.
ALTER TABLE "Tenant" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- 2) Mark the system row.
UPDATE "Tenant" SET "isSystem" = true WHERE "id" = 'system';

-- 3) The slug 'system' permanently reserves that word against a real future
--    customer signing up with it. Move it to a slug shape ('__system__')
--    that customer-facing slug validation would not plausibly ever produce.
UPDATE "Tenant" SET "slug" = '__system__' WHERE "id" = 'system';

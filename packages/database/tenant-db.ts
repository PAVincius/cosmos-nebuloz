import "server-only";

import { database } from ".";

/**
 * Runs a block of Prisma operations with RLS tenant context set.
 *
 * Opens an interactive transaction, sets app.tenant_id via SET LOCAL (scoped
 * to that transaction), then runs fn. All queries inside fn see only rows
 * belonging to tenantId — enforced by the policies in migration
 * 20260603000001_rls_tenant_isolation.
 *
 * Usage (server action or API route):
 *
 *   const ctx = await requireTenantSession(await headers());
 *   const features = await withTenantDb(ctx.tenantId, (db) =>
 *     db.feature.findMany({ where: { epicId } })
 *   );
 */
export function withTenantDb<T>(
  tenantId: string,
  fn: (
    db: Omit<
      typeof database,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >
  ) => Promise<T>
): Promise<T> {
  return database.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

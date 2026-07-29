import { database } from "@repo/database";

/**
 * A cheap fingerprint of a tenant's epic rows: any insert changes the count,
 * any update moves the max updatedAt, any delete changes the count. Fold it
 * into an `unstable_cache` key and a write yields a different key — and so a
 * fresh read — without the writer knowing the cache exists.
 *
 * This is not belt-and-braces over `revalidateTag`; it is the load-bearing
 * part. Epics and features are written from roughly twenty places and only a
 * handful call the tag: the Jira/Azure/Trello/CSV importer
 * (app/api/migration/[source]/import), the Linear import, the GitHub sync and
 * the copilot tools all write straight to the database. Invalidation by
 * convention fails silently exactly when it matters most — right after an
 * import, when the user is looking for the rows they just brought in.
 *
 * Costs one aggregate over the ([tenantId]) index per request. Deliberate:
 * these screens read the tenant's epics anyway, so the query the cache guarded
 * was never the expensive part — correctness was.
 *
 * Does not cover fields reached through a relation (strategicTheme.title);
 * pair it with a `revalidate` TTL to bound those.
 *
 * Kept out of portfolio-cache.ts on purpose: that module is a pure string
 * helper with no runtime dependencies, and importing the database there drags
 * server-only env validation into every consumer.
 */
export async function epicsFingerprint(tenantId: string): Promise<string> {
  const agg = await database.epic.aggregate({
    where: { tenantId },
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  return `${agg._count._all}:${agg._max.updatedAt?.getTime() ?? 0}`;
}

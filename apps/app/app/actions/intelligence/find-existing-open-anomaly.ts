import { database } from "@repo/database";

/**
 * Pure utility used by the detection engine to dedup anomalies.
 *
 * Not a server action — no "use server" directive, so it is not RPC-reachable.
 * Callers must pass a tenantId they already trust, never a caller-supplied
 * value.
 */
export async function findExistingOpenAnomaly(opts: {
  tenantId: string;
  rule: string;
  entityId: string;
  windowMs?: number;
}): Promise<{ id: string } | null> {
  const windowMs = opts.windowMs ?? 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - windowMs);

  return database.anomaly.findFirst({
    where: {
      tenantId: opts.tenantId,
      rule: opts.rule,
      entityId: opts.entityId,
      status: { notIn: ["RESOLVED", "SUPPRESSED"] },
      detectedAt: { gt: since },
    },
    select: { id: true },
  });
}

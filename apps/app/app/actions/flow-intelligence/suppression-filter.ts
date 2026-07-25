import { database } from "@repo/database";

export type RecurrenceKind = "new" | "recurring" | "chronic";

export async function classifyRecurrence(args: {
  tenantId: string;
  scope: string;
  scopeId: string;
  rule: string;
}): Promise<{ kind: RecurrenceKind; priorCount: number; lastSeenAt?: Date }> {
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const recentRuns = await database.anomalyDetectionRun.findMany({
    where: {
      tenantId: args.tenantId,
      scope: args.scope,
      scopeId: args.scopeId,
      ranAt: { gte: ninetyDays },
    },
    include: { anomalies: { where: { rule: args.rule } } },
    orderBy: { ranAt: "desc" },
  });

  const withHit = recentRuns.filter((r) => r.anomalies.length > 0);
  const priorCount = withHit.length;

  if (priorCount === 0) {
    return { kind: "new", priorCount };
  }
  if (priorCount >= 5) {
    return { kind: "chronic", priorCount, lastSeenAt: withHit[0]?.ranAt };
  }
  return { kind: "recurring", priorCount, lastSeenAt: withHit[0]?.ranAt };
}

export function shouldSuppress(
  kind: RecurrenceKind,
  lastSeenAt?: Date
): boolean {
  if (kind === "new" || kind === "chronic") {
    return false;
  }
  if (kind === "recurring" && lastSeenAt) {
    const ageDays = (Date.now() - lastSeenAt.getTime()) / (24 * 60 * 60 * 1000);
    return ageDays < 3;
  }
  return false;
}

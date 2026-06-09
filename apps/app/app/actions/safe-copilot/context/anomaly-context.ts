import { database } from "@repo/database";

export async function buildAnomalyContext(
  tenantId: string,
  scopeId?: string
): Promise<string> {
  const recent = await database.anomaly.findMany({
    where: {
      tenantId,
      severity: { in: ["CRITICAL", "HIGH"] },
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      ...(scopeId ? { run: { scopeId } } : {}),
    },
    include: { run: { select: { scope: true, scopeId: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (recent.length === 0) {
    return "";
  }

  const lines = recent.map((a) => {
    const meta = a.metadata as { narrative?: string } | null;
    return `- [${a.severity}] ${a.rule} (${a.run.scope} ${a.run.scopeId}): ${(meta?.narrative ?? "").slice(0, 120)}`;
  });

  return `## Recent Flow Anomalies (last 14 days)\n\n${lines.join("\n")}\n\nWhen the user asks about team or ART health, reference these anomalies.`;
}

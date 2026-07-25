"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type AnomalyRow = {
  id: string;
  rule: string;
  severity: string;
  metric: string;
  delta: number;
  metadata: {
    narrative?: string;
    actions?: string[];
    recurrence?: string;
  } | null;
  createdAt: Date;
  run: {
    scope: string;
    scopeId: string;
    ranAt: Date;
    trigger: string;
  };
};

export type AnomalyStats = {
  total: number;
  bySeverity: Record<string, number>;
};

export async function listRecentAnomalies(
  limit = 100
): Promise<{ anomalies: AnomalyRow[]; stats: AnomalyStats }> {
  const { tenantId } = await requireTenantSession(await headers());

  const rows = await database.anomaly.findMany({
    where: { tenantId },
    include: {
      run: {
        select: { scope: true, scopeId: true, ranAt: true, trigger: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });

  const bySeverity: Record<string, number> = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
  }

  return {
    anomalies: rows as AnomalyRow[],
    stats: { total: rows.length, bySeverity },
  };
}

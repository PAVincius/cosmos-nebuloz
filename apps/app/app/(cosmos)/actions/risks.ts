"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type RiskView = {
  id: string;
  title: string;
  roamStatus: string;
  severity: number;
  probability: string;
  impact: string;
  category: string;
};

export async function listRisks(): Promise<Result<RiskView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.risk.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { severity: "desc" },
      select: {
        id: true,
        title: true,
        roamStatus: true,
        severity: true,
        probability: true,
        impact: true,
        category: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      roamStatus: r.roamStatus,
      severity: r.severity,
      probability: r.probability,
      impact: r.impact,
      category: r.category ?? "OUTRO",
    }));
  });
}

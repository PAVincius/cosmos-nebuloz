"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type GovernedEpicView = {
  id: string;
  epicTitle: string;
  governanceStatus: string;
  investmentEstimate: number | null;
  submittedAt: string | null;
};

export async function listGovernedEpics(): Promise<Result<GovernedEpicView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.governedEpic.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        governanceStatus: true,
        investmentEstimate: true,
        submittedAt: true,
        epic: { select: { title: true } },
      },
    });
    return rows.map((g) => ({
      id: g.id,
      epicTitle: g.epic.title,
      governanceStatus: g.governanceStatus,
      investmentEstimate: g.investmentEstimate,
      submittedAt: g.submittedAt?.toISOString() ?? null,
    }));
  });
}

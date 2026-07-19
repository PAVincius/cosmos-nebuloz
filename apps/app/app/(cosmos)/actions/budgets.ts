"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type LeanBudgetView = {
  id: string;
  name: string;
  themeName: string | null;
  amount: number;
  spent: number;
  period: string;
  capexPct: number | null;
  opexPct: number | null;
  utilizationPct: number;
};

export async function listLeanBudgets(): Promise<Result<LeanBudgetView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.leanBudget.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { period: "desc" },
      select: {
        id: true,
        name: true,
        amount: true,
        spent: true,
        period: true,
        capexPct: true,
        opexPct: true,
        strategicTheme: { select: { title: true } },
      },
    });

    return rows.map((b) => {
      const spent = Number(b.spent ?? 0);
      return {
        id: b.id,
        name: b.name,
        themeName: b.strategicTheme?.title ?? null,
        amount: b.amount,
        spent,
        period: b.period,
        capexPct: b.capexPct,
        opexPct: b.opexPct,
        utilizationPct: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      };
    });
  });
}

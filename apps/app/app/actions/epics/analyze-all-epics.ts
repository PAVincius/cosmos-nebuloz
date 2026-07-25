"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { analyzeInvest } from "./analyze-invest";

type AnalyzeAllResult = { epicId: string; score: number | null }[];

export async function analyzeAllEpics(): Promise<Result<AnalyzeAllResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epics = await database.epic.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true },
      orderBy: { order: "asc" },
    });

    const results: AnalyzeAllResult = [];
    for (const epic of epics) {
      const res = await analyzeInvest({ epicId: epic.id });
      results.push({
        epicId: epic.id,
        score: res.ok && res.data ? res.data.compositeScore : null,
      });
    }
    return results;
  });
}

"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { evaluateStoryInvest } from "./invest-utils";
import type { InvestResult } from "./invest-utils";

export type { InvestBadge, InvestCriterion, InvestLevel, InvestResult } from "./invest-utils";

export async function checkStoryInvest(
  storyId: string
): Promise<Result<InvestResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const story = await database.story.findFirst({
      where: { id: storyId, tenantId: ctx.tenantId },
      select: {
        title: true,
        description: true,
        acceptanceCriteria: true,
        storyPoints: true,
        status: true,
      },
    });
    if (!story) {
      throw new Error("Story não encontrada");
    }
    return evaluateStoryInvest(story);
  });
}

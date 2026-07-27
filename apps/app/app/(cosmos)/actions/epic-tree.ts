"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import type { StoryNode } from "./epic-tree.constants";

// Nível 3 da árvore. Carregado sob demanda quando o usuário expande uma
// feature — a página do épico nunca traz a árvore inteira no payload inicial.
export async function listFeatureStories(
  featureId: string
): Promise<Result<StoryNode[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const stories = await database.story.findMany({
      where: { tenantId: ctx.tenantId, featureId },
      select: {
        id: true,
        title: true,
        acceptanceCriteria: true,
        status: true,
        storyPoints: true,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return stories;
  });
}

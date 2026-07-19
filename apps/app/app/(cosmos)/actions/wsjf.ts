"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type WsjfRankItem = {
  rank: number;
  id: string;
  name: string;
  type: "Epic" | "Feature";
  art: string | null;
  wsjf: number;
  size: number;
  prev: number;
  ai: string;
};

export async function listWsjfItems(): Promise<Result<WsjfRankItem[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const [epics, features] = await Promise.all([
      database.epic.findMany({
        where: { tenantId: ctx.tenantId, lifecycleStatus: { not: "REJECTED" } },
        select: {
          id: true,
          title: true,
          artId: true,
          wsjf: true,
          sizePoints: true,
        },
      }),
      database.feature.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          title: true,
          artScopedId: true,
          wsjfScore: true,
          storyPoints: true,
        },
      }),
    ]);

    const merged = [
      ...epics.map((e) => ({
        id: e.id,
        name: e.title,
        type: "Epic" as const,
        art: e.artId,
        wsjf: e.wsjf ?? 0,
        size: e.sizePoints ?? 0,
      })),
      ...features.map((f) => ({
        id: f.id,
        name: f.title,
        type: "Feature" as const,
        art: f.artScopedId,
        wsjf: f.wsjfScore,
        size: f.storyPoints,
      })),
    ].sort((a, b) => b.wsjf - a.wsjf);

    return merged.map((item, i) => ({
      ...item,
      rank: i + 1,
      prev: i + 1,
      ai: "—",
    }));
  });
}

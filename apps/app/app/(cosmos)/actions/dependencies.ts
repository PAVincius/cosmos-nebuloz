"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type DependencyView = {
  id: string;
  title: string;
  blockingTitle: string;
  blockedTitle: string;
  status: string;
  boardStatus: string;
  criticalPath: boolean;
};

export async function listDependencies(): Promise<Result<DependencyView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.dependencyLink.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        description: true,
        status: true,
        boardStatus: true,
        criticalPath: true,
        blockingFeature: { select: { title: true } },
        blockedFeature: { select: { title: true } },
      },
    });
    return rows.map((d) => ({
      id: d.id,
      title:
        d.description ??
        `${d.blockingFeature.title} → ${d.blockedFeature.title}`,
      blockingTitle: d.blockingFeature.title,
      blockedTitle: d.blockedFeature.title,
      status: d.status,
      boardStatus: d.boardStatus,
      criticalPath: d.criticalPath,
    }));
  });
}

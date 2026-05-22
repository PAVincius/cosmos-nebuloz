import { database } from "@repo/database";

export type WsjfContext = {
  topFeatures: Array<{
    id: string;
    title: string;
    wsjfScore: number;
    bv: number;
    tc: number;
    rr: number;
    js: number;
    statusId: string;
    storyPoints: number;
    piPlanId: string | null;
  }>;
  recentObjectives: Array<{
    id: string;
    title: string;
    businessValue: number;
    isStretch: boolean;
    status: string;
  }>;
  backlogSize: number;
};

export async function buildWsjfContext(
  tenantId: string,
  opts: { artId?: string; piId?: string } = {}
): Promise<WsjfContext> {
  const { piId } = opts;

  const [topFeatures, recentObjectives, backlogSize] = await Promise.all([
    database.feature.findMany({
      where: {
        tenantId,
        ...(piId ? { piPlanId: piId } : {}),
      },
      orderBy: { wsjfScore: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        wsjfScore: true,
        bv: true,
        tc: true,
        rr: true,
        js: true,
        statusId: true,
        storyPoints: true,
        piPlanId: true,
      },
    }),

    database.pIObjective.findMany({
      where: {
        tenantId,
        ...(piId ? { piPlanId: piId } : {}),
      },
      orderBy: { businessValue: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        businessValue: true,
        isStretch: true,
        status: true,
      },
    }),

    database.feature.count({
      where: {
        tenantId,
        statusId: "BACKLOG",
      },
    }),
  ]);

  return {
    topFeatures,
    recentObjectives,
    backlogSize,
  };
}

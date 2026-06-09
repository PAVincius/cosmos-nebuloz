import { database } from "@repo/database";

export type PIWorkspaceContext = {
  artName: string;
  piName: string;
  piDates: { start: string | null; end: string | null };
  objectives: Array<{
    id: string;
    title: string;
    businessValue: number;
    isStretch: boolean;
    status: string;
    teamId: string | null;
  }>;
  risks: Array<{
    id: string;
    title: string;
    status: string;
    category: string | null;
    impact: string;
    probability: string;
  }>;
  features: Array<{
    id: string;
    title: string;
    status: string | null;
    storyPoints: number | null;
    wsjfScore: number | null;
    blocksCount: number;
    blockedByCount: number;
  }>;
  teams: Array<{ id: string; name: string; velocity: number | null }>;
};

export async function buildPIWorkspaceContext(
  tenantId: string,
  contextRef: { artId?: string; piId?: string }
): Promise<PIWorkspaceContext> {
  const { artId, piId } = contextRef;

  const [art, pi, risks, features, teams] = await Promise.all([
    artId
      ? database.aRT.findFirst({
          where: { id: artId, tenantId },
          select: { name: true },
        })
      : database.aRT.findFirst({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          select: { name: true },
        }),

    piId
      ? database.pIPlan.findFirst({
          where: { id: piId, tenantId },
          include: {
            piObjectives: {
              select: {
                id: true,
                title: true,
                businessValue: true,
                isStretch: true,
                status: true,
                teamId: true,
              },
            },
          },
        })
      : database.pIPlan.findFirst({
          where: { tenantId, ...(artId ? { artId } : {}) },
          orderBy: { createdAt: "desc" },
          include: {
            piObjectives: {
              select: {
                id: true,
                title: true,
                businessValue: true,
                isStretch: true,
                status: true,
                teamId: true,
              },
            },
          },
        }),

    database.risk.findMany({
      where: { tenantId, ...(piId ? { piPlanId: piId } : {}) },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        impact: true,
        probability: true,
      },
      take: 20,
    }),

    database.feature.findMany({
      where: { tenantId, ...(piId ? { piPlanId: piId } : {}) },
      select: {
        id: true,
        title: true,
        statusId: true,
        storyPoints: true,
        wsjfScore: true,
        blocks: { select: { blockedFeatureId: true } },
        blockedBy: { select: { blockingFeatureId: true } },
      },
      take: 40,
    }),

    database.team.findMany({
      where: { tenantId, ...(artId ? { artId } : {}) },
      select: { id: true, name: true, velocity: true },
    }),
  ]);

  return {
    artName: art?.name ?? "ART desconhecida",
    piName: pi?.name ?? "PI não encontrado",
    piDates: {
      start: pi?.startDate?.toISOString().slice(0, 10) ?? null,
      end: pi?.endDate?.toISOString().slice(0, 10) ?? null,
    },
    objectives: pi?.piObjectives ?? [],
    risks: risks.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      category: r.category,
      impact: r.impact,
      probability: r.probability,
    })),
    features: features.map((f) => ({
      id: f.id,
      title: f.title,
      status: f.statusId,
      storyPoints: f.storyPoints,
      wsjfScore: f.wsjfScore,
      blocksCount: f.blocks.length,
      blockedByCount: f.blockedBy.length,
    })),
    teams,
  };
}

export async function getPIWorkspaceSummary(
  tenantId: string,
  contextRef: { artId?: string; piId?: string }
): Promise<string> {
  const ctx = await buildPIWorkspaceContext(tenantId, contextRef);

  const lines: string[] = [
    `ART: ${ctx.artName}`,
    `PI: ${ctx.piName}`,
    `PI Dates: ${ctx.piDates.start ?? "N/A"} → ${ctx.piDates.end ?? "N/A"}`,
    `Teams: ${ctx.teams.length}`,
    `Features: ${ctx.features.length}`,
    `Objectives: ${ctx.objectives.length}`,
    `Risks: ${ctx.risks.length}`,
  ];

  return lines.join("\n");
}

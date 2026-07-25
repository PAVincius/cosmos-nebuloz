"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const BOARD_STATUSES = ["IDENTIFIED", "IN_PROGRESS", "RESOLVED"] as const;
const READ_ONLY_PI_STATES = new Set(["COMMITTED", "CLOSED"]);
const ALLOWED_ROLES_RTE = new Set(["ADMIN", "RTE"]);

type CircularCheckOpts = {
  newBlockingId: string;
  newBlockedId: string;
  tenantId: string;
};

type Tx = Parameters<Parameters<typeof database.$transaction>[0]>[0];

async function detectCircular(
  opts: CircularCheckOpts,
  tx: Tx
): Promise<string[] | null> {
  const { newBlockingId, newBlockedId, tenantId } = opts;
  const visited = new Set<string>();
  const path: string[] = [];

  const dfs = async (nodeId: string): Promise<boolean> => {
    if (nodeId === newBlockedId) {
      path.push(nodeId);
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    path.push(nodeId);

    const deps = await tx.dependencyLink.findMany({
      where: {
        tenantId,
        blockedFeatureId: nodeId,
        boardStatus: { not: "RESOLVED" },
      },
      select: { blockingFeatureId: true },
    });

    for (const dep of deps) {
      if (await dfs(dep.blockingFeatureId)) {
        return true;
      }
    }
    path.pop();
    return false;
  };

  const hasCycle = await dfs(newBlockingId);
  if (hasCycle) {
    path.push(newBlockingId);
    return path;
  }
  return null;
}

const CreateLinkSchema = z
  .object({
    piPlanId: z.string().min(1),
    blockingFeatureId: z.string().min(1),
    blockedFeatureId: z.string().min(1),
    description: z.string().max(500).optional(),
    criticalPath: z.boolean().default(false),
  })
  .refine((d) => d.blockingFeatureId !== d.blockedFeatureId, {
    message: "SELF_LINK",
    path: ["blockedFeatureId"],
  });

export async function createDependencyLink(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateLinkSchema.parse(raw);

    const piPlan = await database.pIPlan.findFirst({
      where: { id: input.piPlanId, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!piPlan) {
      throw new Error("PI_PLAN_NOT_FOUND");
    }
    if (READ_ONLY_PI_STATES.has(piPlan.status)) {
      throw new Error(`PI_READ_ONLY:${piPlan.status}`);
    }

    // Validate both features belong to tenant + PI Plan (IDOR prevention)
    const featureCount = await database.feature.count({
      where: {
        tenantId: ctx.tenantId,
        piPlanId: input.piPlanId,
        id: { in: [input.blockingFeatureId, input.blockedFeatureId] },
      },
    });
    if (featureCount !== 2) {
      throw new Error("FEATURE_NOT_FOUND");
    }

    const chain = await database.$transaction((tx) =>
      detectCircular(
        {
          newBlockingId: input.blockingFeatureId,
          newBlockedId: input.blockedFeatureId,
          tenantId: ctx.tenantId,
        },
        tx
      )
    );

    if (chain) {
      throw new Error(`CIRCULAR_DEPENDENCY:${JSON.stringify(chain)}`);
    }

    const link = await database.dependencyLink.create({
      data: {
        tenantId: ctx.tenantId,
        blockingFeatureId: input.blockingFeatureId,
        blockedFeatureId: input.blockedFeatureId,
        boardStatus: "IDENTIFIED",
        criticalPath: input.criticalPath ?? false,
        ...(input.description !== undefined && {
          description: input.description,
        }),
      },
      select: { id: true },
    });

    revalidatePath("/arts");
    return { id: link.id };
  });
}

const UpdateStatusSchema = z.object({
  linkId: z.string().min(1),
  boardStatus: z.enum(BOARD_STATUSES),
});

export async function updateDependencyBoardStatus(
  raw: unknown
): Promise<Result<{ boardStatus: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_ROLES_RTE.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = UpdateStatusSchema.parse(raw);
    const updated = await database.dependencyLink.updateMany({
      where: { id: input.linkId, tenantId: ctx.tenantId },
      data: { boardStatus: input.boardStatus },
    });

    if (updated.count === 0) {
      throw new Error("LINK_NOT_FOUND");
    }

    revalidatePath("/arts");
    return { boardStatus: input.boardStatus };
  });
}

const GetBoardSchema = z.object({ piPlanId: z.string().min(1) });

export async function getProgramBoardData(raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  const input = GetBoardSchema.parse(raw);

  const [piPlan, features, links] = await Promise.all([
    database.pIPlan.findFirstOrThrow({
      where: { id: input.piPlanId, tenantId: ctx.tenantId },
      include: {
        art: {
          include: {
            teams: { select: { id: true, name: true, velocity: true } },
          },
        },
        sprints: {
          where: { tenantId: ctx.tenantId },
          select: {
            id: true,
            teamId: true,
            name: true,
            startDate: true,
            endDate: true,
            isIPSprint: true,
          },
          orderBy: { startDate: "asc" },
        },
      },
    }),
    database.feature.findMany({
      where: { piPlanId: input.piPlanId, tenantId: ctx.tenantId },
      select: { id: true, title: true, storyPoints: true },
    }),
    database.dependencyLink.findMany({
      where: {
        tenantId: ctx.tenantId,
        boardStatus: { not: "RESOLVED" },
        OR: [
          {
            blockingFeature: {
              piPlanId: input.piPlanId,
            },
          },
          {
            blockedFeature: {
              piPlanId: input.piPlanId,
            },
          },
        ],
      },
      select: {
        id: true,
        blockingFeatureId: true,
        blockedFeatureId: true,
        boardStatus: true,
        criticalPath: true,
      },
    }),
  ]);

  return {
    piPlanId: piPlan.id,
    piPlanStatus: piPlan.status,
    readOnly: READ_ONLY_PI_STATES.has(piPlan.status),
    teams: piPlan.art.teams,
    sprints: piPlan.sprints,
    features,
    dependencyLinks: links,
  };
}

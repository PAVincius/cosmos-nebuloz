"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

// Multi-PI cadence timeline (handoff's MultiPiTimeline, screen-bundle-4.jsx)
// is NOT built here. It needs a PI axis with each ART's current/past PI
// window and stage label — ART only carries a single currentPiPlanId
// pointer (no historical PI series is queryable without fabricating
// dates/windows). Deferred, not faked. ROAM + per-ART progress below are
// both backed by real, tenant-scoped data.

export type SolutionTrainCapabilityView = {
  id: string;
  title: string;
  status: string;
  milestone: string | null;
};

// Per-ART progress breakdown (RF-80 parity). Epic.artId is a plain
// denormalized string with no FK relation (same pattern documented in
// epic-detail.ts / kanban.ts's toKanbanEpic) — resolved via a separate
// tenant-scoped Epic lookup below, not a Prisma include. featureCount /
// doneFeatureCount are Epic's own kept-in-sync denorm counters, so this is
// real feature-completion data, not a fabricated percentage.
export type SolutionTrainArtView = {
  id: string;
  name: string;
  epicCount: number;
  epicDoneCount: number;
  featureCount: number;
  doneFeatureCount: number;
};

const ROAM_STATUSES = ["RESOLVED", "OWNED", "ACCEPTED", "MITIGATED"] as const;
type RoamStatus = (typeof ROAM_STATUSES)[number];

export type SolutionTrainRiskView = {
  id: string;
  title: string;
  roamStatus: RoamStatus;
  owner: string | null;
  affectedArtIds: string[];
};

export type SolutionTrainRoamView = {
  counts: Record<RoamStatus, number>;
  risks: SolutionTrainRiskView[];
};

// Cross-ART dependency links (Story-043's CrossArtDependency). sourceArtId/
// targetArtId are plain scalars with no FK relation, so names are resolved
// against the train's own already-loaded ART list — falls back to the raw
// id if the target ART somehow isn't one of this train's ARTs.
export type SolutionTrainCrossArtDependencyView = {
  id: string;
  sourceArtId: string;
  sourceArtName: string;
  targetArtId: string;
  targetArtName: string;
  type: "PROVIDES" | "NEEDS" | "BLOCKS";
};

export type SolutionTrainView = {
  id: string;
  name: string;
  description: string | null;
  artCount: number;
  epicCount: number;
  capabilityCount: number;
  capabilities: SolutionTrainCapabilityView[];
  arts: SolutionTrainArtView[];
  roam: SolutionTrainRoamView;
  crossArtDependencies: SolutionTrainCrossArtDependencyView[];
};

async function listSolutionTrains(): Promise<Result<SolutionTrainView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const trains = await database.solutionTrain.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        arts: { select: { id: true, name: true } },
        solutionEpics: { select: { id: true } },
        capabilities: {
          select: { id: true, title: true, status: true, milestone: true },
          orderBy: { order: "asc" },
        },
        solutionRisks: {
          where: { tenantId: ctx.tenantId },
          select: {
            id: true,
            title: true,
            roamStatus: true,
            owner: true,
            affectedArtIds: true,
          },
        },
        crossArtDeps: {
          where: { tenantId: ctx.tenantId },
          select: {
            id: true,
            sourceArtId: true,
            targetArtId: true,
            type: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // One extra tenant-scoped query for all ARTs across all trains (not
    // per-row) — avoids N+1 while giving each ART its real epic/feature
    // completion counts.
    const allArtIds = [
      ...new Set(trains.flatMap((t) => t.arts.map((a) => a.id))),
    ];
    const epics =
      allArtIds.length > 0
        ? await database.epic.findMany({
            where: { tenantId: ctx.tenantId, artId: { in: allArtIds } },
            select: {
              artId: true,
              lifecycleStatus: true,
              featureCount: true,
              doneFeatureCount: true,
            },
          })
        : [];

    const epicsByArt = new Map<string, typeof epics>();
    for (const epic of epics) {
      if (!epic.artId) {
        continue;
      }
      const list = epicsByArt.get(epic.artId) ?? [];
      list.push(epic);
      epicsByArt.set(epic.artId, list);
    }

    return trains.map((s) => {
      const artNameById = new Map(s.arts.map((a) => [a.id, a.name]));

      const arts: SolutionTrainArtView[] = s.arts.map((a) => {
        const artEpics = epicsByArt.get(a.id) ?? [];
        return {
          id: a.id,
          name: a.name,
          epicCount: artEpics.length,
          epicDoneCount: artEpics.filter((e) => e.lifecycleStatus === "DONE")
            .length,
          featureCount: artEpics.reduce((sum, e) => sum + e.featureCount, 0),
          doneFeatureCount: artEpics.reduce(
            (sum, e) => sum + e.doneFeatureCount,
            0
          ),
        };
      });

      const roamCounts: Record<RoamStatus, number> = {
        RESOLVED: 0,
        OWNED: 0,
        ACCEPTED: 0,
        MITIGATED: 0,
      };
      for (const risk of s.solutionRisks) {
        roamCounts[risk.roamStatus] += 1;
      }

      return {
        id: s.id,
        name: s.name,
        description: s.description,
        artCount: s.arts.length,
        epicCount: s.solutionEpics.length,
        capabilityCount: s.capabilities.length,
        capabilities: s.capabilities,
        arts,
        roam: {
          counts: roamCounts,
          risks: s.solutionRisks,
        },
        crossArtDependencies: s.crossArtDeps.map((d) => ({
          id: d.id,
          sourceArtId: d.sourceArtId,
          sourceArtName: artNameById.get(d.sourceArtId) ?? d.sourceArtId,
          targetArtId: d.targetArtId,
          targetArtName: artNameById.get(d.targetArtId) ?? d.targetArtId,
          type: d.type,
        })),
      };
    });
  });
}

const CAPABILITY_STATUSES = [
  "BACKLOG",
  "ANALYZING",
  "IMPLEMENTING",
  "DONE",
] as const;

const CreateCapabilitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(CAPABILITY_STATUSES).default("BACKLOG"),
  milestone: z.string().max(200).optional(),
  solutionTrainId: z.string().min(1).optional(),
});

async function createCapability(
  input: z.input<typeof CreateCapabilitySchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { title, description, status, milestone, solutionTrainId } =
      CreateCapabilitySchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied solutionTrainId must belong
    // to this tenant.
    if (solutionTrainId) {
      const train = await database.solutionTrain.findFirst({
        where: { id: solutionTrainId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!train) {
        throw new Error("Solution Train inválido.");
      }
    }

    const created = await database.capability.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        description: description ?? null,
        status,
        milestone: milestone ?? null,
        solutionTrainId: solutionTrainId ?? null,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "capability",
      entityId: created.id,
      diff: { title, status, solutionTrainId },
    });
    revalidateTag(`solution-train:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

export { createCapability, listSolutionTrains };

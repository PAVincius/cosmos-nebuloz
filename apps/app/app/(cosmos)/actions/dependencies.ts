"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type DependencyView = {
  id: string;
  title: string;
  blockingTitle: string;
  blockedTitle: string;
  status: string;
  boardStatus: string;
  criticalPath: boolean;
  // Team that owns the blocking/blocked feature, resolved via
  // Feature.assignedTeamId → Team, tenant-scoped both hops. Null when the
  // feature has no assigned team, or when the assigned team id doesn't
  // resolve inside this tenant (never surfaced from another tenant).
  fromTeamId: string | null;
  fromTeamName: string | null;
  fromTeamColor: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  toTeamColor: string | null;
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
        blockingFeature: { select: { title: true, assignedTeamId: true } },
        blockedFeature: { select: { title: true, assignedTeamId: true } },
      },
    });

    // Feature.assignedTeamId has no declared Prisma relation, so the team
    // name/color must be resolved with a separate, tenant-scoped lookup —
    // this is also the IDOR guard: a foreign-tenant team id simply won't
    // be found in this tenant-scoped query and resolves to null.
    const teamIds = [
      ...new Set(
        rows.flatMap((d) =>
          [
            d.blockingFeature.assignedTeamId,
            d.blockedFeature.assignedTeamId,
          ].filter((id): id is string => id !== null)
        )
      ),
    ];
    const teams = teamIds.length
      ? await database.team.findMany({
          where: { id: { in: teamIds }, tenantId: ctx.tenantId },
          select: { id: true, name: true, color: true },
        })
      : [];
    const teamById = new Map(teams.map((t) => [t.id, t]));

    return rows.map((d) => {
      const fromTeam = d.blockingFeature.assignedTeamId
        ? (teamById.get(d.blockingFeature.assignedTeamId) ?? null)
        : null;
      const toTeam = d.blockedFeature.assignedTeamId
        ? (teamById.get(d.blockedFeature.assignedTeamId) ?? null)
        : null;
      return {
        id: d.id,
        title:
          d.description ??
          `${d.blockingFeature.title} → ${d.blockedFeature.title}`,
        blockingTitle: d.blockingFeature.title,
        blockedTitle: d.blockedFeature.title,
        status: d.status,
        boardStatus: d.boardStatus,
        criticalPath: d.criticalPath,
        fromTeamId: fromTeam?.id ?? null,
        fromTeamName: fromTeam?.name ?? null,
        fromTeamColor: fromTeam?.color ?? null,
        toTeamId: toTeam?.id ?? null,
        toTeamName: toTeam?.name ?? null,
        toTeamColor: toTeam?.color ?? null,
      };
    });
  });
}

const CreateDependencySchema = z.object({
  blockingFeatureId: z.string().min(1),
  blockedFeatureId: z.string().min(1),
  description: z.string().max(2000).optional(),
});

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function createDependency(
  input: z.input<typeof CreateDependencySchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO"], ctx);
    const { blockingFeatureId, blockedFeatureId, description } =
      CreateDependencySchema.parse(input);

    // Cross-tenant IDOR guards — client-supplied FKs must belong to this tenant.
    const blockingFeature = await database.feature.findFirst({
      where: { id: blockingFeatureId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!blockingFeature) {
      throw new Error("Feature bloqueadora inválida.");
    }
    const blockedFeature = await database.feature.findFirst({
      where: { id: blockedFeatureId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!blockedFeature) {
      throw new Error("Feature bloqueada inválida.");
    }

    let created: { id: string };
    try {
      created = await database.dependencyLink.create({
        data: {
          tenantId: ctx.tenantId,
          blockingFeatureId,
          blockedFeatureId,
          description: description ?? null,
        },
        select: { id: true },
      });
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        throw new Error("Já existe uma dependência entre essas features.");
      }
      throw e;
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "dependency",
      entityId: created.id,
      diff: { blockingFeatureId, blockedFeatureId },
    });
    revalidateTag(`dependencies:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

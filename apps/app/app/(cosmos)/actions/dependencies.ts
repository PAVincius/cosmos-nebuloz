"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  buildAdjacency,
  findCyclePath,
} from "@/lib/collaboration/dependency-cycle";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import { DEPENDENCY_BOARD_STATUSES } from "./dependencies.constants";

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

const CreateDependencySchema = z
  .object({
    blockingFeatureId: z.string().min(1),
    blockedFeatureId: z.string().min(1),
    description: z.string().max(2000).optional(),
  })
  // story-058 AC-002 — caso degenerado do ciclo, recusado antes de qualquer
  // consulta. Mesma guarda que app/actions/features/dependencies.ts já faz.
  .refine((d) => d.blockingFeatureId !== d.blockedFeatureId, {
    message: "Uma feature não pode bloquear a si mesma.",
    path: ["blockedFeatureId"],
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

    // story-058 AC-001/AC-003 — dependência circular é plano impossível: com
    // A→B→C, registrar C→A trava as três. Uma consulta tenant-escopada monta o
    // grafo; RESOLVED fica de fora porque bloqueio resolvido não restringe mais
    // a ordem do trabalho (mesma regra do detectCircular de
    // app/actions/features/dependencies.ts).
    const links = await database.dependencyLink.findMany({
      where: { tenantId: ctx.tenantId, boardStatus: { not: "RESOLVED" } },
      select: {
        blockingFeatureId: true,
        blockedFeatureId: true,
        blockingFeature: { select: { id: true, title: true } },
        blockedFeature: { select: { id: true, title: true } },
      },
    });
    const cycle = findCyclePath(
      buildAdjacency(
        links.map((l) => ({
          sourceFeatureId: l.blockingFeatureId,
          targetFeatureId: l.blockedFeatureId,
        }))
      ),
      blockingFeatureId,
      blockedFeatureId
    );
    if (cycle) {
      const titleById = new Map<string, string>();
      for (const l of links) {
        titleById.set(l.blockingFeature.id, l.blockingFeature.title);
        titleById.set(l.blockedFeature.id, l.blockedFeature.title);
      }
      throw new Error(
        `Dependência circular: ${cycle.map((id) => titleById.get(id) ?? id).join(" → ")}`
      );
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

const UpdateDependencyBoardStatusSchema = z.object({
  id: z.string().min(1),
  boardStatus: z.enum(DEPENDENCY_BOARD_STATUSES),
});

// story-058 AC-004 — boardStatus vinha na leitura e nunca era mostrado nem
// avançado, então toda dependência ficava IDENTIFIED para sempre e o quadro
// nunca dizia o que já tinha sido resolvido. RBAC ADMIN|RTE casa com
// updateDependencyBoardStatus de app/actions/features/dependencies.ts.
export async function updateDependencyBoardStatus(
  input: z.input<typeof UpdateDependencyBoardStatusSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE"], ctx);
    const { id, boardStatus } = UpdateDependencyBoardStatusSchema.parse(input);

    // Cross-tenant IDOR guard — o id vem do cliente.
    const existing = await database.dependencyLink.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, boardStatus: true },
    });
    if (!existing) {
      throw new Error("Dependência não encontrada.");
    }

    await database.dependencyLink.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: { boardStatus },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "dependency",
      entityId: id,
      diff: { boardStatus: `${existing.boardStatus}→${boardStatus}` },
    });
    revalidateTag(`dependencies:${ctx.tenantId}`, "max");
    return { id };
  });
}

"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { calculateWSJF } from "@repo/safe-engine";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import { isPiReadOnly } from "./program.constants";

export type ProgramFeatureView = {
  id: string;
  title: string;
  storyPoints: number;
  statusId: string;
  milestone: boolean;
  hasDependency: boolean;
};

// Uma célula do quadro: um time numa sprint do PI. É a forma que
// PIPlanFeatureAssignment já tinha (piPlanId/featureId/teamId/sprintId/rank) e
// que nenhuma tela usava.
export type ProgramBoardCell = {
  sprintId: string;
  sprintName: string;
  features: ProgramFeatureView[];
  assignedSp: number;
  // expectedSpNextSprint do TeamCapacitySnapshot daquela sprint; null quando o
  // time ainda não tem snapshot — capacidade não é inferida da velocity.
  capacitySp: number | null;
  utilizationPct: number | null;
  // story-020 AC-002 — aviso, nunca bloqueio.
  overCapacity: boolean;
};

export type ProgramBoardTeamRow = {
  id: string;
  name: string;
  // Alinhadas a um índice de coluna 1..sprintCount compartilhado, sobre as
  // sprints do PRÓPRIO time (Sprint.teamId), ordenadas por startDate — mesma
  // convenção da grade de capacidade.
  cells: (ProgramBoardCell | null)[];
};

export type ProgramBoardView = {
  piPlanId: string;
  piPlanName: string;
  piPlanStatus: string;
  readOnly: boolean;
  sprintCount: number;
  teams: ProgramBoardTeamRow[];
  // Features do PI que ainda não têm célula. Antes elas simplesmente não
  // apareciam: a tela listava apenas o que tinha assignedTeamId.
  unassigned: ProgramFeatureView[];
};

type FeatureRow = {
  id: string;
  title: string;
  storyPoints: number;
  statusId: string;
  milestone: boolean;
  _count: { blocks: number; blockedBy: number };
};

function toFeatureView(f: FeatureRow): ProgramFeatureView {
  return {
    id: f.id,
    title: f.title,
    storyPoints: f.storyPoints,
    statusId: f.statusId,
    milestone: f.milestone,
    hasDependency: f._count.blocks + f._count.blockedBy > 0,
  };
}

export async function getActiveProgramBoard(): Promise<
  Result<ProgramBoardView | null>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const plan = await database.pIPlan.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ["PLANNING", "COMMITTED", "EXECUTING"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true },
    });
    if (!plan) {
      return null;
    }

    const [features, sprints, assignments] = await Promise.all([
      database.feature.findMany({
        where: { tenantId: ctx.tenantId, piPlanId: plan.id },
        orderBy: { wsjfScore: "desc" },
        select: {
          id: true,
          title: true,
          storyPoints: true,
          statusId: true,
          milestone: true,
          _count: { select: { blocks: true, blockedBy: true } },
        },
      }),
      database.sprint.findMany({
        where: { tenantId: ctx.tenantId, piPlanId: plan.id },
        orderBy: { startDate: "asc" },
        select: { id: true, name: true, teamId: true },
      }),
      database.pIPlanFeatureAssignment.findMany({
        where: { tenantId: ctx.tenantId, piPlanId: plan.id },
        orderBy: { rank: "asc" },
        select: { featureId: true, teamId: true, sprintId: true },
      }),
    ]);

    const teamIds = [...new Set(sprints.map((s) => s.teamId))];
    const [teams, snapshots] = await Promise.all([
      teamIds.length
        ? database.team.findMany({
            where: { id: { in: teamIds }, tenantId: ctx.tenantId },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      sprints.length
        ? database.teamCapacitySnapshot.findMany({
            where: {
              tenantId: ctx.tenantId,
              sprintId: { in: sprints.map((s) => s.id) },
            },
            select: {
              sprintId: true,
              teamId: true,
              expectedSpNextSprint: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const featureById = new Map(features.map((f) => [f.id, f]));
    const sprintById = new Map(sprints.map((s) => [s.id, s]));
    const capacityByCell = new Map(
      snapshots.map((s) => [
        `${s.sprintId}:${s.teamId}`,
        s.expectedSpNextSprint,
      ])
    );

    // Uma atribuição só vale se a célula existe neste PI e neste tenant: sprint
    // conhecida, do time indicado. Atribuição órfã não é renderizada em lugar
    // nenhum — a feature volta para a lista de não atribuídas.
    const cellFeatures = new Map<string, FeatureRow[]>();
    const placed = new Set<string>();
    for (const a of assignments) {
      const feature = featureById.get(a.featureId);
      const sprint = sprintById.get(a.sprintId);
      if (!(feature && sprint) || sprint.teamId !== a.teamId) {
        continue;
      }
      const key = `${a.sprintId}:${a.teamId}`;
      cellFeatures.set(key, [...(cellFeatures.get(key) ?? []), feature]);
      placed.add(a.featureId);
    }

    const sprintsByTeam = new Map<string, typeof sprints>();
    for (const s of sprints) {
      sprintsByTeam.set(s.teamId, [...(sprintsByTeam.get(s.teamId) ?? []), s]);
    }
    const sprintCount = Math.max(
      0,
      ...teams.map((t) => sprintsByTeam.get(t.id)?.length ?? 0)
    );

    const teamRows: ProgramBoardTeamRow[] = teams.map((t) => {
      const teamSprints = sprintsByTeam.get(t.id) ?? [];
      const cells: (ProgramBoardCell | null)[] = [];
      for (let i = 0; i < sprintCount; i++) {
        const sprint = teamSprints[i];
        if (!sprint) {
          cells.push(null);
          continue;
        }
        const rows = cellFeatures.get(`${sprint.id}:${t.id}`) ?? [];
        const assignedSp = rows.reduce((sum, f) => sum + f.storyPoints, 0);
        const capacitySp = capacityByCell.get(`${sprint.id}:${t.id}`) ?? null;
        const utilizationPct =
          capacitySp && capacitySp > 0
            ? Math.round((assignedSp / capacitySp) * 100)
            : null;
        cells.push({
          sprintId: sprint.id,
          sprintName: sprint.name,
          features: rows.map(toFeatureView),
          assignedSp,
          capacitySp,
          utilizationPct,
          overCapacity: utilizationPct !== null && utilizationPct > 100,
        });
      }
      return { id: t.id, name: t.name, cells };
    });

    return {
      piPlanId: plan.id,
      piPlanName: plan.name,
      piPlanStatus: plan.status,
      readOnly: isPiReadOnly(plan.status),
      sprintCount,
      teams: teamRows,
      unassigned: features
        .filter((f) => !placed.has(f.id))
        .map((f) => toFeatureView(f)),
    };
  });
}

const AssignFeatureToCellSchema = z.object({
  featureId: z.string().min(1),
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

// story-020 AC-002/AC-004 — a escrita que faltava. PIPlanFeatureAssignment tem
// exatamente a forma da célula (piPlanId/featureId/teamId/sprintId) e um
// @@unique([piPlanId, featureId]) que garante uma célula por feature por PI: o
// upsert move, nunca duplica.
export async function assignFeatureToCell(
  input: z.input<typeof AssignFeatureToCellSchema>
): Promise<Result<{ featureId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO"], ctx);
    const { featureId, teamId, sprintId } =
      AssignFeatureToCellSchema.parse(input);

    // Cross-tenant IDOR guards — os três ids vêm do cliente.
    const feature = await database.feature.findFirst({
      where: { id: featureId, tenantId: ctx.tenantId },
      select: { id: true, piPlanId: true },
    });
    if (!feature) {
      throw new Error("Feature inválida.");
    }
    if (!feature.piPlanId) {
      throw new Error("A feature não está comprometida em nenhum PI.");
    }

    const plan = await database.pIPlan.findFirst({
      where: { id: feature.piPlanId, tenantId: ctx.tenantId },
      select: { id: true, name: true, status: true },
    });
    if (!plan) {
      throw new Error("PI Plan inválido.");
    }
    if (isPiReadOnly(plan.status)) {
      throw new Error(
        `O PI "${plan.name}" está ${plan.status} — o Program Board é somente leitura.`
      );
    }

    // Sprint tem que ser deste tenant, deste PI e deste time: fora disso a
    // célula não existe no quadro e a atribuição ficaria órfã.
    const sprint = await database.sprint.findFirst({
      where: {
        id: sprintId,
        tenantId: ctx.tenantId,
        piPlanId: plan.id,
        teamId,
      },
      select: { id: true },
    });
    if (!sprint) {
      throw new Error("Sprint inválida para este time neste PI.");
    }

    await database.pIPlanFeatureAssignment.upsert({
      where: { piPlanId_featureId: { piPlanId: plan.id, featureId } },
      update: { teamId, sprintId, updatedBy: ctx.userId },
      create: {
        tenantId: ctx.tenantId,
        piPlanId: plan.id,
        featureId,
        teamId,
        sprintId,
        rank: 0,
        updatedBy: ctx.userId,
      },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "feature",
      entityId: featureId,
      diff: { piPlanId: plan.id, teamId, sprintId },
    });
    revalidateTag(`program:${ctx.tenantId}`, "max");
    return { featureId };
  });
}

const CreateFeatureSchema = z.object({
  title: z.string().min(1).max(200),
  epicId: z.string().optional(),
  assignedTeamId: z.string().optional(),
  bv: z.number().min(0).max(10).default(0),
  tc: z.number().min(0).max(10).default(0),
  rr: z.number().min(0).max(10).default(0),
  js: z.number().min(1).max(10).default(1),
});

export async function createFeature(
  input: z.input<typeof CreateFeatureSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO"], ctx);
    const { title, epicId, assignedTeamId, bv, tc, rr, js } =
      CreateFeatureSchema.parse(input);

    // Cross-tenant IDOR guards — client-supplied FKs must belong to this tenant.
    if (epicId) {
      const epic = await database.epic.findFirst({
        where: { id: epicId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!epic) {
        throw new Error("Épico inválido.");
      }
    }
    if (assignedTeamId) {
      const team = await database.team.findFirst({
        where: { id: assignedTeamId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!team) {
        throw new Error("Time inválido.");
      }
    }

    const wsjfScore = calculateWSJF({ bv, tc, rr, js });

    const created = await database.feature.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        epicId: epicId ?? null,
        assignedTeamId: assignedTeamId ?? null,
        bv,
        tc,
        rr,
        js,
        wsjfScore,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "feature",
      entityId: created.id,
      diff: { title },
    });
    revalidateTag(`program:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

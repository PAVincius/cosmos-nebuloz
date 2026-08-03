"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

export type TeamListView = {
  id: string;
  name: string;
  focusArea: string | null;
  color: string | null;
  wip: number;
  velocity: number | null;
  memberCount: number;
  artId: string | null;
  artName: string | null;
  // Latest TeamCapacitySnapshot for this team (same source getTeam() reads).
  capacity: { expectedSp: number; actualSp: number } | null;
  // Avg actualSpDelivered/expectedSpNextSprint across snapshots with a
  // non-zero expectation — same say-do ratio idea as listTeamPredictability,
  // computed over TeamCapacitySnapshot instead of Sprint rows.
  predictabilityPct: number | null;
};

export type TeamDetailView = {
  id: string;
  name: string;
  focusArea: string | null;
  velocity: number | null;
  wip: number;
  members: { name: string; role: string }[];
  recentCapacity: {
    period: string;
    expectedSp: number;
    actualSp: number;
    utilizationPct: number;
  }[];
  // Closed sprints for this team, newest-first — same shape/source as
  // velocity.ts's listRecentSprints(), scoped to a single team.
  sprints: {
    id: string;
    name: string;
    capacity: number | null;
    velocity: number | null;
  }[];
  // Features assigned to this team (Feature.assignedTeamId), not filtered
  // to any particular PI — there is no "current PI" concept established
  // for team screens yet, so filtering would be a guess.
  features: {
    id: string;
    title: string;
    statusId: string;
    progressPct: number;
  }[];
  // Most recent PIObjective rows for this team (PIObjective.teamId).
  piObjectives: {
    id: string;
    title: string;
    status: string;
    businessValue: number;
    plannedValue: number;
    achievedValue: number;
  }[];
};

function parseMembers(json: unknown): { name: string; role: string }[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json
    .filter(
      (m): m is { name?: unknown; role?: unknown } =>
        typeof m === "object" && m !== null
    )
    .map((m) => ({
      name: typeof m.name === "string" ? m.name : "—",
      role: typeof m.role === "string" ? m.role : "—",
    }));
}

type CapacityAgg = {
  capacity: { expectedSp: number; actualSp: number } | null;
  predictabilityPct: number | null;
};

// Tenant-scoped, keyed by teamId. `rows` must already be sorted newest-first
// (recordedAt desc) so the first row seen per team is the latest snapshot.
function aggregateCapacityByTeam(
  rows: {
    teamId: string;
    expectedSpNextSprint: number;
    actualSpDelivered: number;
  }[]
): Map<string, CapacityAgg> {
  const latest = new Map<string, { expectedSp: number; actualSp: number }>();
  const ratios = new Map<string, number[]>();
  for (const s of rows) {
    if (!latest.has(s.teamId)) {
      latest.set(s.teamId, {
        expectedSp: s.expectedSpNextSprint,
        actualSp: s.actualSpDelivered,
      });
    }
    if (s.expectedSpNextSprint > 0) {
      const list = ratios.get(s.teamId) ?? [];
      list.push((s.actualSpDelivered / s.expectedSpNextSprint) * 100);
      ratios.set(s.teamId, list);
    }
  }
  const out = new Map<string, CapacityAgg>();
  for (const [teamId, capacity] of latest) {
    const list = ratios.get(teamId);
    out.set(teamId, {
      capacity,
      predictabilityPct: list?.length
        ? Math.round(list.reduce((a, b) => a + b, 0) / list.length)
        : null,
    });
  }
  return out;
}

export async function listTeams(): Promise<Result<TeamListView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.team.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        focusArea: true,
        color: true,
        wip: true,
        velocity: true,
        members: true,
        artId: true,
        art: { select: { name: true } },
      },
    });

    const teamIds = rows.map((t) => t.id);
    const snapshots = teamIds.length
      ? await database.teamCapacitySnapshot.findMany({
          where: { tenantId: ctx.tenantId, teamId: { in: teamIds } },
          orderBy: { recordedAt: "desc" },
          select: {
            teamId: true,
            expectedSpNextSprint: true,
            actualSpDelivered: true,
          },
        })
      : [];
    const capacityByTeam = aggregateCapacityByTeam(snapshots);

    return rows.map((t) => {
      const agg = capacityByTeam.get(t.id);
      return {
        id: t.id,
        name: t.name,
        focusArea: t.focusArea,
        color: t.color,
        wip: t.wip,
        velocity: t.velocity,
        memberCount: Array.isArray(t.members) ? t.members.length : 0,
        artId: t.artId,
        artName: t.art?.name ?? null,
        capacity: agg?.capacity ?? null,
        predictabilityPct: agg?.predictabilityPct ?? null,
      };
    });
  });
}

export async function getTeam(
  id: string
): Promise<Result<TeamDetailView | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const team = await database.team.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        name: true,
        focusArea: true,
        velocity: true,
        wip: true,
        members: true,
      },
    });
    if (!team) {
      return null;
    }

    const snapshots = await database.teamCapacitySnapshot.findMany({
      where: { teamId: team.id, tenantId: ctx.tenantId },
      orderBy: { recordedAt: "desc" },
      take: 5,
      select: {
        recordedAt: true,
        expectedSpNextSprint: true,
        actualSpDelivered: true,
        actualCapacityUtil: true,
      },
    });

    const sprints = await database.sprint.findMany({
      where: { tenantId: ctx.tenantId, teamId: team.id, status: "CLOSED" },
      orderBy: { endDate: "desc" },
      take: 8,
      select: { id: true, name: true, capacity: true, velocity: true },
    });

    const features = await database.feature.findMany({
      where: { tenantId: ctx.tenantId, assignedTeamId: team.id },
      orderBy: { wsjfScore: "desc" },
      select: { id: true, title: true, statusId: true, progressPct: true },
    });

    const piObjectives = await database.pIObjective.findMany({
      where: { tenantId: ctx.tenantId, teamId: team.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        businessValue: true,
        plannedValue: true,
        achievedValue: true,
      },
    });

    return {
      id: team.id,
      name: team.name,
      focusArea: team.focusArea,
      velocity: team.velocity,
      wip: team.wip,
      members: parseMembers(team.members),
      recentCapacity: snapshots.map((s) => ({
        period: s.recordedAt.toISOString().slice(0, 10),
        expectedSp: s.expectedSpNextSprint,
        actualSp: s.actualSpDelivered,
        utilizationPct: Math.round(s.actualCapacityUtil * 100),
      })),
      sprints,
      features,
      piObjectives,
    };
  });
}

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(200),
  artId: z.string().min(1).optional(),
});

export async function createTeam(
  input: z.input<typeof CreateTeamSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE"], ctx);
    const { name, artId } = CreateTeamSchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied artId must belong to this tenant.
    if (artId) {
      const art = await database.aRT.findFirst({
        where: { id: artId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!art) {
        throw new Error("ART inválido.");
      }
    }

    const created = await database.team.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        artId: artId ?? null,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "team",
      entityId: created.id,
      diff: { name },
    });
    revalidateTag(`teams:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

const AssignTeamToArtSchema = z.object({
  teamId: z.string().min(1),
  artId: z.string().min(1),
});

// PI Plan cujo compromisso já foi assumido. Mover um time entre ARTs enquanto
// um destes está aberto deixaria os sprints do time pendurados no plano do ART
// antigo — é a story-017 AC-002 ("mudança estrutural bloqueada com PI ativo")
// aplicada ao outro lado da relação ART↔time.
const ACTIVE_PI_STATUSES = ["COMMITTED", "EXECUTING"];

// story-056 AC-002/AC-003 — "Team management" da DoD da story-017. Sem isto,
// `artId` só pode ser definido na criação e um squad fora de ART fica fora de
// todo PI Plan sem caminho de conserto.
export async function assignTeamToArt(
  input: z.input<typeof AssignTeamToArtSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE"], ctx);
    const { teamId, artId } = AssignTeamToArtSchema.parse(input);

    // Cross-tenant IDOR guards — os dois ids vêm do cliente e são reconferidos
    // dentro do tenant antes de qualquer escrita.
    const team = await database.team.findFirst({
      where: { id: teamId, tenantId: ctx.tenantId },
      select: { id: true, artId: true },
    });
    if (!team) {
      throw new Error("Time inválido.");
    }
    const art = await database.aRT.findFirst({
      where: { id: artId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!art) {
      throw new Error("ART inválido.");
    }

    // Reafirmar o vínculo existente não é mudança estrutural: nada a gravar e
    // nenhum guard a consultar.
    if (team.artId === artId) {
      return { id: team.id };
    }

    // Só realinhamento pode estragar sprint comprometido — um time que nunca
    // teve ART não tem sprint em PI Plan algum para deixar órfão.
    if (team.artId !== null) {
      const activeSprint = await database.sprint.findFirst({
        where: {
          tenantId: ctx.tenantId,
          teamId: team.id,
          piPlan: { status: { in: ACTIVE_PI_STATUSES } },
        },
        select: { piPlan: { select: { name: true, status: true } } },
      });
      if (activeSprint?.piPlan) {
        throw new Error(
          `Não é possível mover o time enquanto o PI "${activeSprint.piPlan.name}" está ${activeSprint.piPlan.status}.`
        );
      }
    }

    await database.team.update({
      where: { id: team.id },
      data: { artId },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "art_linked",
      entityType: "team",
      entityId: team.id,
      diff: { artId: `${team.artId ?? "—"}→${artId}` },
    });
    revalidateTag(`teams:${ctx.tenantId}`, "max");
    return { id: team.id };
  });
}

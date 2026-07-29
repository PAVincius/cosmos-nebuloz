"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import { CAPACITY_NOTE_TONES } from "./capacity.constants";

export type CapacityView = {
  teamId: string;
  teamName: string;
  velocity: number | null;
  expectedSp: number | null;
  actualSp: number | null;
  utilizationPct: number | null;
};

export async function listTeamCapacity(): Promise<Result<CapacityView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const teams = await database.team.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true, velocity: true },
    });
    if (teams.length === 0) {
      return [];
    }

    const teamIds = teams.map((t) => t.id);
    const snapshots = await database.teamCapacitySnapshot.findMany({
      where: { tenantId: ctx.tenantId, teamId: { in: teamIds } },
      orderBy: { recordedAt: "desc" },
      select: {
        teamId: true,
        expectedSpNextSprint: true,
        actualSpDelivered: true,
        actualCapacityUtil: true,
        recordedAt: true,
      },
    });

    const latestByTeam = new Map<string, (typeof snapshots)[number]>();
    for (const s of snapshots) {
      if (!latestByTeam.has(s.teamId)) {
        latestByTeam.set(s.teamId, s);
      }
    }

    return teams.map((t) => {
      const snap = latestByTeam.get(t.id);
      return {
        teamId: t.id,
        teamName: t.name,
        velocity: t.velocity,
        expectedSp: snap?.expectedSpNextSprint ?? null,
        actualSp: snap?.actualSpDelivered ?? null,
        utilizationPct: snap ? Math.round(snap.actualCapacityUtil * 100) : null,
      };
    });
  });
}

export type CapacityGridCell = {
  sprintName: string;
  expectedSp: number | null;
  actualSp: number | null;
  utilizationPct: number | null;
};

export type CapacityGridRow = {
  teamId: string;
  teamName: string;
  // Aligned to a shared 1..sprintCount column index — each team's OWN
  // sprints (by piPlanId), ordered by startDate. Teams with fewer sprints
  // in this PI than sprintCount get null cells for the missing columns.
  cells: (CapacityGridCell | null)[];
};

export type CapacityGridView = {
  piPlanId: string;
  piPlanName: string;
  sprintCount: number;
  rows: CapacityGridRow[];
};

// Per-sprint capacity grid across the active PI (team rows × sprint
// columns) — a sibling of listTeamCapacity's latest-per-team dedup, which
// stays as-is for the KPI table above the grid.
export async function listTeamCapacityAcrossPI(): Promise<
  Result<CapacityGridView | null>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    // Same "active PI" convention as getActiveProgramBoard.
    const plan = await database.pIPlan.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ["PLANNING", "COMMITTED", "EXECUTING"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    });
    if (!plan) {
      return null;
    }

    const sprints = await database.sprint.findMany({
      where: { tenantId: ctx.tenantId, piPlanId: plan.id },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, teamId: true },
    });
    if (sprints.length === 0) {
      return {
        piPlanId: plan.id,
        piPlanName: plan.name,
        sprintCount: 0,
        rows: [],
      };
    }

    const teamIds = [...new Set(sprints.map((s) => s.teamId))];
    const [teams, snapshots] = await Promise.all([
      database.team.findMany({
        where: { tenantId: ctx.tenantId, id: { in: teamIds } },
        select: { id: true, name: true },
      }),
      database.teamCapacitySnapshot.findMany({
        where: {
          tenantId: ctx.tenantId,
          sprintId: { in: sprints.map((s) => s.id) },
        },
        select: {
          sprintId: true,
          teamId: true,
          expectedSpNextSprint: true,
          actualSpDelivered: true,
          actualCapacityUtil: true,
        },
      }),
    ]);

    const snapByKey = new Map(
      snapshots.map((s) => [`${s.sprintId}:${s.teamId}`, s])
    );

    const sprintsByTeam = new Map<string, typeof sprints>();
    for (const s of sprints) {
      const arr = sprintsByTeam.get(s.teamId) ?? [];
      arr.push(s);
      sprintsByTeam.set(s.teamId, arr);
    }

    const sprintCount = Math.max(
      0,
      ...teams.map((t) => sprintsByTeam.get(t.id)?.length ?? 0)
    );

    const rows: CapacityGridRow[] = teams.map((t) => {
      const teamSprints = sprintsByTeam.get(t.id) ?? [];
      const cells: (CapacityGridCell | null)[] = [];
      for (let i = 0; i < sprintCount; i++) {
        const sprint = teamSprints[i];
        if (!sprint) {
          cells.push(null);
          continue;
        }
        const snap = snapByKey.get(`${sprint.id}:${t.id}`);
        cells.push({
          sprintName: sprint.name,
          expectedSp: snap?.expectedSpNextSprint ?? null,
          actualSp: snap?.actualSpDelivered ?? null,
          utilizationPct: snap
            ? Math.round(snap.actualCapacityUtil * 100)
            : null,
        });
      }
      return { teamId: t.id, teamName: t.name, cells };
    });

    return { piPlanId: plan.id, piPlanName: plan.name, sprintCount, rows };
  });
}

// ── Capacity adjustment notes ──
// Free-text annotations explaining a sprint's capacity variance (training,
// holiday, onboarding, hiring), surfaced next to the per-team capacity grid.

export type CapacityAdjustmentNoteView = {
  id: string;
  teamId: string;
  teamName: string;
  sprintId: string | null;
  sprintName: string | null;
  text: string;
  tone: string;
  createdAt: string;
};

export async function listCapacityAdjustmentNotes(): Promise<
  Result<CapacityAdjustmentNoteView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const notes = await database.capacityAdjustmentNote.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        teamId: true,
        sprintId: true,
        text: true,
        tone: true,
        createdAt: true,
      },
    });
    if (notes.length === 0) {
      return [];
    }

    const teamIds = [...new Set(notes.map((n) => n.teamId))];
    const sprintIds = [
      ...new Set(
        notes.map((n) => n.sprintId).filter((id): id is string => id !== null)
      ),
    ];

    const [teams, sprints] = await Promise.all([
      database.team.findMany({
        where: { tenantId: ctx.tenantId, id: { in: teamIds } },
        select: { id: true, name: true },
      }),
      sprintIds.length > 0
        ? database.sprint.findMany({
            where: { tenantId: ctx.tenantId, id: { in: sprintIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
    const sprintNameById = new Map(sprints.map((s) => [s.id, s.name]));

    return notes.map((n) => ({
      id: n.id,
      teamId: n.teamId,
      teamName: teamNameById.get(n.teamId) ?? "—",
      sprintId: n.sprintId,
      sprintName: n.sprintId ? (sprintNameById.get(n.sprintId) ?? "—") : null,
      text: n.text,
      tone: n.tone,
      createdAt: n.createdAt.toISOString(),
    }));
  });
}

export type TeamSprintOption = { id: string; name: string };

// Sprint options for the "add note" modal's period picker — scoped to the
// selected team so an invalid cross-team sprintId can never be chosen.
export async function listTeamSprints(
  teamId: string
): Promise<Result<TeamSprintOption[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const sprints = await database.sprint.findMany({
      where: { tenantId: ctx.tenantId, teamId },
      orderBy: { startDate: "desc" },
      take: 20,
      select: { id: true, name: true },
    });
    return sprints;
  });
}

const CreateCapacityAdjustmentNoteSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1).optional(),
  text: z.string().min(1).max(500),
  tone: z.enum(CAPACITY_NOTE_TONES).default("neutral"),
});

export async function createCapacityAdjustmentNote(
  input: z.infer<typeof CreateCapacityAdjustmentNoteSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    // No existing capacity mutation to match (teamCapacitySnapshot.create has
    // zero production call sites) — ADMIN/RTE/SM matches who plans/edits
    // capacity elsewhere in the org (RTE runs PI planning, SM owns the sprint).
    requireRole(["ADMIN", "RTE", "SM"], ctx);
    const { teamId, sprintId, text, tone } =
      CreateCapacityAdjustmentNoteSchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied FKs must belong to this tenant.
    const team = await database.team.findFirst({
      where: { id: teamId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!team) {
      throw new Error("Time inválido.");
    }
    if (sprintId) {
      const sprint = await database.sprint.findFirst({
        where: { id: sprintId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!sprint) {
        throw new Error("Sprint inválido.");
      }
    }

    const created = await database.capacityAdjustmentNote.create({
      data: {
        tenantId: ctx.tenantId,
        teamId,
        sprintId: sprintId ?? null,
        text,
        tone,
        createdById: ctx.userId,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "CapacityAdjustmentNote",
      entityId: created.id,
      diff: { teamId, text },
    });
    revalidateTag(`capacity:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

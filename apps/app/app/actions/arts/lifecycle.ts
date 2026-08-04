"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";
import { syncARTCurrentPI } from "../_denorm";

// ─── Fibonacci guard for sprint counts ───────────────────────────────────────

const ALLOWED_ROLES_RTE = new Set(["ADMIN", "RTE"]);

// ─── ART CRUD ─────────────────────────────────────────────────────────────────

const CreateARTSchema = z.object({
  name: z.string().min(1).max(100),
  piCadenceWeeks: z.number().int().min(2).max(52).default(10),
  sprintLengthWeeks: z.number().int().min(1).max(4).default(2),
  ipSprintEnabled: z.boolean().default(true),
});

export async function createART(
  raw: unknown
): Promise<Result<{ id: string; name: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_ROLES_RTE.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = CreateARTSchema.parse(raw);

    const existing = await database.aRT.findFirst({
      where: {
        tenantId: ctx.tenantId,
        name: { equals: input.name, mode: "insensitive" },
      },
    });
    if (existing) {
      throw new Error("ART_NAME_CONFLICT");
    }

    const art = await database.aRT.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        piCadenceWeeks: input.piCadenceWeeks,
        sprintLengthWeeks: input.sprintLengthWeeks,
        ipSprintEnabled: input.ipSprintEnabled,
        status: "INACTIVE",
      },
      select: { id: true, name: true },
    });

    revalidatePath("/arts");
    return art;
  });
}

const UpdateARTCadenceSchema = z.object({
  artId: z.string().min(1),
  piCadenceWeeks: z.number().int().min(2).max(52).optional(),
  sprintLengthWeeks: z.number().int().min(1).max(4).optional(),
  ipSprintEnabled: z.boolean().optional(),
});

export async function updateARTCadence(
  raw: unknown
): Promise<Result<{ updated: true }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_ROLES_RTE.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = UpdateARTCadenceSchema.parse(raw);

    const activePi = await database.pIPlan.findFirst({
      where: {
        artId: input.artId,
        tenantId: ctx.tenantId,
        status: { in: ["COMMITTED", "EXECUTING"] },
      },
    });
    if (activePi) {
      throw new Error("ACTIVE_PI_PLAN");
    }

    const updated = await database.aRT.updateMany({
      where: { id: input.artId, tenantId: ctx.tenantId },
      data: {
        ...(input.piCadenceWeeks !== undefined && {
          piCadenceWeeks: input.piCadenceWeeks,
        }),
        ...(input.sprintLengthWeeks !== undefined && {
          sprintLengthWeeks: input.sprintLengthWeeks,
        }),
        ...(input.ipSprintEnabled !== undefined && {
          ipSprintEnabled: input.ipSprintEnabled,
        }),
      },
    });
    if (updated.count === 0) {
      throw new Error("ART_NOT_FOUND");
    }

    revalidatePath("/arts");
    return { updated: true };
  });
}

// ─── PI Plan lifecycle ────────────────────────────────────────────────────────

type SprintGenOpts = {
  piPlanId: string;
  tenantId: string;
  startDate: Date;
  piCadenceWeeks: number;
  sprintLengthWeeks: number;
  ipSprintEnabled: boolean;
};

function generateSprints(opts: SprintGenOpts) {
  const {
    piPlanId,
    tenantId,
    startDate,
    piCadenceWeeks,
    sprintLengthWeeks,
    ipSprintEnabled,
  } = opts;
  const regularCount = ipSprintEnabled
    ? Math.floor(piCadenceWeeks / sprintLengthWeeks) - 1
    : Math.floor(piCadenceWeeks / sprintLengthWeeks);

  const sprintMs = sprintLengthWeeks * 7 * 24 * 3_600_000;

  const sprints = Array.from({ length: regularCount }, (_, i) => ({
    tenantId,
    piPlanId,
    name: `Sprint ${i + 1}`,
    isIPSprint: false,
    status: "PLANNING",
    startDate: new Date(startDate.getTime() + i * sprintMs),
    endDate: new Date(startDate.getTime() + (i + 1) * sprintMs - 1),
  }));

  if (ipSprintEnabled) {
    sprints.push({
      tenantId,
      piPlanId,
      name: "IP Sprint",
      isIPSprint: true,
      status: "PLANNING",
      startDate: new Date(startDate.getTime() + regularCount * sprintMs),
      endDate: new Date(
        startDate.getTime() + (regularCount + 1) * sprintMs - 1
      ),
    });
  }

  return sprints;
}

const CreatePIPlanWithSprintsSchema = z.object({
  artId: z.string().min(1),
  name: z.string().min(1).max(100),
  startDate: z.string().datetime(),
});

export async function createPIPlanWithSprints(
  raw: unknown
): Promise<Result<{ id: string; sprintCount: number }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_ROLES_RTE.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = CreatePIPlanWithSprintsSchema.parse(raw);

    const art = await database.aRT.findFirstOrThrow({
      where: { id: input.artId, tenantId: ctx.tenantId },
      include: { teams: { select: { id: true } } },
    });

    if (art.teams.length === 0) {
      throw new Error("ART_NO_TEAMS");
    }

    const startDate = new Date(input.startDate);
    const piMs = art.piCadenceWeeks * 7 * 24 * 3_600_000;
    const endDate = new Date(startDate.getTime() + piMs);

    const sprintTemplate = generateSprints({
      piPlanId: "",
      tenantId: ctx.tenantId,
      startDate,
      piCadenceWeeks: art.piCadenceWeeks,
      sprintLengthWeeks: art.sprintLengthWeeks,
      ipSprintEnabled: art.ipSprintEnabled,
    });

    const piPlan = await database.$transaction(async (tx) => {
      const plan = await tx.pIPlan.create({
        data: {
          tenantId: ctx.tenantId,
          artId: input.artId,
          name: input.name,
          startDate,
          endDate,
          status: "DRAFT",
        },
        select: { id: true },
      });

      const sprintsWithId = art.teams.flatMap((team) =>
        sprintTemplate.map((s) => ({
          ...s,
          piPlanId: plan.id,
          teamId: team.id,
        }))
      );
      await tx.sprint.createMany({ data: sprintsWithId });

      return plan;
    });

    revalidatePath(`/arts/${input.artId}`);
    return { id: piPlan.id, sprintCount: sprintTemplate.length };
  });
}

// ─── PI Plan transitions ──────────────────────────────────────────────────────

const TransitionSchema = z.object({
  piPlanId: z.string().min(1),
  event: z.enum([
    "OPEN_PLANNING",
    "COMMIT",
    "FORCE_COMMIT",
    "START_EXECUTING",
    "CLOSE",
  ]),
  overrideReason: z.string().min(20).max(500).optional(),
});

const VALID_TRANSITIONS: Record<string, string> = {
  OPEN_PLANNING: "DRAFT",
  COMMIT: "PLANNING",
  FORCE_COMMIT: "PLANNING",
  START_EXECUTING: "COMMITTED",
  CLOSE: "EXECUTING",
};

const NEXT_STATUS: Record<string, string> = {
  OPEN_PLANNING: "PLANNING",
  COMMIT: "COMMITTED",
  FORCE_COMMIT: "COMMITTED",
  START_EXECUTING: "EXECUTING",
  CLOSE: "CLOSED",
};

export async function transitionPIPlan(
  raw: unknown
): Promise<Result<{ status: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_ROLES_RTE.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = TransitionSchema.parse(raw);

    const piPlan = await database.pIPlan.findFirstOrThrow({
      where: { id: input.piPlanId, tenantId: ctx.tenantId },
    });

    const requiredStatus = VALID_TRANSITIONS[input.event];
    if (piPlan.status !== requiredStatus) {
      throw new Error(`INVALID_TRANSITION:${piPlan.status}→${input.event}`);
    }

    if (input.event === "COMMIT" || input.event === "FORCE_COMMIT") {
      await validateCommitmentGate({
        piPlanId: input.piPlanId,
        tenantId: ctx.tenantId,
        confidenceThreshold: piPlan.confidenceThreshold,
        isForce: input.event === "FORCE_COMMIT",
        overrideReason: input.overrideReason,
      });
    }

    const nextStatus = NEXT_STATUS[input.event];
    const isForceCommit = input.event === "FORCE_COMMIT";
    const isClosed = nextStatus === "CLOSED";

    await database.$transaction(async (tx) => {
      await tx.pIPlan.update({
        where: { id: input.piPlanId },
        data: {
          status: nextStatus,
          ...(isForceCommit && {
            commitmentOverride: true,
            commitmentOverrideReason: input.overrideReason,
          }),
          ...(isClosed && { closedAt: new Date() }),
        },
      });

      await tx.stateTransitionHistory.create({
        data: {
          tenantId: ctx.tenantId,
          entityType: "PIPlan",
          entityId: input.piPlanId,
          fromStatus: piPlan.status,
          toStatus: nextStatus,
          userId: ctx.userId,
          reason: isForceCommit
            ? `FORCE_COMMIT: ${input.overrideReason}`
            : undefined,
        },
      });

      if (isClosed) {
        await computeAchievedValues(tx, input.piPlanId, ctx.tenantId);
        await lockLeanBudgets(tx, input.piPlanId, ctx.tenantId);
      }
    });

    revalidatePath("/arts");
    void syncARTCurrentPI(piPlan.artId, ctx.tenantId);
    return { status: nextStatus };
  });
}

type CommitGateOpts = {
  piPlanId: string;
  tenantId: string;
  confidenceThreshold: number;
  isForce: boolean;
  overrideReason?: string;
};

async function validateCommitmentGate(opts: CommitGateOpts) {
  const { piPlanId, tenantId, confidenceThreshold, isForce, overrideReason } =
    opts;
  const [objectives, risks, confidenceSession] = await Promise.all([
    database.pIObjective.findMany({
      where: { piPlanId, tenantId },
      select: { plannedValue: true },
    }),
    database.risk.findMany({
      where: { piPlanId, tenantId },
      select: { roamStatus: true },
    }),
    database.pISession.findFirst({
      where: { piPlanId, tenantId, type: "CONFIDENCE_VOTE" },
      include: {
        confidenceSessions: {
          orderBy: { roundNumber: "desc" },
          take: 1,
          select: { averageScore: true },
        },
      },
    }),
  ]);

  const missingPlannedValue = objectives.filter(
    (o) => o.plannedValue === null
  ).length;
  const unroamedRisks = risks.filter(
    (r) => !r.roamStatus || r.roamStatus === "IDENTIFIED"
  ).length;
  const avgScore =
    confidenceSession?.confidenceSessions[0]?.averageScore ?? null;

  const confidenceOk = avgScore === null || avgScore >= confidenceThreshold;

  if (isForce) {
    if (!overrideReason || overrideReason.length < 20) {
      throw new Error("FORCE_COMMIT_REASON_TOO_SHORT");
    }
    if (missingPlannedValue > 0 || unroamedRisks > 0) {
      throw new Error("FORCE_COMMIT_PREREQUISITES_NOT_MET");
    }
    return;
  }

  const errors: string[] = [];
  if (missingPlannedValue > 0) {
    errors.push(`MISSING_PLANNED_VALUE:${missingPlannedValue}`);
  }
  if (unroamedRisks > 0) {
    errors.push(`UNROAMED_RISKS:${unroamedRisks}`);
  }
  if (!confidenceOk) {
    errors.push(`LOW_CONFIDENCE:${avgScore}:required:${confidenceThreshold}`);
  }

  if (errors.length > 0) {
    throw new Error(`COMMITMENT_GATE_FAILED:${errors.join("|")}`);
  }
}

/**
 * story-017 AC-005 — `LeanBudget.immutableAt` é comentado no schema como "set
 * when PI closes" e, até aqui, nunca era gravado por ninguém: a lógica existia
 * em `lockBudgetOnPIClose` (app/actions/portfolio/leanBudget.ts) sem um único
 * chamador, e o orçamento de um PI fechado seguia editável para sempre.
 *
 * Mora dentro da transação do fecho, e não numa ação avulsa, porque o
 * congelamento tem de ser atômico com ele: ou o PI fecha com os orçamentos
 * travados, ou nada acontece. `immutableAt: null` no filtro garante que
 * reabrir e fechar de novo não reescreva o carimbo do primeiro fecho — a data
 * que vale é a do congelamento original.
 */
async function lockLeanBudgets(
  tx: Parameters<Parameters<typeof database.$transaction>[0]>[0],
  piPlanId: string,
  tenantId: string
) {
  await tx.leanBudget.updateMany({
    where: { tenantId, piPlanId, immutableAt: null },
    data: { immutableAt: new Date() },
  });
}

async function computeAchievedValues(
  tx: Parameters<Parameters<typeof database.$transaction>[0]>[0],
  piPlanId: string,
  tenantId: string
) {
  const sprints = await tx.sprint.findMany({
    where: { piPlanId, tenantId },
    include: {
      review: { select: { acceptedPoints: true } },
    },
  });

  const teamVelocity: Record<string, number> = {};
  for (const sprint of sprints) {
    if (sprint.review) {
      teamVelocity[sprint.teamId] =
        (teamVelocity[sprint.teamId] ?? 0) +
        (sprint.review.acceptedPoints ?? 0);
    }
  }

  const totalVelocity = Object.values(teamVelocity).reduce(
    (sum, v) => sum + v,
    0
  );
  if (totalVelocity > 0) {
    await tx.pIPlan.update({
      where: { id: piPlanId },
      data: { velocity: totalVelocity },
    });
  }
}

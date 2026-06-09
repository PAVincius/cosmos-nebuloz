"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const ALLOWED_ROLES_RTE = new Set(["ADMIN", "RTE"]);

async function generateArtScopedId(
  artId: string,
  tenantId: string,
  type: "FEATURE" | "ENABLER",
  tx: Parameters<Parameters<typeof database.$transaction>[0]>[0]
): Promise<string> {
  const counter = await tx.artSequenceCounter.upsert({
    where: { artId_type: { artId, type } },
    update: { next: { increment: 1 } },
    create: { artId, tenantId, type, next: 2 },
    select: { next: true },
  });
  const prefix = type === "FEATURE" ? "F" : "E";
  return `${prefix}-${String(counter.next - 1).padStart(3, "0")}`;
}

type ReadinessCriterion = {
  key: string;
  pass: boolean;
  hint: string;
};

async function computeReadiness(
  featureId: string,
  tenantId: string
): Promise<{ pass: boolean; criteria: ReadinessCriterion[] }> {
  const feature = await database.feature.findFirstOrThrow({
    where: { id: featureId, tenantId },
    select: {
      wsjfScore: true,
      wsjfConfidence: true,
      acceptanceCriteria: true,
      epicId: true,
      assignedTeamId: true,
      piPlanId: true,
    },
  });

  const [openDeps, criticalRisks] = await Promise.all([
    database.dependencyLink.count({
      where: {
        tenantId,
        blockedFeatureId: featureId,
        boardStatus: "IDENTIFIED",
      },
    }),
    feature.piPlanId
      ? database.risk.count({
          where: {
            tenantId,
            piPlanId: feature.piPlanId,
            severity: { gte: 4 },
            roamStatus: "UNCLASSIFIED",
          },
        })
      : Promise.resolve(0),
  ]);

  const acCount = Array.isArray(feature.acceptanceCriteria)
    ? (feature.acceptanceCriteria as unknown[]).length
    : 0;

  const criteria: ReadinessCriterion[] = [
    {
      key: "wsjf",
      pass:
        feature.wsjfScore !== null &&
        feature.wsjfConfidence !== null &&
        feature.wsjfConfidence !== "LOW",
      hint: "Go to WSJF tab to add a score",
    },
    {
      key: "ac",
      pass: acCount >= 3,
      hint: "Add at least 3 acceptance criteria",
    },
    {
      key: "epic",
      pass: feature.epicId !== null,
      hint: "Link this feature to an Epic",
    },
    {
      key: "team",
      pass: feature.assignedTeamId !== null,
      hint: "Assign to a team in the Details tab",
    },
    {
      key: "deps",
      pass: openDeps === 0,
      hint: "Resolve open blocking dependencies first",
    },
    {
      key: "risks",
      pass: criticalRisks === 0,
      hint: "ROAM all high-severity (≥4) unclassified risks in this PI",
    },
  ];

  return { pass: criteria.every((c) => c.pass), criteria };
}

const CreateARTFeatureSchema = z.object({
  artId: z.string().min(1),
  epicId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  piPlanId: z.string().optional(),
});

export async function createARTFeature(
  raw: unknown
): Promise<Result<{ id: string; artScopedId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateARTFeatureSchema.parse(raw);

    const [epic, art] = await Promise.all([
      database.epic.findFirst({
        where: { id: input.epicId, tenantId: ctx.tenantId },
        select: { id: true },
      }),
      database.aRT.findFirst({
        where: { id: input.artId, tenantId: ctx.tenantId },
        select: { id: true },
      }),
    ]);

    if (!epic) {
      throw new Error("EPIC_LINK_REQUIRED");
    }
    if (!art) {
      throw new Error("ART_NOT_FOUND");
    }

    const feature = await database.$transaction(async (tx) => {
      const artScopedId = await generateArtScopedId(
        input.artId,
        ctx.tenantId,
        "FEATURE",
        tx
      );
      return tx.feature.create({
        data: {
          tenantId: ctx.tenantId,
          epicId: input.epicId,
          title: input.title,
          artScopedId,
          statusId: "DEFINED",
          ...(input.piPlanId !== undefined && { piPlanId: input.piPlanId }),
        },
        select: { id: true, artScopedId: true },
      });
    });

    revalidatePath(`/arts/${input.artId}`);
    return { id: feature.id, artScopedId: feature.artScopedId ?? "" };
  });
}

const EvaluateReadinessSchema = z.object({ featureId: z.string().min(1) });

export async function evaluateFeatureReadiness(raw: unknown): Promise<
  Result<{
    pass: boolean;
    criteria: ReadinessCriterion[];
    failures: ReadinessCriterion[];
  }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = EvaluateReadinessSchema.parse(raw);

    const result = await computeReadiness(input.featureId, ctx.tenantId);
    return {
      ...result,
      failures: result.criteria.filter((c) => !c.pass),
    };
  });
}

export async function markFeatureReady(
  raw: unknown
): Promise<Result<{ status: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = EvaluateReadinessSchema.parse(raw);

    const { pass, criteria } = await computeReadiness(
      input.featureId,
      ctx.tenantId
    );
    if (!pass) {
      const failing = criteria
        .filter((c) => !c.pass)
        .map((c) => c.key)
        .join(",");
      throw new Error(`READINESS_GATE_FAILED:${failing}`);
    }

    const updated = await database.feature.updateMany({
      where: { id: input.featureId, tenantId: ctx.tenantId },
      data: { statusId: "READY" },
    });

    if (updated.count === 0) {
      throw new Error("FEATURE_NOT_FOUND");
    }

    revalidatePath("/arts");
    return { status: "READY" };
  });
}

const OverrideReadinessSchema = z.object({
  featureId: z.string().min(1),
  justification: z.string().min(20).max(1000),
});

export async function overrideFeatureReadiness(
  raw: unknown
): Promise<Result<{ status: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_ROLES_RTE.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = OverrideReadinessSchema.parse(raw);

    await database.$transaction(async (tx) => {
      const updated = await tx.feature.updateMany({
        where: { id: input.featureId, tenantId: ctx.tenantId },
        data: {
          statusId: "READY",
          readinessOverridden: true,
          readinessOverrideNote: input.justification,
          readinessOverrideBy: ctx.userId,
          readinessOverrideAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new Error("FEATURE_NOT_FOUND");
      }

      await tx.decisionLogEntry.create({
        data: {
          tenantId: ctx.tenantId,
          tipo: "READINESS_OVERRIDE",
          targetType: "feature",
          targetId: input.featureId,
          decisao: "override",
          justificativa: input.justification,
          decisorId: ctx.userId,
        },
      });
    });

    revalidatePath("/arts");
    return { status: "READY" };
  });
}

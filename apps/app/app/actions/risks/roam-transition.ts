"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const ROAM_STATUSES = [
  "UNCLASSIFIED",
  "RESOLVED",
  "OWNED",
  "ACCEPTED",
  "MITIGATED",
] as const;

type RoamStatus = (typeof ROAM_STATUSES)[number];

const TransitionSchema = z.object({
  riskId: z.string().min(1),
  roamStatus: z.enum(ROAM_STATUSES),
  ownerId: z.string().optional(),
  mitigationPlan: z.string().optional(),
  resolutionNote: z.string().optional(),
});

function validateRoamGuard(
  toStatus: RoamStatus,
  input: {
    ownerId?: string;
    mitigationPlan?: string;
    resolutionNote?: string;
  }
): string | null {
  if (toStatus === "OWNED" && !input.ownerId) {
    return "ownerRequired";
  }
  if (toStatus === "MITIGATED" && (input.mitigationPlan?.length ?? 0) < 30) {
    return "mitigationPlanRequired";
  }
  if (toStatus === "RESOLVED" && !input.resolutionNote) {
    return "resolutionNoteRequired";
  }
  return null;
}

export async function roamTransitionRisk(
  raw: unknown
): Promise<Result<{ roamStatus: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = TransitionSchema.parse(raw);

    const guardError = validateRoamGuard(input.roamStatus, {
      ownerId: input.ownerId,
      mitigationPlan: input.mitigationPlan,
      resolutionNote: input.resolutionNote,
    });

    if (guardError) {
      throw new Error(`ROAM_GUARD:${guardError}`);
    }

    // Cross-tenant IDOR guard — the ROAM owner is addressed by user id.
    if (input.ownerId) {
      const owner = await database.tenantMember.findFirst({
        where: { userId: input.ownerId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!owner) {
        throw new Error("OWNER_NOT_IN_TENANT");
      }
    }

    const now = new Date();
    const risk = await database.risk.updateMany({
      where: { id: input.riskId, tenantId: ctx.tenantId },
      data: {
        roamStatus: input.roamStatus,
        status:
          input.roamStatus === "UNCLASSIFIED" ? "IDENTIFIED" : input.roamStatus,
        ...(input.ownerId && { ownerId: input.ownerId }),
        ...(input.roamStatus === "OWNED" && { ownedAt: now }),
        ...(input.mitigationPlan && {
          mitigationPlan: input.mitigationPlan,
        }),
        ...(input.resolutionNote && {
          resolutionNote: input.resolutionNote,
        }),
        ...(input.roamStatus === "RESOLVED" && { resolvedAt: now }),
      },
    });

    if (risk.count === 0) {
      throw new Error("RISK_NOT_FOUND");
    }

    revalidatePath("/risks");
    return { roamStatus: input.roamStatus };
  });
}

const CreateRoamRiskSchema = z.object({
  piPlanId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(20).max(2000),
  category: z.enum([
    "TECHNICAL",
    "BUSINESS",
    "DEPENDENCY",
    "EXTERNAL",
    "COMPLIANCE",
    "CAPACITY",
  ]),
  severity: z.number().int().min(1).max(5).default(3),
  dueDate: z.string().datetime().optional(),
  source: z.enum(["MANUAL", "AI_SUGGESTED"]).default("MANUAL"),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiJustification: z.string().optional(),
});

export async function createRoamRisk(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateRoamRiskSchema.parse(raw);

    const piPlan = await database.pIPlan.findFirst({
      where: { id: input.piPlanId, tenantId: ctx.tenantId },
    });
    if (!piPlan) {
      throw new Error("PI_PLAN_NOT_FOUND");
    }

    const risk = await database.risk.create({
      data: {
        tenantId: ctx.tenantId,
        piPlanId: input.piPlanId,
        title: input.title,
        description: input.description,
        category: input.category,
        severity: input.severity,
        roamStatus: "UNCLASSIFIED",
        status: "IDENTIFIED",
        source: input.source,
        ...(input.aiConfidence !== undefined && {
          aiConfidence: input.aiConfidence,
        }),
        ...(input.aiJustification && {
          aiJustification: input.aiJustification,
        }),
        ...(input.dueDate && { dueDate: new Date(input.dueDate) }),
      },
      select: { id: true },
    });

    revalidatePath("/risks");
    return { id: risk.id };
  });
}

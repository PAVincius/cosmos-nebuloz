"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

// ─── NPV computation ─────────────────────────────────────────────────────────

function computeNPV(
  annualBenefit: number,
  cost: number,
  rate: number,
  years: number
): number {
  let pv = 0;
  for (let t = 1; t <= years; t++) {
    pv += annualBenefit / (1 + rate) ** t;
  }
  return Math.round((pv - cost) * 100) / 100;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

export const LbcSchema = z.object({
  epicId: z.string().min(1),
  problemStatement: z.string().optional(),
  solutionHypothesis: z.string().optional(),
  nonFinancialBenefits: z.string().optional(),
  riskSummary: z.string().optional(),
  investmentCost: z.coerce.number().nonnegative().optional(),
  expectedAnnualBenefit: z.coerce.number().nonnegative().optional(),
  discountRate: z.coerce.number().min(0).max(1).default(0.1),
  timeHorizonYears: z.coerce.number().int().min(1).max(10).default(3),
  leadingIndicators: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).default("DRAFT"),
});

export type LbcInput = z.infer<typeof LbcSchema>;

export type LbcRow = {
  id: string;
  epicId: string;
  problemStatement: string | null;
  solutionHypothesis: string | null;
  nonFinancialBenefits: string | null;
  riskSummary: string | null;
  investmentCost: number | null;
  expectedAnnualBenefit: number | null;
  discountRate: number;
  timeHorizonYears: number;
  npvEstimate: number | null;
  leadingIndicators: string[];
  status: string;
  updatedAt: Date;
};

// ─── Get ─────────────────────────────────────────────────────────────────────

export async function getLeanBusinessCase(
  epicId: string
): Promise<LbcRow | null> {
  const ctx = await requireTenantSession(await headers());

  const lbc = await database.leanBusinessCase.findUnique({
    where: { epicId, tenantId: ctx.tenantId },
  });

  if (!lbc) {
    return null;
  }

  return {
    ...lbc,
    leadingIndicators: Array.isArray(lbc.leadingIndicators)
      ? (lbc.leadingIndicators as string[])
      : [],
  };
}

// ─── Save (upsert) ───────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: upsert with computed NPV needs full field set
export async function saveLeanBusinessCase(
  raw: unknown
): Promise<{ id: string; npvEstimate: number | null }> {
  const ctx = await requireTenantSession(await headers());
  const data = LbcSchema.parse(raw);

  const npv =
    data.investmentCost !== null &&
    data.investmentCost !== undefined &&
    data.expectedAnnualBenefit !== null &&
    data.expectedAnnualBenefit !== undefined
      ? computeNPV(
          data.expectedAnnualBenefit,
          data.investmentCost,
          data.discountRate,
          data.timeHorizonYears
        )
      : null;

  const record = await database.leanBusinessCase.upsert({
    where: { epicId: data.epicId },
    create: {
      tenantId: ctx.tenantId,
      epicId: data.epicId,
      problemStatement: data.problemStatement ?? null,
      solutionHypothesis: data.solutionHypothesis ?? null,
      nonFinancialBenefits: data.nonFinancialBenefits ?? null,
      riskSummary: data.riskSummary ?? null,
      investmentCost: data.investmentCost ?? null,
      expectedAnnualBenefit: data.expectedAnnualBenefit ?? null,
      discountRate: data.discountRate,
      timeHorizonYears: data.timeHorizonYears,
      npvEstimate: npv,
      leadingIndicators: data.leadingIndicators ?? [],
      status: data.status,
    },
    update: {
      problemStatement: data.problemStatement ?? null,
      solutionHypothesis: data.solutionHypothesis ?? null,
      nonFinancialBenefits: data.nonFinancialBenefits ?? null,
      riskSummary: data.riskSummary ?? null,
      investmentCost: data.investmentCost ?? null,
      expectedAnnualBenefit: data.expectedAnnualBenefit ?? null,
      discountRate: data.discountRate,
      timeHorizonYears: data.timeHorizonYears,
      npvEstimate: npv,
      leadingIndicators: data.leadingIndicators ?? [],
      status: data.status,
    },
    select: { id: true, npvEstimate: true },
  });

  revalidatePath(`/epics/${data.epicId}`);
  return record;
}

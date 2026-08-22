"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

// ─── Types ────────────────────────────────────────────────────────────────────

type LbcItem = { id: string; text: string };

type VersionSnapshot = {
  field: string;
  prev: string;
  next: string;
  savedAt: string; // ISO string
  savedBy: "USER" | "COPILOT";
};

export type BusinessCaseData = {
  epicId: string;
  title: string;
  lifecycleStatus: string;
  descriptionMd: string | null;
  hypothesis: string | null;
  hypothesisResolution: string | null;
  businessOutcomes: LbcItem[];
  leadingIndicators: LbcItem[];
  nfrs: string | null;
  mvp: string | null;
  sizeEstimate: string | null;
  descriptionVersions: VersionSnapshot[];
  leanBudgetAllocation: number | null;
  featureCount: number;
  doneFeatureCount: number;
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const LbcItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(500),
});

const AutosaveBusinessCaseSchema = z.object({
  epicId: z.string().min(1),
  hypothesis: z.string().max(5000).optional().nullable(),
  businessOutcomes: z.array(LbcItemSchema).max(5).optional(),
  leadingIndicators: z.array(LbcItemSchema).max(5).optional(),
  nfrs: z.string().max(2000).optional().nullable(),
  mvp: z.string().max(2000).optional().nullable(),
  sizeEstimate: z.enum(["XS", "S", "M", "L", "XL"]).optional().nullable(),
  hypothesisResolution: z
    .enum(["VALIDATED", "PARTIALLY_VALIDATED", "INVALIDATED"])
    .optional()
    .nullable(),
  versionSnapshot: z
    .object({
      field: z.string(),
      prev: z.string(),
      next: z.string(),
      savedBy: z.enum(["USER", "COPILOT"]),
    })
    .optional(),
});

type AutosaveInput = z.infer<typeof AutosaveBusinessCaseSchema>;

// ─── Ring buffer helper ───────────────────────────────────────────────────────

function pushVersion(
  versions: VersionSnapshot[],
  next: Omit<VersionSnapshot, "savedAt">
): VersionSnapshot[] {
  const entry: VersionSnapshot = { ...next, savedAt: new Date().toISOString() };
  const updated = [...versions, entry];
  return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
}

// ─── Get business case ────────────────────────────────────────────────────────

export async function getBusinessCase(
  epicId: string
): Promise<Result<BusinessCaseData>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirstOrThrow({
      where: { id: epicId, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        lifecycleStatus: true,
        hypothesis: true,
        hypothesisResolution: true,
        businessOutcomes: true,
        leadingIndicators: true,
        nfrs: true,
        mvp: true,
        sizeEstimate: true,
        descriptionVersions: true,
        descriptionMd: true,
        leanBudgetAllocation: true,
        _count: { select: { features: true } },
        features: {
          select: { statusId: true },
        },
      },
    });

    const doneFeatureCount = epic.features.filter(
      (f) => f.statusId === "DONE"
    ).length;

    return {
      epicId: epic.id,
      title: epic.title,
      lifecycleStatus: epic.lifecycleStatus,
      descriptionMd: epic.descriptionMd,
      hypothesis: epic.hypothesis,
      hypothesisResolution: epic.hypothesisResolution,
      businessOutcomes: (epic.businessOutcomes as LbcItem[] | null) ?? [],
      leadingIndicators: (epic.leadingIndicators as LbcItem[] | null) ?? [],
      nfrs: epic.nfrs,
      mvp: epic.mvp,
      sizeEstimate: epic.sizeEstimate,
      descriptionVersions:
        (epic.descriptionVersions as VersionSnapshot[] | null) ?? [],
      leanBudgetAllocation: epic.leanBudgetAllocation,
      featureCount: epic._count.features,
      doneFeatureCount,
    };
  });
}

// ─── Autosave business case ───────────────────────────────────────────────────

export async function autosaveBusinessCase(
  raw: unknown
): Promise<Result<{ savedAt: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = AutosaveBusinessCaseSchema.parse(raw);

    const existing = await database.epic.findFirstOrThrow({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      select: {
        lifecycleStatus: true,
        descriptionVersions: true,
        investScoreOutdated: true,
      },
    });

    const TERMINAL = new Set(["DONE", "REJECTED"]);
    if (TERMINAL.has(existing.lifecycleStatus)) {
      throw new Error("TERMINAL_STATE");
    }

    let versions =
      (existing.descriptionVersions as VersionSnapshot[] | null) ?? [];
    if (input.versionSnapshot) {
      versions = pushVersion(versions, input.versionSnapshot);
    }

    await database.epic.update({
      where: { id: input.epicId },
      data: {
        ...(input.hypothesis !== undefined && { hypothesis: input.hypothesis }),
        ...(input.businessOutcomes !== undefined && {
          businessOutcomes: input.businessOutcomes,
        }),
        ...(input.leadingIndicators !== undefined && {
          leadingIndicators: input.leadingIndicators,
        }),
        ...(input.nfrs !== undefined && { nfrs: input.nfrs }),
        ...(input.mvp !== undefined && { mvp: input.mvp }),
        ...(input.sizeEstimate !== undefined && {
          sizeEstimate: input.sizeEstimate,
        }),
        ...(input.hypothesisResolution !== undefined && {
          hypothesisResolution: input.hypothesisResolution,
        }),
        descriptionVersions: versions,
        ...(input.hypothesis !== undefined &&
          !existing.investScoreOutdated && {
            investScoreOutdated: true,
          }),
      },
    });

    revalidatePath(`/portfolio/${input.epicId}/business-case`);
    return { savedAt: new Date().toISOString() };
  });
}

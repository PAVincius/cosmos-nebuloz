"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { err, ok, type Result } from "../_base";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersonSkillProfile = {
  id: string;
  tenantId: string;
  userId: string;
  competency: string;
  skillLevel: number;
  proficiency: number;
  notes?: string | null;
  isDraft: boolean;
  isVerified: boolean;
  assessedBy?: string | null;
  assessedAt: Date;
  confidence?: number | null;
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type UpsertPersonSkillInput = {
  userId: string;
  competency: string;
  skillLevel: number;
  proficiency: number;
  notes?: string;
  isDraft?: boolean;
};

export async function upsertPersonSkillProfile(
  input: UpsertPersonSkillInput
): Promise<Result<{ id: string }>> {
  const {
    userId,
    competency,
    skillLevel,
    proficiency,
    notes,
    isDraft = false,
  } = input;

  // Validate skillLevel
  if (skillLevel < 1 || skillLevel > 5) {
    return err("skillLevel must be between 1 and 5");
  }

  // Validate proficiency
  if (proficiency < 0 || proficiency > 100) {
    return err("proficiency must be between 0 and 100");
  }

  const { tenantId, userId: assessedBy } = await requireTenantSession(
    await headers()
  );

  try {
    const result = await database.personSkillProfile.upsert({
      where: { tenantId_userId_competency: { tenantId, userId, competency } },
      create: {
        tenantId,
        userId,
        competency,
        skillLevel,
        proficiency,
        notes,
        isDraft,
        isVerified: false,
        assessedBy,
      },
      update: {
        skillLevel,
        proficiency,
        notes,
        isDraft,
        assessedBy,
        assessedAt: new Date(),
      },
    });

    return ok({ id: result.id });
  } catch (error) {
    return err(
      `Failed to upsert person skill profile: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function verifyPersonSkillProfile(
  userId: string,
  competency: string
): Promise<Result<{ id: string }>> {
  const { tenantId } = await requireTenantSession(await headers());

  try {
    const result = await database.personSkillProfile.update({
      where: { tenantId_userId_competency: { tenantId, userId, competency } },
      data: { isVerified: true, isDraft: false },
    });

    return ok({ id: result.id });
  } catch (error) {
    return err(
      `Failed to verify person skill profile: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function listPersonSkillProfiles(
  userIds: string[]
): Promise<Result<PersonSkillProfile[]>> {
  const { tenantId } = await requireTenantSession(await headers());

  try {
    const profiles = await database.personSkillProfile.findMany({
      where: { tenantId, userId: { in: userIds } },
      orderBy: [{ userId: "asc" }, { competency: "asc" }],
    });

    return ok(profiles);
  } catch (error) {
    return err(
      `Failed to list person skill profiles: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

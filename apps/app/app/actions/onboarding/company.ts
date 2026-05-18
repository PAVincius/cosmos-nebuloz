"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  SafeStructureSchema,
  PISprintsSchema,
  type SafeStructureData,
  type PISprintsData,
} from "./schema";

/**
 * Creates ARTs from the onboarding SAFe structure input.
 *
 * Note: Portfolio and ValueStream are UX-level concepts in the onboarding
 * wizard but do not yet have dedicated DB models. ARTs are created directly
 * under the tenant. Portfolio/ValueStream metadata is persisted in the
 * OnboardingProgress.data JSON blob by the saveStep action.
 */
export async function createSAFeStructureFromOnboarding(
  raw: SafeStructureData
) {
  const ctx = await requireTenantSession(await headers());
  const input = SafeStructureSchema.parse(raw);

  const artIds: string[] = [];

  for (const vs of input.valueStreams) {
    for (const art of vs.arts) {
      const artRecord = await database.aRT.create({
        data: {
          tenantId: ctx.tenantId,
          name: art.name,
          cadence: art.cadence,
        },
      });
      artIds.push(artRecord.id);
    }
  }

  revalidatePath("/arts");

  return {
    portfolioName: input.portfolioName,
    valueStreamCount: input.valueStreams.length,
    artIds,
  };
}

/**
 * Creates a PIPlan linked to the ART found by name within the tenant.
 */
export async function createPIsFromOnboarding(raw: PISprintsData) {
  const ctx = await requireTenantSession(await headers());
  const input = PISprintsSchema.parse(raw);

  const art = await database.aRT.findFirst({
    where: { name: input.artName, tenantId: ctx.tenantId },
  });
  if (!art) throw new Error(`ART "${input.artName}" não encontrado.`);

  const pi = await database.pIPlan.create({
    data: {
      tenantId: ctx.tenantId,
      artId: art.id,
      name: input.piName,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    },
  });

  revalidatePath(`/arts/${art.id}`);
  return { piId: pi.id, artId: art.id };
}

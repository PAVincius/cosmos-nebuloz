"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function saveSessionNotes({
  piSessionId,
  piPlanId,
  artId,
  notes,
}: {
  piSessionId: string | null;
  piPlanId: string;
  artId: string;
  notes: string;
}) {
  const ctx = await requireTenantSession(await headers());

  // Verify PI belongs to this tenant.
  const pi = await database.pIPlan.findFirst({
    where: { id: piPlanId, tenantId: ctx.tenantId },
  });
  if (!pi) throw new Error("PI Plan não encontrado.");

  if (piSessionId) {
    // Update existing session notes.
    await database.pISession.updateMany({
      where: { id: piSessionId, tenantId: ctx.tenantId },
      data: { notes },
    });
  } else {
    // Create a new REPLAN session to store the Inspect & Adapt notes.
    await database.pISession.create({
      data: {
        tenantId: ctx.tenantId,
        piPlanId,
        type: "REPLAN",
        notes,
      },
    });
  }

  revalidatePath(`/arts/${artId}/post-pi`);
}

export async function closePIPlan({
  piPlanId,
  artId,
}: {
  piPlanId: string;
  artId: string;
}) {
  const ctx = await requireTenantSession(await headers());

  const pi = await database.pIPlan.findFirst({
    where: { id: piPlanId, tenantId: ctx.tenantId },
  });
  if (!pi) throw new Error("PI Plan não encontrado.");

  // Store the closed-at timestamp as endDate if not already set.
  await database.pIPlan.updateMany({
    where: { id: piPlanId, tenantId: ctx.tenantId },
    data: {
      endDate: pi.endDate ?? new Date(),
    },
  });

  revalidatePath(`/arts/${artId}/post-pi`);
  revalidatePath(`/arts/${artId}`);
}

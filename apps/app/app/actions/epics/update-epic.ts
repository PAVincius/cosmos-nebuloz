"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { type UpdateEpicInput, UpdateEpicSchema } from "./schema";

export function updateEpic(
  raw: UpdateEpicInput
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = UpdateEpicSchema.parse(raw);

    const updated = await database.epic.update({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.statusId !== undefined && { statusId: input.statusId }),
        ...(input.strategicThemeId !== undefined && {
          strategicThemeId: input.strategicThemeId,
        }),
        ...(input.descriptionMd !== undefined && {
          descriptionMd: input.descriptionMd,
        }),
        ...(input.order !== undefined && { order: input.order }),
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/portfolio");
    return updated;
  });
}

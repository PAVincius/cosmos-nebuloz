"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { indexEntity } from "@/app/actions/safe-copilot/index-entity";
import { type Result, safeAction } from "../_base";
import { type UpdateEpicInput, UpdateEpicSchema } from "./schema";

export async function updateEpic(
  raw: UpdateEpicInput
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = UpdateEpicSchema.parse(raw);

    const titleChanged = input.title !== undefined;
    const descChanged = input.descriptionMd !== undefined;

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
        ...(input.epicType !== undefined && { epicType: input.epicType }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        }),
        ...(input.transcription !== undefined && {
          transcription: input.transcription,
        }),
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/portfolio");

    if (titleChanged || descChanged) {
      const { tenantId } = ctx;
      const { epicId } = input;
      queueMicrotask(() => {
        indexEntity("epic", epicId, tenantId).catch((err) => {
          log.error("[copilot] reindex epic failed", { epicId, err });
        });
      });
    }

    return updated;
  });
}

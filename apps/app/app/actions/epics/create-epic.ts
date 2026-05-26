"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { type CreateEpicInput, CreateEpicSchema } from "./schema";

export function createEpic(
  raw: CreateEpicInput
): Promise<
  Result<{ id: string; title: string; statusId: string; order: number }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateEpicSchema.parse(raw);

    const epic = await database.$transaction(async (tx) => {
      const count = await tx.epic.count({
        where: { tenantId: ctx.tenantId, statusId: input.statusId },
      });
      return tx.epic.create({
        data: {
          tenantId: ctx.tenantId,
          title: input.title,
          statusId: input.statusId,
          strategicThemeId: input.strategicThemeId ?? null,
          descriptionMd: input.descriptionMd ?? null,
          order: count,
        },
        select: { id: true, title: true, statusId: true, order: true },
      });
    });

    revalidatePath("/dashboard/portfolio");
    return epic;
  });
}

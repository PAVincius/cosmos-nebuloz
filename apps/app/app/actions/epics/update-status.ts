"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { UpdateEpicStatusSchema } from "../schemas";
import { portfolioEpicsCacheTag } from "./portfolio-cache";

export const updateEpicStatus = async (
  epicId: string,
  statusId: string,
  order: number
): Promise<void> => {
  const ctx = await requireTenantSession(await headers());

  const { epicId: validEpicId, statusId: validStatus, order: validOrder } =
    UpdateEpicStatusSchema.parse({ epicId, statusId, order });

  const result = await database.epic.updateMany({
    where: { id: validEpicId, tenantId: ctx.tenantId },
    data: { statusId: validStatus, order: validOrder },
  });

  if (result.count === 0) {
    throw new Error("Epic not found or access denied");
  }

  revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
};

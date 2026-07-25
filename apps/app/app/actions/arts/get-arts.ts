"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CreateARTSchema } from "../schemas";

export async function getARTs() {
  const ctx = await requireTenantSession(await headers());

  return database.aRT.findMany({
    where: { tenantId: ctx.tenantId },
    include: { piPlans: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getARTById(artId: string) {
  const ctx = await requireTenantSession(await headers());

  return database.aRT.findFirst({
    where: { id: artId, tenantId: ctx.tenantId },
    include: {
      piPlans: {
        orderBy: { createdAt: "desc" },
        include: {
          piSessions: {
            orderBy: { createdAt: "asc" },
            include: {
              confidenceSessions: { orderBy: { roundNumber: "asc" } },
            },
          },
        },
      },
    },
  });
}

export async function createART(raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE"], ctx);

  const { name, cadence } = CreateARTSchema.parse(raw);

  const art = await database.aRT.create({
    data: { tenantId: ctx.tenantId, name, cadence },
  });

  revalidatePath("/arts");
  return art;
}

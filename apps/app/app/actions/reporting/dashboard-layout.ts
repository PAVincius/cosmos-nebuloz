"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const TileSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
});

const UpsertLayoutSchema = z.object({
  tiles: z.array(TileSchema).max(50),
});

export type DashboardTile = z.infer<typeof TileSchema>;
export type DashboardLayout = { tiles: DashboardTile[] };

export async function getDashboardLayout(): Promise<Result<DashboardLayout>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const row = await database.userDashboardLayout.findUnique({
      where: {
        tenantId_userId: { tenantId: ctx.tenantId, userId: ctx.userId },
      },
      select: { config: true },
    });

    if (!row) {
      return { tiles: [] };
    }

    return UpsertLayoutSchema.parse(row.config);
  });
}

export async function upsertDashboardLayout(
  raw: unknown
): Promise<Result<DashboardLayout>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpsertLayoutSchema.parse(raw);

    const row = await database.userDashboardLayout.upsert({
      where: {
        tenantId_userId: { tenantId: ctx.tenantId, userId: ctx.userId },
      },
      create: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        config: data as import("@repo/database").Prisma.InputJsonValue,
      },
      update: {
        config: data as import("@repo/database").Prisma.InputJsonValue,
      },
      select: { config: true },
    });

    return UpsertLayoutSchema.parse(row.config);
  });
}

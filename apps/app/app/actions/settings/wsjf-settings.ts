"use server";

// wsjf-settings.ts — thin CRUD over the WsjfSettings model (Task 16,
// art-core.prisma:404). scoreWsjfAction reads this table directly to get
// weightBv/weightTc/weightRr multipliers, but until now nothing exposed a
// read/write surface for the settings row itself — this is that surface,
// gated the same way the rest of Settings is (ADMIN for tenant-wide config).
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

export type WsjfSettingsData = {
  weightBv: number;
  weightTc: number;
  weightRr: number;
  scale: string;
  autoRecalc: string;
  rebalanceApprover: string;
  staleDays: number;
} | null;

export async function getWsjfSettings(): Promise<WsjfSettingsData> {
  const ctx = await requireTenantSession(await headers());

  return database.wsjfSettings.findUnique({
    where: { tenantId: ctx.tenantId },
    select: {
      weightBv: true,
      weightTc: true,
      weightRr: true,
      scale: true,
      autoRecalc: true,
      rebalanceApprover: true,
      staleDays: true,
    },
  });
}

const UpsertWsjfSettingsSchema = z.object({
  weightBv: z.number().positive().max(10),
  weightTc: z.number().positive().max(10),
  weightRr: z.number().positive().max(10),
  scale: z.enum(["fibonacci", "linear"]),
  autoRecalc: z.enum(["realtime", "daily", "weekly", "manual"]),
  rebalanceApprover: z.enum(["rte", "lpm", "po", "any"]),
  staleDays: z.number().int().min(1).max(90),
});

type UpsertWsjfSettingsInput = z.infer<typeof UpsertWsjfSettingsSchema>;

export async function upsertWsjfSettings(raw: unknown): Promise<void> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const parsed = UpsertWsjfSettingsSchema.parse(raw);

  await database.wsjfSettings.upsert({
    where: { tenantId: ctx.tenantId },
    create: { tenantId: ctx.tenantId, ...parsed },
    update: { ...parsed },
  });

  revalidatePath("/settings/safe");
}

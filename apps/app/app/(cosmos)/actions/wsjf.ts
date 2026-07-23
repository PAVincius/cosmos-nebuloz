"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type WsjfRankItem = {
  rank: number;
  id: string;
  name: string;
  type: "Epic" | "Feature";
  art: string | null;
  wsjf: number;
  size: number;
  prev: number;
  ai: string;
};

export async function listWsjfItems(): Promise<Result<WsjfRankItem[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const [epics, features] = await Promise.all([
      database.epic.findMany({
        where: { tenantId: ctx.tenantId, lifecycleStatus: { not: "REJECTED" } },
        select: {
          id: true,
          title: true,
          artId: true,
          wsjf: true,
          sizePoints: true,
        },
      }),
      database.feature.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          title: true,
          artScopedId: true,
          wsjfScore: true,
          storyPoints: true,
        },
      }),
    ]);

    const merged = [
      ...epics.map((e) => ({
        id: e.id,
        name: e.title,
        type: "Epic" as const,
        art: e.artId,
        wsjf: e.wsjf ?? 0,
        size: e.sizePoints ?? 0,
      })),
      ...features.map((f) => ({
        id: f.id,
        name: f.title,
        type: "Feature" as const,
        art: f.artScopedId,
        wsjf: f.wsjfScore,
        size: f.storyPoints,
      })),
    ].sort((a, b) => b.wsjf - a.wsjf);

    return merged.map((item, i) => ({
      ...item,
      rank: i + 1,
      prev: i + 1,
      ai: "—",
    }));
  });
}

// ─── WSJF Settings (tenant-wide calculation parameters) ───────────────────────
// Only weightBv/weightTc/weightRr are consumed today, by scoreWsjfAction
// (app/actions/wsjf/score.ts). scale/autoRecalc/rebalanceApprover/staleDays
// are stored and editable here but not yet enforced anywhere — see the
// commit body for what infrastructure each would need.

export type WsjfSettingsView = {
  weightBv: number;
  weightTc: number;
  weightRr: number;
  scale: "fibonacci" | "linear";
  autoRecalc: "realtime" | "daily" | "weekly" | "manual";
  rebalanceApprover: "rte" | "lpm" | "po" | "any";
  staleDays: number;
};

// NOT exported: this file has "use server", which only permits async
// function exports. Screens that need the same defaults for a pre-fetch
// fallback (see wsjf.tsx) define their own local copy.
const WSJF_SETTINGS_DEFAULTS: WsjfSettingsView = {
  weightBv: 1,
  weightTc: 1,
  weightRr: 1,
  scale: "fibonacci",
  autoRecalc: "daily",
  rebalanceApprover: "rte",
  staleDays: 14,
};

export async function getWsjfSettings(): Promise<Result<WsjfSettingsView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const row = await database.wsjfSettings.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (!row) {
      return WSJF_SETTINGS_DEFAULTS;
    }
    return {
      weightBv: row.weightBv,
      weightTc: row.weightTc,
      weightRr: row.weightRr,
      scale: row.scale as WsjfSettingsView["scale"],
      autoRecalc: row.autoRecalc as WsjfSettingsView["autoRecalc"],
      rebalanceApprover:
        row.rebalanceApprover as WsjfSettingsView["rebalanceApprover"],
      staleDays: row.staleDays,
    };
  });
}

const WEIGHT_RANGE_MSG = "Peso deve estar entre 0.5 e 2.";

const UpsertWsjfSettingsSchema = z.object({
  weightBv: z.number().min(0.5, WEIGHT_RANGE_MSG).max(2, WEIGHT_RANGE_MSG),
  weightTc: z.number().min(0.5, WEIGHT_RANGE_MSG).max(2, WEIGHT_RANGE_MSG),
  weightRr: z.number().min(0.5, WEIGHT_RANGE_MSG).max(2, WEIGHT_RANGE_MSG),
  scale: z.enum(["fibonacci", "linear"], {
    message: "Escala de estimativa inválida.",
  }),
  autoRecalc: z.enum(["realtime", "daily", "weekly", "manual"], {
    message: "Recálculo automático inválido.",
  }),
  rebalanceApprover: z.enum(["rte", "lpm", "po", "any"], {
    message: "Aprovador de rebalanceamento inválido.",
  }),
  staleDays: z
    .number()
    .int("Alerta de score desatualizado deve ser um número inteiro de dias.")
    .min(3, "Alerta de score desatualizado deve ser entre 3 e 30 dias.")
    .max(30, "Alerta de score desatualizado deve ser entre 3 e 30 dias."),
});

export async function upsertWsjfSettings(
  input: z.input<typeof UpsertWsjfSettingsSchema>
): Promise<Result<WsjfSettingsView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);
    const parsed = UpsertWsjfSettingsSchema.parse(input);

    const saved = await database.wsjfSettings.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, ...parsed },
      update: { ...parsed },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "wsjf_settings",
      entityId: saved.id,
      diff: parsed,
    });
    revalidateTag(`wsjf:${ctx.tenantId}`, "max");

    return {
      weightBv: saved.weightBv,
      weightTc: saved.weightTc,
      weightRr: saved.weightRr,
      scale: saved.scale as WsjfSettingsView["scale"],
      autoRecalc: saved.autoRecalc as WsjfSettingsView["autoRecalc"],
      rebalanceApprover:
        saved.rebalanceApprover as WsjfSettingsView["rebalanceApprover"],
      staleDays: saved.staleDays,
    };
  });
}

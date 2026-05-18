"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type Result,
  safeAction,
  cuid,
  isoDate,
  optStr,
} from "../_base";
import type { UpsertStandupInput } from "./schema";

export type { UpsertStandupInput };

// ─── Internal schemas (not exported from "use server") ────────────────────────

const UpsertStandupSchema = z.object({
  teamId: cuid,
  date: isoDate,
  yesterday: optStr,
  today: optStr,
  blockers: optStr,
});

const StandupFiltersSchema = z.object({
  teamId: cuid,
  date: isoDate,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeDateToMidnightUTC(d: Date): Date {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listTodayStandup(
  teamId: string,
): Promise<Result<any[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const today = normalizeDateToMidnightUTC(new Date());

    return database.standupEntry.findMany({
      where: { tenantId: ctx.tenantId, teamId, date: today },
      orderBy: { createdAt: "asc" },
    });
  });
}

export async function getStandupHistory(
  teamId: string,
  days = 14,
): Promise<Result<any[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const since = normalizeDateToMidnightUTC(new Date());
    since.setUTCDate(since.getUTCDate() - Math.max(1, days));

    return database.standupEntry.findMany({
      where: {
        tenantId: ctx.tenantId,
        teamId,
        date: { gte: since },
      },
      orderBy: [{ date: "desc" }, { createdAt: "asc" }],
    });
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function upsertStandupEntry(raw: unknown): Promise<Result<any>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpsertStandupSchema.parse(raw);

    // Normalize to midnight UTC to match @db.Date storage
    const date = normalizeDateToMidnightUTC(data.date);

    const result = await database.standupEntry.upsert({
      where: {
        teamId_userId_date: {
          teamId: data.teamId,
          userId: ctx.userId,
          date,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        teamId: data.teamId,
        userId: ctx.userId,
        date,
        yesterday: data.yesterday,
        today: data.today,
        blockers: data.blockers,
      },
      update: {
        yesterday: data.yesterday,
        today: data.today,
        blockers: data.blockers,
      },
    });

    revalidatePath(`/teams/${data.teamId}/standup`);
    return result;
  });
}

export async function deleteStandupEntry(
  id: string,
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const entry = await database.standupEntry.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!entry) throw new Error("Standup entry não encontrada");

    // Business rule: only the owner can delete their entry
    if (entry.userId !== ctx.userId)
      throw new Error("Apenas o autor pode excluir seu próprio standup");

    await database.standupEntry.delete({ where: { id } });

    revalidatePath(`/teams/${entry.teamId}/standup`);
    return { id };
  });
}

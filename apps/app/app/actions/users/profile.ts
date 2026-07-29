"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function getMyProfile() {
  const ctx = await requireTenantSession(await headers());

  const [user, member] = await Promise.all([
    database.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    }),
    database.tenantMember.findFirst({
      where: { tenantId: ctx.tenantId, userId: ctx.userId },
      select: { id: true, role: true, createdAt: true },
    }),
  ]);

  if (!(user && member)) {
    throw new Error("Perfil não encontrado.");
  }

  const tenant = await database.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { id: true, name: true, plan: true },
  });

  return { user, member, tenant };
}

export async function updateProfile(input: { name?: string; image?: string }) {
  const ctx = await requireTenantSession(await headers());

  await database.user.update({
    where: { id: ctx.userId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.image !== undefined && { image: input.image || null }),
    },
  });

  revalidatePath("/profile");
}

export async function updateNotificationPreferences(
  prefs: Record<string, boolean>
) {
  const ctx = await requireTenantSession(await headers());

  // Store notification preferences in Tenant.metadata under a per-user key
  const tenant = await database.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { metadata: true },
  });

  const currentMetadata = (tenant?.metadata ?? {}) as Record<string, unknown>;
  const notifKey = `notif_prefs_${ctx.userId}`;
  const existingPrefs = (currentMetadata[notifKey] ?? {}) as Record<
    string,
    boolean
  >;

  await database.tenant.update({
    where: { id: ctx.tenantId },
    data: {
      metadata: {
        ...currentMetadata,
        // Merge, don't overwrite — the caller may send only the toggled
        // key, and a full overwrite would silently wipe every sibling pref.
        [notifKey]: { ...existingPrefs, ...prefs },
      } as Record<string, string>,
    },
  });

  revalidatePath("/profile");
}

export async function getNotificationPreferences(): Promise<
  Record<string, boolean>
> {
  const ctx = await requireTenantSession(await headers());

  const tenant = await database.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { metadata: true },
  });

  const metadata = (tenant?.metadata ?? {}) as Record<string, unknown>;
  const notifKey = `notif_prefs_${ctx.userId}`;
  const prefs = (metadata[notifKey] ?? {}) as Record<string, boolean>;

  return {
    pi_planning: prefs.pi_planning ?? true,
    risk_alerts: prefs.risk_alerts ?? true,
    feature_updates: prefs.feature_updates ?? true,
    team_changes: prefs.team_changes ?? false,
    weekly_digest: prefs.weekly_digest ?? true,
  };
}

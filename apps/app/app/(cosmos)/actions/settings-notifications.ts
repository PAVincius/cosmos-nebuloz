"use server";

// settings-notifications.ts — Notificações tab (Settings screen, tab 5).
//
// The NotificationPreference model exists (system.prisma) but has zero
// action call sites anywhere in the repo — no reader, no writer. The
// notification preferences that ARE real, working, and already wired are
// in app/actions/users/profile.ts (getNotificationPreferences/
// updateNotificationPreferences), which store them per-user in
// Tenant.metadata under a `notif_prefs_<userId>` key. That's a real,
// tenant+user-scoped, already-functioning mechanism (used by the profile
// screen), so it's reused here rather than building fresh, unused CRUD
// over the orphaned model. No RBAC gate needed beyond tenant session —
// a member editing their own notification prefs isn't a privileged op.
import { type Result, safeAction } from "../../actions/_base";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../../actions/users/profile";

export type NotificationPrefsView = Record<string, boolean>;

export async function getNotificationsTab(): Promise<
  Result<NotificationPrefsView>
> {
  return safeAction(async () => getNotificationPreferences());
}

export async function updateNotificationsAction(
  prefs: Record<string, boolean>
): Promise<Result<{ updated: true }>> {
  return safeAction(async () => {
    await updateNotificationPreferences(prefs);
    return { updated: true as const };
  });
}

import { database } from "@repo/database";

/**
 * Called only from server-side layout/middleware where tenantId comes from
 * the authenticated session. Never expose this to client-side callers.
 *
 * Not a server action — no "use server" directive, so it is not RPC-reachable.
 */
export async function isOnboardingComplete(tenantId: string): Promise<boolean> {
  if (!tenantId) {
    return false;
  }
  const progress = await database.onboardingProgress.findFirst({
    where: { tenantId, flowType: "company_setup" },
  });
  // No record = pre-existing/seeded tenant, treat as complete.
  // Only block if a record explicitly exists with non-completed status.
  return !progress || progress.status === "completed";
}

export type SyncConflict = {
  cosmosId: string;
  cosmosType: string;
  externalSource: "linear" | "github";
  externalId: string;
  cosmosUpdatedAt: Date;
  externalUpdatedAt: Date;
};

export type ConflictResolution = "cosmos_wins" | "external_wins";

/**
 * Last-write-wins: whichever side has the more recent timestamp wins.
 * Ties go to external (integrations are the source of truth for engineers).
 */
export function resolveConflict(conflict: SyncConflict): ConflictResolution {
  if (conflict.externalUpdatedAt >= conflict.cosmosUpdatedAt) {
    return "external_wins";
  }
  return "cosmos_wins";
}

export function logSyncConflict(
  conflict: SyncConflict,
  resolution: ConflictResolution,
): void {
  // Audit log — SyncLog model exists in schema; use console for now to avoid circular dep
  console.error("[sync] conflict", {
    ...conflict,
    resolution,
    resolvedAt: new Date().toISOString(),
  });
}

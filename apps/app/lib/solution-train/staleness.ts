// Solution Board feature staleness detection (story-043 AC-008)

export const STALE_THRESHOLD_DAYS = 14;

export function isFeatureStale(updatedAt: Date, asOf: Date): boolean {
  const diffMs = asOf.getTime() - updatedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= STALE_THRESHOLD_DAYS;
}

export function daysStale(updatedAt: Date, asOf: Date): number {
  const diffMs = asOf.getTime() - updatedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function filterStaleFeatures<T extends { updatedAt: Date }>(
  features: T[],
  asOf: Date
): T[] {
  return features.filter((f) => isFeatureStale(f.updatedAt, asOf));
}

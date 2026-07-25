// JSONL audit export chunking (story-045 AC-005)

export const CHUNK_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const RETENTION_YEARS = 7;

export function getChunkFileName(baseYear: number, partIndex: number): string {
  return `audit-${baseYear}-part-${partIndex}.jsonl`;
}

export function estimateChunkCount(totalBytes: number): number {
  if (totalBytes <= 0) {
    return 0;
  }
  return Math.ceil(totalBytes / CHUNK_SIZE_BYTES);
}

export function needsChunking(totalBytes: number): boolean {
  return totalBytes > CHUNK_SIZE_BYTES;
}

export function isWithinRetentionPeriod(
  recordYear: number,
  currentYear: number
): boolean {
  return currentYear - recordYear <= RETENTION_YEARS;
}

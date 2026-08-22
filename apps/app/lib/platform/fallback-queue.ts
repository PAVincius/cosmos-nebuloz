// Inngest degradation fallback queue helpers (story-044 AC-008)

type FallbackJobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export type FallbackQueueEntry = {
  jobType: string;
  payload: unknown;
  status: FallbackJobStatus;
  tenantId?: string;
};

export function buildQueueEntry(
  jobType: string,
  payload: unknown,
  tenantId?: string
): FallbackQueueEntry {
  return { jobType, payload, status: "PENDING", tenantId };
}

export function isInngestUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("inngest") ||
    msg.includes("timeout")
  );
}

export function shouldDrainEntry(entry: FallbackQueueEntry): boolean {
  return entry.status === "PENDING" || entry.status === "FAILED";
}

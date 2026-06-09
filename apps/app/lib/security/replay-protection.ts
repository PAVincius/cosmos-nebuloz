// Story-035: Webhook replay protection — timestamp within ±300s window
const MAX_DRIFT_SECONDS = 300;

export type ReplayCheckResult =
  | { valid: true }
  | { valid: false; code: "REPLAY_DETECTED"; message: string };

export function checkReplayTimestamp(
  timestampSeconds: number,
  nowSeconds: number
): ReplayCheckResult {
  const drift = Math.abs(nowSeconds - timestampSeconds);
  if (drift > MAX_DRIFT_SECONDS) {
    return {
      valid: false,
      code: "REPLAY_DETECTED",
      message: "Request timestamp outside acceptable window",
    };
  }
  return { valid: true };
}

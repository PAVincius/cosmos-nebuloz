// Pure utility — no env vars, safe for edge/test environments

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp ms
};

export function buildRateLimitHeaders(result: RateLimitResult): HeadersInit {
  const resetSecs = Math.ceil((result.reset - Date.now()) / 1000);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
  };
  if (!result.success) {
    headers["Retry-After"] = String(Math.max(1, resetSecs));
  }
  return headers;
}

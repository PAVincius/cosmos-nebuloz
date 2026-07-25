import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

// Import pure utility directly — no env-var side effects
import { buildRateLimitHeaders } from "../../../../packages/rate-limit/headers";
import { verifyLinearSignature } from "../../app/actions/integrations/webhooks/verify-signature";
import { checkReplayTimestamp } from "../../lib/security/replay-protection";

// ─── Replay protection ────────────────────────────────────────────────────────

describe("checkReplayTimestamp (AC-004)", () => {
  it("returns valid for timestamp within ±300s window", () => {
    const now = 1_000_000;
    expect(checkReplayTimestamp(now - 100, now).valid).toBe(true);
    expect(checkReplayTimestamp(now + 100, now).valid).toBe(true);
    expect(checkReplayTimestamp(now - 299, now).valid).toBe(true);
    expect(checkReplayTimestamp(now + 299, now).valid).toBe(true);
  });

  it("returns REPLAY_DETECTED for timestamp > 300s old (AC-004)", () => {
    const now = 1_000_000;
    const result = checkReplayTimestamp(now - 301, now);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("REPLAY_DETECTED");
      expect(result.message).toMatch(/timestamp/i);
    }
  });

  it("returns REPLAY_DETECTED for timestamp > 300s in future (AC-004)", () => {
    const now = 1_000_000;
    const result = checkReplayTimestamp(now + 301, now);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("REPLAY_DETECTED");
    }
  });

  it("accepts exactly 300s boundary as valid", () => {
    const now = 1_000_000;
    expect(checkReplayTimestamp(now - 300, now).valid).toBe(true);
    expect(checkReplayTimestamp(now + 300, now).valid).toBe(true);
  });
});

// ─── Rate limit headers (AC-001 / AC-008) ────────────────────────────────────

describe("buildRateLimitHeaders (AC-001 / AC-008)", () => {
  it("includes 4 headers on 429 (limit exhausted) (AC-001)", () => {
    const headers = buildRateLimitHeaders({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 30_000,
    }) as Record<string, string>;

    expect(headers["X-RateLimit-Limit"]).toBe("60");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
    expect(headers["Retry-After"]).toBeDefined();
    expect(Number(headers["Retry-After"])).toBeGreaterThanOrEqual(1);
  });

  it("omits Retry-After on successful response (AC-008)", () => {
    const headers = buildRateLimitHeaders({
      success: true,
      limit: 60,
      remaining: 45,
      reset: Date.now() + 30_000,
    }) as Record<string, string>;

    expect(headers["X-RateLimit-Limit"]).toBe("60");
    expect(headers["X-RateLimit-Remaining"]).toBe("45");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("clamps remaining to 0 when negative (AC-001)", () => {
    const headers = buildRateLimitHeaders({
      success: false,
      limit: 60,
      remaining: -5,
      reset: Date.now() + 10_000,
    }) as Record<string, string>;

    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("X-RateLimit-Reset is Unix timestamp in seconds (AC-001)", () => {
    const futureMs = Date.now() + 60_000;
    const headers = buildRateLimitHeaders({
      success: true,
      limit: 100,
      remaining: 50,
      reset: futureMs,
    }) as Record<string, string>;

    const resetSec = Number(headers["X-RateLimit-Reset"]);
    expect(resetSec).toBeGreaterThan(Date.now() / 1000);
    expect(resetSec).toBeLessThan(Date.now() / 1000 + 120);
  });
});

// ─── HMAC timing-safe comparison (AC-003) ────────────────────────────────────

describe("verifyLinearSignature timingSafeEqual (AC-003)", () => {
  const secret = "test-webhook-secret";
  const body = Buffer.from('{"type":"Issue","action":"create"}');

  function makeSignature(buf: Buffer, s: string): string {
    return `sha256=${createHmac("sha256", s).update(buf).digest("hex")}`;
  }

  it("returns true for valid HMAC signature (AC-003)", () => {
    const sig = makeSignature(body, secret);
    expect(verifyLinearSignature(body, sig, secret)).toBe(true);
  });

  it("returns false for tampered body (AC-003)", () => {
    const tampered = Buffer.from('{"type":"Issue","action":"delete"}');
    const sig = makeSignature(body, secret);
    expect(verifyLinearSignature(tampered, sig, secret)).toBe(false);
  });

  it("returns false for wrong secret (AC-003)", () => {
    const sig = makeSignature(body, "correct");
    expect(verifyLinearSignature(body, sig, "wrong")).toBe(false);
  });

  it("returns false for empty signature (AC-003)", () => {
    expect(verifyLinearSignature(body, "", secret)).toBe(false);
  });
});

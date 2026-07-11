# Story 035 — Rate Limiting, Webhook Signature Verification & PII-Safe Observability

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-005 Platform Security Hardening
**WSJF:** 11.0 (userValue=7, timeValue=7, riskReduction=8, jobSize=2)
**Story Points:** 8
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As a** Platform SRE,
**I want** multi-tier rate limiting, HMAC webhook verification on all channels, and PII-free structured observability,
**so that** the platform is protected from abuse, integrations are secure, and incident response doesn't expose user data.

---

## Acceptance Criteria

### AC-001: User rate limit at 61st request returns 429
Given a user sends 61 requests/minute (global user limit = 60),
When the 61st request arrives,
Then:
- HTTP 429 with headers: `X-RateLimit-Limit: 60`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset: <Unix timestamp>`, `Retry-After: <seconds>`
- The request body is not processed
- The 62nd request within the same window also returns 429

### AC-002: Per-IP abuse spike detection
Given an IP sends traffic that is 6× its 60s baseline within 60s,
When the spike is detected,
Then:
- A temporary 5-minute IP ban activates (Redis key `ratelimit:ip:ban:{ip}` with 300s TTL)
- Platform admin is alerted via notification
- An `AuditLog` entry records the ban event
- After 5 min: normal rate limits resume automatically

### AC-003: Webhook HMAC-SHA256 constant-time comparison
Given a valid GitHub webhook with correct `X-Hub-Signature-256: sha256={hex}`,
When the handler verifies,
Then:
- `crypto.timingSafeEqual(computedHash, receivedHash)` is used (not `===`)
- HTTP 200 within 200ms
- Inngest job enqueued

Given an invalid signature,
Then:
- HTTP 401 within 200ms
- `AuditLog` entry: `action=webhook.signature_invalid`
- Sentry alert triggered within 30s

### AC-004: Replay protection — timestamp outside ±300s
Given a Linear webhook with timestamp `ts` where `|now - ts| > 300s`,
When the handler processes,
Then:
- HTTP 401 `{code: "REPLAY_DETECTED", message: "Request timestamp outside acceptable window"}`
- No Inngest job enqueued
- No data modification

### AC-005: Structured log — no PII in output
Given a server error involving a user's email in a DB constraint violation,
When `pino` logs the error,
Then:
- The log output contains no email address (replaced with `[Redacted]`)
- `pino-redact` paths include: `['email', '*.email', 'user.name', '*.phone', 'req.headers.authorization']`
- The error message, stack trace, and orgId are present

### AC-006: Sentry error — no PII in user context
Given a Sentry error event is captured,
When viewed in the Sentry dashboard,
Then:
- User context shows only: `{id: "user_xxx", orgId: "org_xxx"}` — no name, email, or IP
- Breadcrumbs contain no request bodies with PII
- Tags include: `orgId`, `artId`, `piPlanId` (for routing to on-call)

### AC-007: p95 latency alert at >2s on /api/portfolio
Given a latency spike causes p95 response time on `/api/portfolio` to exceed 2s,
When OpenTelemetry reports the spike,
Then:
- A Sentry performance alert fires within 5 min
- The alert appears in the SRE health dashboard
- The alert includes: route, p95 latency, affected org count, time range

### AC-008: Rate limit headers on every API response
Given any API response (success or 429),
When the response is returned,
Then:
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers are present
- On 429: `Retry-After` is also included
- Headers reflect the most restrictive applicable limit (user < org < global)

---

## Technical Notes

### Multi-Tier Rate Limits (Upstash)

```typescript
// packages/security/src/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL!, token: process.env.UPSTASH_REDIS_TOKEN! })

export const rateLimits = {
  user: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1m'), prefix: 'rl:user' }),
  userAI: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1m'), prefix: 'rl:user:ai' }),
  userExport: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1h'), prefix: 'rl:user:export' }),
  org: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1000, '1m'), prefix: 'rl:org' }),
  ip: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1m'), prefix: 'rl:ip:unauth' }),
  ipAuth: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1m'), prefix: 'rl:ip:auth' }),
}

export const applyRateLimits = async (req: Request, session?: Session): Promise<RateLimitResult | null> => {
  const ip = getIP(req)
  const checks = session
    ? [rateLimits.user.limit(session.userId), rateLimits.org.limit(session.orgId)]
    : [rateLimits.ip.limit(ip)]

  const results = await Promise.all(checks)
  const failed = results.find(r => !r.success)
  return failed ?? null
}
```

### Webhook HMAC Verification

```typescript
// packages/security/src/webhook-verify.ts
import crypto from 'crypto'

export const verifyWebhookSignature = (
  rawBody: Buffer,
  signature: string,
  secret: string,
  algorithm: 'sha256' = 'sha256'
): boolean => {
  const computed = crypto
    .createHmac(algorithm, secret)
    .update(rawBody)
    .digest('hex')

  const expected = `${algorithm}=${computed}`
  // CRITICAL: constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

### Pino Redact Configuration

```typescript
// packages/observability/src/logger.ts
import pino from 'pino'

export const logger = pino({
  redact: {
    paths: [
      'email', '*.email',
      'name', '*.name',
      'phone', '*.phone',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret',
      '*.ssn',
      '*.cpf',     // Brazilian CPF (LGPD PII)
    ],
    censor: '[Redacted]',
  },
  level: process.env.LOG_LEVEL ?? 'info',
})
```

### Sentry PII Scrubbing

```typescript
// apps/app/sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    // Remove user PII from Sentry events
    if (event.user) {
      event.user = { id: event.user.id }  // keep only ID
    }
    // Scrub request body
    if (event.request?.data) {
      event.request.data = '[Filtered]'
    }
    return event
  },
  tracesSampleRate: 0.1,
})
```

---

## Dependencies

- `@upstash/ratelimit ^1.2.0`
- `@upstash/redis ^1.34.0`
- `pino` + `pino-redact`
- `@sentry/nextjs`
- `@opentelemetry/sdk-node`
- `crypto` (Node.js built-in — no external dep)

---

## Definition of Done

- [ ] Multi-tier rate limits: user (120/min), user-AI (60/min), user-export (10/h), org (1000/min), IP (60/min unauth, 20/min auth)
- [ ] 429 response with all 4 rate limit headers (Limit, Remaining, Reset, Retry-After)
- [ ] IP abuse spike detection: 6× baseline → 5-min ban + admin alert + AuditLog
- [ ] Webhook HMAC-SHA256 with `crypto.timingSafeEqual` (constant-time)
- [ ] Replay protection: Linear timestamp ±300s check
- [ ] GitHub Delivery UUID idempotency 48h (Redis SETNX)
- [ ] `pino-redact` on all configured PII paths
- [ ] Sentry user context: ID only (no name/email/IP)
- [ ] OpenTelemetry p95 alert on `/api/portfolio` > 2s
- [ ] Rate limit headers on ALL API responses (not just 429)
- [ ] Unit tests: timingSafeEqual usage, rate limit enforcement, PII redaction, replay detection

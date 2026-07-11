# Story 037 — API Keys, Webhook Endpoints & Credential Vault

**Epic:** 008 — Enterprise & Scale
**Feature:** F-008-007 Platform Integration Controls
**WSJF:** 7.5 (userValue=6, timeValue=5, riskReduction=5, jobSize=2)
**Story Points:** 5
**Priority:** Must Have
**Status:** DEFINED

---

## User Story

**As an** Org Admin,
**I want** API key management with scope control, outbound webhook endpoints with delivery logs, and AES-256-GCM credential encryption with zero-downtime rotation,
**so that** third-party integrations are authorized, monitored, and credentials are never exposed in plaintext.

---

## Acceptance Criteria

### AC-001: API key created — plaintext shown once
Given an Org Admin creates an API key with name "BI Dashboard" and scope `analytics:read`,
When the creation completes,
Then:
- The key is displayed once in a "Copy now — this won't be shown again" modal
- Format: `cmbk_live_xxx...` (prefix identifies env)
- Subsequent GETs for that key return only `cmbk_live_****{last4}`
- DB stores SHA-256 hash only (never plaintext)

### AC-002: Expired API key returns 401
Given an API key with `expiresAt=2026-06-01` (past),
When it's used to authenticate a request,
Then:
- HTTP 401 `{code: "API_KEY_EXPIRED", message: "This API key expired on 2026-06-01. Generate a new key."}`
- `ApiKeyUsageLog` records the failed attempt with `statusCode=401`

### AC-003: Webhook delivery with 5-retry backoff
Given an outbound webhook endpoint returns 503 on first delivery,
When the retry policy executes,
Then:
- Retry 1 after 2s, Retry 2 after 4s, Retry 3 after 8s, Retry 4 after 16s, Retry 5 after 32s
- After 5 failures: `WebhookDeliveryLog.status = FAILED_PERMANENTLY`
- No 6th attempt

### AC-004: Webhook test delivery
Given an Org Admin clicks "Send Test Event" on a configured endpoint,
When the synthetic event is dispatched,
Then:
- A synthetic `ping` event is sent with a test payload
- `WebhookDeliveryLog` records the test delivery with `synthetic=true`
- Response code and body are visible in the delivery log

### AC-005: Credential rotation (zero-downtime)
Given `credential-rotation` is triggered for 50 encrypted credentials,
When it completes,
Then:
- All 50 have `keyVersion = n+1`
- Decryption with the new key succeeds
- The old key version is marked for deletion after 24h grace period (existing sessions can still decrypt during grace)
- No service interruption during rotation

### AC-006: Credential never returned in API response
Given an Integration with an encrypted AWS credential stored in `config`,
When any API endpoint returns the Integration object,
Then:
- The `config` field shows `{encrypted: true, type: "AWS_CREDENTIAL", lastUpdated: "..."}`
- No decrypted values are in the response body
- No decrypted values appear in API logs or Sentry

### AC-007: Credential access audit log
Given a credential is decrypted for use in a sync operation,
When decryption occurs,
Then:
- An `AuditLog` entry is written within 1s: `action=credential.accessed`, `resourceId=<integrationId>`, `actorId`, `actorIp`, `timestamp`

### AC-008: API key scope enforcement
Given an API key with scope `analytics:read` only,
When used to call `POST /api/epics` (a mutation endpoint),
Then:
- HTTP 403 `{code: "INSUFFICIENT_SCOPE", requiredScope: "epic:write", keyScope: ["analytics:read"]}`
- The mutation does not execute

---

## Technical Notes

### API Key Generation & Storage

```typescript
// packages/security/src/api-keys.ts
import crypto from 'crypto'

export const generateApiKey = async (orgId: string, name: string, scope: string[], expiresAt?: Date, createdBy: string) => {
  const rawKey = `cmbk_live_${crypto.randomBytes(32).toString('base64url')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const lastFour = rawKey.slice(-4)

  await prisma.apiKey.create({
    data: { orgId, name, keyHash, prefix: 'cmbk_live_', lastFour, scope, expiresAt, createdBy }
  })

  // Return plaintext key ONCE — never stored
  return rawKey
}

export const validateApiKey = async (rawKey: string): Promise<{ keyId: string; orgId: string; scope: string[] } | null> => {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const key = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  })
  return key ? { keyId: key.id, orgId: key.orgId, scope: key.scope } : null
}
```

### Credential Vault (AES-256-GCM)

```typescript
// packages/security/src/credential-vault.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export const encryptCredential = async (orgId: string, plaintext: object): Promise<Buffer> => {
  const key = await deriveOrgKey(orgId) // HKDF-SHA256 from master key
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext])
}

export const decryptCredential = async (orgId: string, encrypted: Buffer): Promise<object> => {
  const key = await deriveOrgKey(orgId)
  const iv = encrypted.slice(0, 12)
  const tag = encrypted.slice(12, 28)
  const ciphertext = encrypted.slice(28)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString('utf8'))
}
```

### Webhook Delivery (Inngest)

```typescript
// packages/webhooks/src/deliver.ts
export const deliverWebhook = inngest.createFunction(
  { id: 'webhook-delivery', retries: 5, backoff: { base: 2000, factor: 2, jitter: false } },
  { event: 'webhook/delivery.requested' },
  async ({ event, attempt }) => {
    const { endpointId, payload, orgId } = event.data
    const endpoint = await getEndpoint(endpointId)

    const signature = computeHmac(JSON.stringify(payload), endpoint.secretHash)
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cosmos-Signature': `sha256=${signature}` },
      body: JSON.stringify(payload),
    })

    await prisma.webhookDeliveryLog.create({
      data: { endpointId, orgId, eventType: payload.type, requestBody: payload, responseCode: response.status, attemptCount: attempt + 1, status: response.ok ? 'DELIVERED' : 'FAILED' }
    })

    if (!response.ok) throw new Error(`Webhook delivery failed with ${response.status}`)
  }
)
```

---

## Dependencies

- `ApiKey`, `ApiKeyUsageLog`, `WebhookEndpoint`, `WebhookDeliveryLog`, `CredentialVault` models
- `@repo/security` (AES-256-GCM, HKDF key derivation)
- Inngest (webhook retry with backoff)
- `@repo/audit`
- Node.js `crypto` built-in

---

## Definition of Done

- [ ] API key generation: plaintext shown once, SHA-256 hash in DB
- [ ] Key format: `cmbk_live_` prefix with base64url random
- [ ] Expired key → 401 + `ApiKeyUsageLog`
- [ ] Scope enforcement (403 on insufficient scope)
- [ ] Outbound webhook: HMAC-signed delivery, 5-retry backoff (2s base, 2× factor)
- [ ] `WebhookDeliveryLog` with request/response bodies
- [ ] Webhook test delivery with `synthetic=true` flag
- [ ] AES-256-GCM credential encryption with per-org HKDF key derivation
- [ ] Zero-downtime rotation: new keyVersion + 24h grace + old key invalidation
- [ ] Credential never in API response (masked object only)
- [ ] Credential access `AuditLog` within 1s
- [ ] Unit tests: key validation, expiry, scope enforcement, encryption round-trip, rotation grace period

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    apiKey: { findUnique: dbMocks.findUnique },
  },
}));

import {
  generateApiKey,
  hashApiKey,
  validateApiKey,
} from "../../lib/api-keys/validate";

// ─── generateApiKey ───────────────────────────────────────────────────────────

describe("generateApiKey", () => {
  it("produces key with cmbk_live_ prefix", () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith("cmbk_live_")).toBe(true);
  });

  it("generates unique keys on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.keyHash).not.toBe(b.keyHash);
  });

  it("lastFour matches end of raw key", () => {
    const { raw, lastFour } = generateApiKey();
    expect(raw.slice(-4)).toBe(lastFour);
  });

  it("keyHash is SHA-256 of raw key", () => {
    const { raw, keyHash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(keyHash);
  });
});

// ─── validateApiKey ───────────────────────────────────────────────────────────

describe("validateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid 401 for unknown key (AC-001)", async () => {
    dbMocks.findUnique.mockResolvedValue(null);

    const result = await validateApiKey("cmbk_live_fake");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
    }
  });

  it("returns valid for active key with no scope requirement (AC-001)", async () => {
    dbMocks.findUnique.mockResolvedValue({
      id: "key-1",
      tenantId: "t-1",
      scope: ["read"],
      expiresAt: null,
      revokedAt: null,
    });

    const result = await validateApiKey("cmbk_live_valid");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tenantId).toBe("t-1");
    }
  });

  it("returns 401 for expired key (AC-001)", async () => {
    dbMocks.findUnique.mockResolvedValue({
      id: "key-1",
      tenantId: "t-1",
      scope: ["read"],
      expiresAt: new Date("2020-01-01"),
      revokedAt: null,
    });

    const result = await validateApiKey("cmbk_live_expired");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
      expect(result.reason).toMatch(/expired/i);
    }
  });

  it("returns 401 for revoked key (AC-001)", async () => {
    dbMocks.findUnique.mockResolvedValue({
      id: "key-1",
      tenantId: "t-1",
      scope: ["read"],
      expiresAt: null,
      revokedAt: new Date("2025-01-01"),
    });

    const result = await validateApiKey("cmbk_live_revoked");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
      expect(result.reason).toMatch(/revoked/i);
    }
  });

  it("returns 403 for key missing required scope (AC-001)", async () => {
    dbMocks.findUnique.mockResolvedValue({
      id: "key-1",
      tenantId: "t-1",
      scope: ["read"],
      expiresAt: null,
      revokedAt: null,
    });

    const result = await validateApiKey("cmbk_live_limited", "write");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(403);
    }
  });

  it("returns valid when key has required scope (AC-001)", async () => {
    dbMocks.findUnique.mockResolvedValue({
      id: "key-1",
      tenantId: "t-1",
      scope: ["read", "write"],
      expiresAt: null,
      revokedAt: null,
    });

    const result = await validateApiKey("cmbk_live_full", "write");

    expect(result.valid).toBe(true);
  });

  it("future expiresAt key is valid (AC-001)", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    dbMocks.findUnique.mockResolvedValue({
      id: "key-1",
      tenantId: "t-1",
      scope: [],
      expiresAt: futureDate,
      revokedAt: null,
    });

    const result = await validateApiKey("cmbk_live_future");

    expect(result.valid).toBe(true);
  });
});

// ─── encrypt round-trip (credential vault) ───────────────────────────────────

describe("encryptSecret / decryptSecret round-trip (AC-003)", async () => {
  it("encrypts and decrypts a webhook secret", async () => {
    process.env.ENCRYPTION_KEY = "0".repeat(32);
    const { encryptSecret, decryptSecret } = await import(
      "../../../../packages/security/encrypt"
    );
    const original = "wh_secret_abc123";
    const ciphertext = encryptSecret(original);
    expect(ciphertext).not.toBe(original);
    expect(decryptSecret(ciphertext)).toBe(original);
  });

  it("produces different ciphertext for same input (random IV)", async () => {
    process.env.ENCRYPTION_KEY = "0".repeat(32);
    const { encryptSecret } = await import(
      "../../../../packages/security/encrypt"
    );
    const a = encryptSecret("same-secret");
    const b = encryptSecret("same-secret");
    expect(a).not.toBe(b);
  });
});

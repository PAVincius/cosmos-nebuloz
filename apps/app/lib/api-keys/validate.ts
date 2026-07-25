import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { database } from "@repo/database";

const KEY_PREFIX = "cmbk_live_";
const RAW_BYTES = 32;

export type ApiKeyResult = {
  raw: string;
  keyHash: string;
  prefix: string;
  lastFour: string;
};

export function generateApiKey(): ApiKeyResult {
  const raw = `${KEY_PREFIX}${randomBytes(RAW_BYTES).toString("base64url")}`;
  const lastFour = raw.slice(-4);
  const keyHash = createHash("sha256").update(raw).digest("hex");
  return { raw, keyHash, prefix: KEY_PREFIX, lastFour };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type ValidationResult =
  | { valid: true; apiKeyId: string; tenantId: string; scope: string[] }
  | { valid: false; status: 401 | 403; reason: string };

export async function validateApiKey(
  raw: string,
  requiredScope?: string
): Promise<ValidationResult> {
  const keyHash = hashApiKey(raw);

  const apiKey = await database.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      tenantId: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!apiKey) {
    return { valid: false, status: 401, reason: "Invalid API key" };
  }

  if (apiKey.revokedAt) {
    return { valid: false, status: 401, reason: "API key revoked" };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, status: 401, reason: "API key expired" };
  }

  if (requiredScope && !apiKey.scope.includes(requiredScope)) {
    return {
      valid: false,
      status: 403,
      reason: `Scope '${requiredScope}' not granted`,
    };
  }

  return {
    valid: true,
    apiKeyId: apiKey.id,
    tenantId: apiKey.tenantId,
    scope: apiKey.scope,
  };
}

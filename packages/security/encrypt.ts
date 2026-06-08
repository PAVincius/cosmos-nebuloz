import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  }
  return Buffer.from(raw.slice(0, 32), "utf8");
}

type EncryptedPayload = {
  iv: string;
  tag: string;
  data: string;
};

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
  return JSON.stringify(payload);
}

export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const { iv, tag, data } = JSON.parse(ciphertext) as EncryptedPayload;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"), {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

const SECRET_FIELDS = new Set([
  "apiToken",
  "pat",
  "apiKey",
  "token",
  "password",
  "secret",
  "webhookUrl",
]);

export function encryptConfigSecrets(
  config: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).map(([k, v]) => [
      k,
      SECRET_FIELDS.has(k) && typeof v === "string" ? encryptSecret(v) : v,
    ])
  );
}

export function decryptConfigSecrets(
  config: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).map(([k, v]) => {
      if (!SECRET_FIELDS.has(k) || typeof v !== "string") {
        return [k, v];
      }
      try {
        return [k, decryptSecret(v)];
      } catch {
        return [k, v];
      }
    })
  );
}

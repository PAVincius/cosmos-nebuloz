import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyLinearSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${hmac}`);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}

export function verifyGitHubSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${hmac}`);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}

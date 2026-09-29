import { timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "Bearer ";

// A Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`.
export function validateCronSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!(expected && provided?.startsWith(BEARER_PREFIX))) {
    return false;
  }
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(provided.slice(BEARER_PREFIX.length));
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}

import { timingSafeEqual } from "node:crypto";

export function validateCronSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!(expected && provided)) {
    return false;
  }
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(provided);
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}

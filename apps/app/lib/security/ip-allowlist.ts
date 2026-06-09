// Story-033: IP allowlist check (AC-008) — pure function, no bitwise ops

export type IpCheckResult = { allowed: boolean; matchedRange?: string };

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let num = 0;
  for (const part of parts) {
    const n = Number.parseInt(part, 10);
    if (Number.isNaN(n) || n < 0 || n > 255) {
      return null;
    }
    num = num * 256 + n;
  }
  return num;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  if (!(range && bits)) {
    return false;
  }
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  const prefixLen = Number.parseInt(bits, 10);
  if (
    ipNum === null ||
    rangeNum === null ||
    Number.isNaN(prefixLen) ||
    prefixLen < 0 ||
    prefixLen > 32
  ) {
    return false;
  }
  if (prefixLen === 0) {
    return true;
  }
  // Use Math.pow to avoid bitwise operators
  const blockSize = 2 ** (32 - prefixLen);
  const ipNetwork = Math.floor(ipNum / blockSize) * blockSize;
  const rangeNetwork = Math.floor(rangeNum / blockSize) * blockSize;
  return ipNetwork === rangeNetwork;
}

export function checkIpAllowlist(
  ip: string,
  allowedRanges: string[]
): IpCheckResult {
  if (allowedRanges.length === 0) {
    return { allowed: true };
  }

  for (const range of allowedRanges) {
    if (range.includes("/")) {
      if (isIpInCidr(ip, range)) {
        return { allowed: true, matchedRange: range };
      }
    } else if (range === ip) {
      return { allowed: true, matchedRange: range };
    }
  }

  return { allowed: false };
}

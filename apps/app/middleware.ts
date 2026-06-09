import { type NextRequest, NextResponse } from "next/server";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
  );
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return NextResponse.next();
  }

  const { checkIpBan, detectAndBanSpike } = await import(
    "@repo/rate-limit/ip-ban"
  );
  const { rateLimits, buildRateLimitHeaders } = await import(
    "@repo/rate-limit"
  );

  // Check IP ban first (5-min abuse ban)
  if (await checkIpBan(ip)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "300",
        "X-RateLimit-Limit": "0",
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  // Apply IP-level rate limit
  const result = await rateLimits.ip.limit(ip);
  const headers = buildRateLimitHeaders({
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  });

  if (!result.success) {
    // Detect spike: if we're over-limit, check for abuse
    await detectAndBanSpike(ip);

    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: headers as Record<string, string>,
    });
  }

  const res = NextResponse.next();
  for (const [key, val] of Object.entries(headers as Record<string, string>)) {
    res.headers.set(key, val);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};

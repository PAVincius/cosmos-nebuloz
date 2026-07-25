import { authMiddleware } from "@repo/auth/proxy";
import {
  noseconeOptions,
  noseconeOptionsWithToolbar,
  securityMiddleware,
} from "@repo/security/proxy";
import type { NextProxy } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "./env";

const securityHeaders = env.FLAGS_SECRET
  ? securityMiddleware(noseconeOptionsWithToolbar)
  : securityMiddleware(noseconeOptions);

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
  );
}

async function applyRateLimit(req: NextRequest): Promise<NextResponse | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return null;
  }

  const ip = getClientIp(req);
  const { checkIpBan, detectAndBanSpike } = await import(
    "@repo/rate-limit/ip-ban"
  );
  const { rateLimits, buildRateLimitHeaders } = await import(
    "@repo/rate-limit"
  );

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

  const result = await rateLimits.ip.limit(ip);
  const headers = buildRateLimitHeaders({
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  });

  if (!result.success) {
    await detectAndBanSpike(ip);
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: headers as Record<string, string>,
    });
  }

  return null;
}

export default authMiddleware(async (request: NextRequest) => {
  // Rate limit API routes only
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const rateLimitResponse = await applyRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  const res = securityHeaders();
  const response =
    res instanceof Response
      ? new NextResponse(res.body, { status: res.status, headers: res.headers })
      : NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}) as unknown as NextProxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

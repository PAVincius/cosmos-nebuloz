import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/",
  "/api/health",
  "/api/inngest",
];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  const isProtectedApi =
    pathname.startsWith("/api/") &&
    !PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const isAuthenticatedRoute = pathname.startsWith("/(authenticated)/");

  if (!(isProtectedApi || isAuthenticatedRoute)) {
    return NextResponse.next();
  }

  const sessionCookie =
    req.cookies.get("better-auth.session_token") ??
    req.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signIn = req.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/(authenticated)/:path*",
    "/api/((?!auth/|webhooks/|health|inngest).*)",
  ],
};

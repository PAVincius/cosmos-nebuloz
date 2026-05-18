import { type NextRequest, NextResponse } from "next/server";

/** Aligned with `apps/app/app/(authenticated)/**` — early redirect before RSC. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/portfolio",
  "/arts",
  "/teams",
  "/analytics",
  "/settings",
  "/epics",
  "/risks",
  "/dependencies",
  "/pi-planning",
  "/workflows",
  "/search",
  "/webhooks",
  "/onboarding",
];

type MiddlewareFn = (
  request: NextRequest
) => Response | Promise<Response | undefined> | undefined;

export const authMiddleware =
  (callback: MiddlewareFn) =>
  async (request: NextRequest): Promise<Response> => {
    const { pathname } = request.nextUrl;
    const isProtected = PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

    if (isProtected) {
      const sessionRes = await fetch(
        `${request.nextUrl.origin}/api/auth/get-session`,
        {
          headers: { cookie: request.headers.get("cookie") ?? "" },
          cache: "no-store",
        }
      ).catch(() => null);

      const session = sessionRes?.ok
        ? await sessionRes.json().catch(() => null)
        : null;

      if (!session?.user) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
    }

    return (await callback(request)) ?? NextResponse.next();
  };

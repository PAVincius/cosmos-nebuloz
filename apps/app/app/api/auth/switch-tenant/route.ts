import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { getCookies } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { SwitchTenantSchema } from "../../../actions/schemas";

export const POST = async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let tenantId: string;
  try {
    ({ tenantId } = SwitchTenantSchema.parse(body));
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    throw err;
  }

  const member = await database.tenantMember.findFirst({
    where: { tenantId, userId: session.user.id },
  });

  if (!member) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await database.session.update({
    where: { token: session.session.token },
    data: { activeTenantId: tenantId },
  });

  // Better Auth caches session data (including activeTenantId) in a signed
  // cookie. Clear it so the next getSession() re-reads the updated row from DB.
  // Both name and attributes must match how better-auth sets the cookie
  // (better-auth/dist/cookies/index.mjs, secureCookiePrefix/createCookie):
  // over https the name gets a "__Secure-" prefix, and a Set-Cookie clearing
  // a "__Secure-" cookie without the Secure attribute is dropped by the
  // browser — the stale cookie would survive and the cache bug would persist.
  const response = NextResponse.json({
    success: true,
    activeTenantId: tenantId,
  });
  const sessionDataCookie = getCookies(auth.options).sessionData;
  const sameSite = sessionDataCookie.attributes.sameSite
    ?.toString()
    .toLowerCase() as "lax" | "strict" | "none" | undefined;
  response.cookies.set(sessionDataCookie.name, "", {
    ...sessionDataCookie.attributes,
    sameSite,
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
};

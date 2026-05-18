import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { type NextRequest, NextResponse } from "next/server";
import { SwitchTenantSchema } from "../../../actions/schemas";
import { ZodError } from "zod";

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

  return NextResponse.json({ success: true, activeTenantId: tenantId });
};

import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { type NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const memberships = await database.tenantMember.findMany({
    where: { userId: session.user.id },
    include: {
      tenant: { select: { id: true, name: true, slug: true, logo: true } },
    },
  });

  return NextResponse.json({
    tenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      logo: m.tenant.logo,
      role: m.role,
    })),
    activeTenantId:
      (session.session as unknown as { activeTenantId?: string })
        .activeTenantId ?? null,
  });
};

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const MAX_LIMIT = 100;

// GET /api/audit?limit=100&cursor=<id>&after=<timestamp>&action=<filter>
export async function GET(req: NextRequest): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireTenantSession(await headers());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(
    Math.max(1, Number(searchParams.get("limit") ?? MAX_LIMIT)),
    MAX_LIMIT
  );
  const cursor = searchParams.get("cursor");
  const after = searchParams.get("after");
  const action = searchParams.get("action");

  const where = {
    tenantId: ctx.tenantId,
    ...(action ? { action } : {}),
    ...(after ? { createdAt: { gt: new Date(after) } } : {}),
  };

  const entries = await database.auditLog.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tenantId: true,
      actorId: true,
      actorType: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      ipAddress: true,
      createdAt: true,
    },
  });

  const hasMore = entries.length > limit;
  const data = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? (data.at(-1)?.id ?? null) : null;

  return NextResponse.json({ data, nextCursor, hasMore });
}

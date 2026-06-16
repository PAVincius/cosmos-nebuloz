import { AuthError, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const FEATURE_SELECT = {
  id: true,
  title: true,
  statusId: true,
  storyPoints: true,
  bv: true,
  tc: true,
  rr: true,
  js: true,
  wsjfScore: true,
  epicId: true,
  assigneeUserId: true,
  completedAt: true,
  createdAt: true,
} as const;

function getErrorCode(error: unknown): string | undefined {
  if (error instanceof AuthError) {
    return error.code;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return;
}

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50)
  );
  return { page, limit, skip: (page - 1) * limit };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { searchParams } = new URL(request.url);
    const epicId = searchParams.get("epicId") ?? undefined;
    const { page, limit, skip } = parsePagination(searchParams);

    const where = {
      tenantId: ctx.tenantId,
      ...(epicId ? { epicId } : {}),
    };

    const [items, total] = await Promise.all([
      database.feature.findMany({
        where,
        select: FEATURE_SELECT,
        orderBy: { wsjfScore: "desc" },
        skip,
        take: limit,
      }),
      database.feature.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    if (getErrorCode(error) === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    log.error("[api/features]", { error: String(error) });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

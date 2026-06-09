import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";

// GET /api/compliance/soc2-export?from=<ISO>&to=<ISO>
// Returns JSONL (application/x-ndjson) sorted ascending by createdAt.
// Requires ADMIN role. Export action is self-logged in AuditLog.
export async function GET(req: NextRequest): Promise<Response> {
  let ctx;
  try {
    ctx = await requireTenantSession(await headers());
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (ctx.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const entries = await database.auditLog.findMany({
    where: {
      tenantId: ctx.tenantId,
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // AC-002: log the export request itself (fire-and-forget)
  database.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: "compliance.soc2_export.requested",
        metadata: { from, to, count: entries.length },
      },
    })
    .catch((err) => {
      log.error("[soc2-export] self-audit failed", err);
    });

  const jsonl = entries.map((e) => JSON.stringify(e)).join("\n");
  const filename = `soc2-audit-${from ?? "all"}.jsonl`;

  return new Response(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

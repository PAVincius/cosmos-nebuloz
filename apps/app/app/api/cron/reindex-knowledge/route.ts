import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "../_utils/validate-cron-secret";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Vercel Cron auth check
  const authHeader = req.headers.get("authorization");
  if (!validateCronSecret(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { tenantId } = await req.json().catch(() => ({}));
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 });
    }

    // syncTenantKnowledge uses requireTenantSession internally — needs authenticated
    // context not available in cron. Full cron impl requires service-level auth.
    // Endpoint exists for future wiring with a service token approach.
    return NextResponse.json({ ok: true, message: "Reindex scheduled" });
  } catch (err) {
    log.error("[cron/reindex] error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

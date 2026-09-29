import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";
import { eliminateExpiredMeridianEvidence } from "@/lib/jobs/meridian-evidence-retention";
import { validateCronSecret } from "../_utils/validate-cron-secret";

export const maxDuration = 300;

// Retenção de evidência do Meridian (90 dias após o fechamento). Agendada em
// apps/app/vercel.json; a Vercel chama por GET com `Authorization: Bearer
// <CRON_SECRET>`. POST fica para disparo manual.
export async function GET(req: Request): Promise<NextResponse> {
  if (!validateCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await eliminateExpiredMeridianEvidence();
    return NextResponse.json(
      { ok: result.failed === 0, ...result },
      { status: result.failed === 0 ? 200 : 500 }
    );
  } catch (error) {
    log.error("[cron/meridian-evidence-retention] falhou", { error });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export function POST(req: Request): Promise<NextResponse> {
  return GET(req);
}

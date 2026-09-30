import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";
import { processPendingErasureRequests } from "@/lib/jobs/lgpd-erasure";
import { validateCronSecret } from "../_utils/validate-cron-secret";

export const maxDuration = 300;

// Processa pedidos de eliminação LGPD (DataSubjectRequest ERASURE PENDING).
// Agendada em apps/app/vercel.json; a Vercel chama por GET com
// `Authorization: Bearer <CRON_SECRET>`. POST fica para disparo manual.
export async function GET(req: Request): Promise<NextResponse> {
  if (!validateCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingErasureRequests();
    // Pedido que esgotou as tentativas (FAILED) faz a invocação aparecer como
    // falha na Vercel, igual à retenção; o que só será retentado não.
    const ok = result.failed === 0;
    return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
  } catch (error) {
    log.error("[cron/lgpd-erasure] falhou", { error });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export function POST(req: Request): Promise<NextResponse> {
  return GET(req);
}

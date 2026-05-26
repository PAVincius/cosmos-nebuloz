import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Trigger anomaly detection for all active tenants.
  // Full implementation requires tenant iteration + analyzeFlowAnomalies.
  // Stub for now — real impl dispatched via queue.
  return NextResponse.json({ ok: true, message: "Anomaly scheduler triggered" });
}

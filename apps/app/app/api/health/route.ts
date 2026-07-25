import { database } from "@repo/database";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;

  try {
    const t0 = Date.now();
    await database.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch {
    // DB check failed — report degraded but keep 200 so LB doesn't kill the pod
  }

  const status = dbOk ? "ok" : "degraded";
  const httpStatus = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      responseMs: Date.now() - start,
      checks: {
        database: dbOk
          ? { status: "ok", latencyMs: dbLatencyMs }
          : { status: "error" },
      },
    },
    { status: httpStatus }
  );
}

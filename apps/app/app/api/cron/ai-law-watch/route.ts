import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { validateCronSecret } from "../_utils/validate-cron-secret";

// Vercel Cron sends GET; forward to POST so external triggers use the correct method.
export function GET(req: Request): Promise<NextResponse> {
  return POST(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");

  if (!validateCronSecret(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Checagem global (tenant system), não por tenant cliente — um evento só,
  // sem paginação de integração como billing-sync-dispatch.
  await inngest.send({ name: "ai-law/watch.requested" as const });

  return NextResponse.json({ dispatched: true });
}

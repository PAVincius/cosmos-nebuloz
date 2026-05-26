import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

const PAGE_SIZE = 100;

export async function GET(req: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const BILLING_SOURCES = ["billing_aws", "billing_gcp", "billing_azure"];
  let offset = 0;
  let dispatched = 0;

  while (true) {
    const integrations = await database.integration.findMany({
      where: { source: { in: BILLING_SOURCES }, status: "ACTIVE" },
      select: { id: true, tenantId: true },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      skip: offset,
    });

    if (integrations.length === 0) {
      break;
    }

    const events = integrations.map((i) => ({
      name: "billing/sync.requested" as const,
      data: { tenantId: i.tenantId, integrationId: i.id },
    }));

    await inngest.send(events);
    dispatched += integrations.length;
    offset += PAGE_SIZE;

    if (integrations.length < PAGE_SIZE) {
      break;
    }
  }

  return NextResponse.json({ dispatched });
}

import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { validateCronSecret } from "../_utils/validate-cron-secret";

const PAGE_SIZE = 100;

// Vercel Cron sends GET; forward to POST so external triggers use the correct method.
export function GET(req: Request): Promise<NextResponse> {
  return POST(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");

  if (!validateCronSecret(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const BILLING_SOURCES = [
    "billing_aws",
    "billing_gcp",
    "billing_azure",
  ] as const;
  let offset = 0;
  let dispatched = 0;

  while (true) {
    const integrations = await database.integration.findMany({
      where: { source: { in: [...BILLING_SOURCES] }, status: "ACTIVE" },
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

    try {
      await inngest.send(events);
      dispatched += integrations.length;
    } catch (err) {
      // Log and continue — do not abort remaining pages
      // biome-ignore lint: temporary until project logger is available
      console.error(
        "[billing-sync-dispatch] inngest.send failed at offset",
        offset,
        err
      );
    }
    offset += PAGE_SIZE;

    if (integrations.length < PAGE_SIZE) {
      break;
    }
  }

  return NextResponse.json({ dispatched });
}

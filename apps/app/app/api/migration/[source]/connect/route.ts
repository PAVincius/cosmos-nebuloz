import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { Prisma } from "@repo/database";
import { testJiraConnection } from "@/lib/migration/jira-client";
import { testAzureConnection } from "@/lib/migration/azure-client";
import { testTrelloConnection } from "@/lib/migration/trello-client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { source } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (source === "jira") {
      await testJiraConnection(
        body as { baseUrl: string; email: string; apiToken: string },
      );
    } else if (source === "azure") {
      await testAzureConnection(
        body as { organization: string; project: string; pat: string },
      );
    } else if (source === "trello") {
      await testTrelloConnection(
        body as { apiKey: string; apiToken: string },
      );
    } else if (source === "csv") {
      if (!body.content) throw new Error("CSV content is required.");
    } else {
      return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }

    const existing = await database.migrationConnection.findFirst({
      where: { tenantId: ctx.tenantId, source },
    });

    const conn = existing
      ? await database.migrationConnection.update({
          where: { id: existing.id },
          data: { config: body as unknown as Prisma.InputJsonValue, status: "connected", errorMessage: null },
        })
      : await database.migrationConnection.create({
          data: {
            tenantId: ctx.tenantId,
            source,
            config: body as unknown as Prisma.InputJsonValue,
            status: "connected",
          },
        });

    return NextResponse.json({ connectionId: conn.id, status: "connected" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

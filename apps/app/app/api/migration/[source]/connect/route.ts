import { requireTenantSession } from "@repo/auth/server";
import { database, type Prisma } from "@repo/database";
import { encryptConfigSecrets } from "@repo/security/encrypt";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { testAzureConnection } from "@/lib/migration/azure-client";
import { testJiraConnection } from "@/lib/migration/jira-client";
import { testTrelloConnection } from "@/lib/migration/trello-client";

const CREDENTIAL_PATTERN = /token|password|secret|credential|apiToken|pat\b/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { source } = await params;

    const VALID_SOURCES = ["csv", "jira", "azure", "trello"] as const;
    if (!VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
      return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    if (source === "jira") {
      await testJiraConnection(
        body as { baseUrl: string; email: string; apiToken: string }
      );
    } else if (source === "azure") {
      await testAzureConnection(
        body as { organization: string; project: string; pat: string }
      );
    } else if (source === "trello") {
      await testTrelloConnection(body as { apiKey: string; apiToken: string });
    } else if (source === "csv" && !body.content) {
      throw new Error("CSV content is required.");
    }

    const existing = await database.migrationConnection.findFirst({
      where: { tenantId: ctx.tenantId, source },
    });

    const safeConfig = encryptConfigSecrets(
      body as Record<string, unknown>
    ) as unknown as Prisma.InputJsonValue;

    const conn = existing
      ? await database.migrationConnection.update({
          where: { id: existing.id },
          data: {
            config: safeConfig,
            status: "connected",
            errorMessage: null,
          },
        })
      : await database.migrationConnection.create({
          data: {
            tenantId: ctx.tenantId,
            source,
            config: safeConfig,
            status: "connected",
          },
        });

    return NextResponse.json({ connectionId: conn.id, status: conn.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    const safeMessage = CREDENTIAL_PATTERN.test(message)
      ? "Connection test failed. Check your credentials."
      : message;

    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }
}

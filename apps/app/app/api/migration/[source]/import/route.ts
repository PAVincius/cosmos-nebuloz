import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { fetchAzureWorkItems } from "@/lib/migration/azure-client";
import { parseMigrationCSV } from "@/lib/migration/csv-parser";
import { fetchJiraItems } from "@/lib/migration/jira-client";
import { fetchTrelloCards } from "@/lib/migration/trello-client";
import type {
  ImportReport,
  MappingRule,
  MigrationItem,
} from "@/lib/migration/types";

const CREDENTIAL_PATTERN = /token|password|secret|credential|apiToken|pat\b/i;

async function createMigrationEntities(
  ctx: { tenantId: string },
  items: MigrationItem[],
  _mappingData: MappingRule[]
): Promise<ImportReport> {
  const report: ImportReport = {
    created: { epics: 0, features: 0, stories: 0, teams: 0 },
    updated: 0,
    errors: [],
    totalProcessed: 0,
  };

  await database.$transaction(
    async (tx) => {
      const featureTitleToId = new Map<string, string>();

      for (const item of items) {
        report.totalProcessed += 1;
        try {
          if (item.type === "epic") {
            await tx.epic.create({
              data: {
                tenantId: ctx.tenantId,
                title: item.title,
                statusId: item.status ?? "BACKLOG",
              },
            });
            report.created.epics += 1;
          } else if (item.type === "feature") {
            const feature = await tx.feature.create({
              data: {
                tenantId: ctx.tenantId,
                title: item.title,
                statusId: item.status ?? "BACKLOG",
              },
            });
            featureTitleToId.set(item.title, feature.id);
            report.created.features += 1;
          } else if (item.type === "story") {
            const parentFeatureId = item.parentTitle
              ? (featureTitleToId.get(item.parentTitle) ?? null)
              : null;

            await tx.story.create({
              data: {
                tenantId: ctx.tenantId,
                title: item.title,
                description: item.description ?? null,
                status: item.status ?? "BACKLOG",
                storyPoints: item.storyPoints ?? 1,
                featureId: parentFeatureId,
              },
            });
            report.created.stories += 1;
          }
        } catch (err) {
          report.errors.push({
            item: item.title,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    },
    { timeout: 30_000 }
  );

  return report;
}

async function checkImportRateLimit(ip: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(5, "10 m"),
    prefix: "migration-import",
  });
  const { success } = await limiter.limit(ip);
  return success;
}

async function fetchItems(
  source: string,
  conn: { config: unknown; discoveryData: unknown }
): Promise<MigrationItem[]> {
  const config = conn.config as Record<string, unknown>;
  const allItems: MigrationItem[] = [];

  if (source === "csv") {
    allItems.push(...parseMigrationCSV((config.content as string) ?? ""));
  } else if (source === "jira") {
    const disc = conn.discoveryData as {
      projects: { key?: string; name: string }[];
    } | null;
    for (const p of (disc?.projects ?? []).slice(0, 5)) {
      const fetched = await fetchJiraItems(
        config as { baseUrl: string; email: string; apiToken: string },
        p.key ?? p.name
      );
      allItems.push(...fetched);
    }
  } else if (source === "azure") {
    allItems.push(
      ...(await fetchAzureWorkItems(
        config as { organization: string; project: string; pat: string }
      ))
    );
  } else if (source === "trello") {
    const disc = conn.discoveryData as {
      projects: { id: string; name: string }[];
    } | null;
    for (const board of (disc?.projects ?? []).slice(0, 3)) {
      const fetched = await fetchTrelloCards(
        config as { apiKey: string; apiToken: string },
        board.id ?? ""
      );
      allItems.push(...fetched);
    }
  }

  return allItems;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!(await checkImportRateLimit(ip))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const ctx = await requireTenantSession(await headers());
    const { source } = await params;
    const { connectionId, mappingData } = (await req.json()) as {
      connectionId: string;
      mappingData: MappingRule[];
    };

    const conn = await database.migrationConnection.findFirst({
      where: { id: connectionId, tenantId: ctx.tenantId },
    });
    if (!conn) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    const allItems = await fetchItems(source, conn);
    const report = await createMigrationEntities(
      { tenantId: ctx.tenantId },
      allItems,
      mappingData
    );

    await database.migrationConnection.update({
      where: { id: connectionId },
      data: { importReport: report as object },
    });

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    const safeMessage = CREDENTIAL_PATTERN.test(message)
      ? "Operation failed. Check your credentials and try again."
      : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}

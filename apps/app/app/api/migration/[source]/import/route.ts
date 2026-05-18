import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { parseMigrationCSV } from "@/lib/migration/csv-parser";
import { fetchJiraItems } from "@/lib/migration/jira-client";
import { fetchAzureWorkItems } from "@/lib/migration/azure-client";
import { fetchTrelloCards } from "@/lib/migration/trello-client";
import type { ImportReport, MappingRule, MigrationItem } from "@/lib/migration/types";

async function createMigrationEntities(
  ctx: { tenantId: string },
  items: MigrationItem[],
  mappingData: MappingRule[],
): Promise<ImportReport> {
  const report: ImportReport = {
    created: { epics: 0, features: 0, stories: 0, teams: 0 },
    updated: 0,
    errors: [],
    totalProcessed: 0,
  };

  // Map from source title to created Feature id (used as parent for stories)
  const featureTitleToId = new Map<string, string>();

  // Items created individually; partial success is reported in errors[] rather than rolled back
  for (const item of items) {
    report.totalProcessed++;
    try {
      if (item.type === "epic") {
        // Epics in the domain model: tenantId, title, statusId, order
        await database.epic.create({
          data: {
            tenantId: ctx.tenantId,
            title: item.title,
            statusId: item.status ?? "BACKLOG",
          },
        });
        report.created.epics++;
      } else if (item.type === "feature") {
        // Feature has no description field — omit it
        const feature = await database.feature.create({
          data: {
            tenantId: ctx.tenantId,
            title: item.title,
            statusId: item.status ?? "BACKLOG",
          },
        });
        featureTitleToId.set(item.title, feature.id);
        report.created.features++;
      } else if (item.type === "story") {
        // Stories link to Feature via featureId
        const parentFeatureId = item.parentTitle
          ? featureTitleToId.get(item.parentTitle) ?? null
          : null;

        await database.story.create({
          data: {
            tenantId: ctx.tenantId,
            title: item.title,
            description: item.description ?? null,
            status: item.status ?? "BACKLOG",
            storyPoints: item.storyPoints ?? 1,
            featureId: parentFeatureId,
          },
        });
        report.created.stories++;
      }
    } catch (err) {
      report.errors.push({
        item: item.title,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return report;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  try {
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
        { status: 404 },
      );
    }

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
          p.key ?? p.name,
        );
        allItems.push(...fetched);
      }
    } else if (source === "azure") {
      allItems.push(
        ...await fetchAzureWorkItems(
          config as { organization: string; project: string; pat: string },
        ),
      );
    } else if (source === "trello") {
      const disc = conn.discoveryData as {
        projects: { id: string; name: string }[];
      } | null;
      for (const board of (disc?.projects ?? []).slice(0, 3)) {
        const fetched = await fetchTrelloCards(
          config as { apiKey: string; apiToken: string },
          board.id ?? "",
        );
        allItems.push(...fetched);
      }
    }

    const report = await createMigrationEntities(
      { tenantId: ctx.tenantId },
      allItems,
      mappingData,
    );

    await database.migrationConnection.update({
      where: { id: connectionId },
      data: { importReport: report as object },
    });

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    const safeMessage = /token|password|secret|credential|apiToken|pat\b/i.test(message)
      ? "Operation failed. Check your credentials and try again."
      : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}

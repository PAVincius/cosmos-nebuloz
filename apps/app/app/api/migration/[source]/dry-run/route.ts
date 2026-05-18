import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { parseMigrationCSV } from "@/lib/migration/csv-parser";
import { fetchJiraItems } from "@/lib/migration/jira-client";
import { fetchAzureWorkItems } from "@/lib/migration/azure-client";
import { fetchTrelloCards } from "@/lib/migration/trello-client";
import type { DryRunResult, MappingRule, MigrationItem } from "@/lib/migration/types";

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
      const discovery = conn.discoveryData as {
        projects: { key?: string; name: string }[];
      } | null;
      for (const p of (discovery?.projects ?? []).slice(0, 5)) {
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
      const discovery = conn.discoveryData as {
        projects: { id: string; name: string }[];
      } | null;
      for (const board of (discovery?.projects ?? []).slice(0, 3)) {
        const fetched = await fetchTrelloCards(
          config as { apiKey: string; apiToken: string },
          board.id ?? "",
        );
        allItems.push(...fetched);
      }
    }

    // mappingData is validated to ensure callers pass it — unused in count logic
    void mappingData;

    const counts: DryRunResult["counts"] = {
      epics: 0,
      features: 0,
      stories: 0,
      teams: 0,
      sprints: 0,
    };
    const conflicts: DryRunResult["conflicts"] = [];

    for (const item of allItems) {
      if (item.type === "epic") counts.epics++;
      else if (item.type === "feature") counts.features++;
      else counts.stories++;

      if (!item.title?.trim()) {
        conflicts.push({
          item: `[${item.type}] (sem título)`,
          reason: "Título vazio",
        });
      }
    }

    const result: DryRunResult = {
      counts,
      conflicts: conflicts.slice(0, 50),
      totalItems: allItems.length,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dry-run failed";
    const safeMessage = /token|password|secret|credential|apiToken|pat\b/i.test(message)
      ? "Operation failed. Check your credentials and try again."
      : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database, Prisma } from "@repo/database";
import {
  discoverJiraProjects,
  fetchJiraItems,
} from "@/lib/migration/jira-client";
import { discoverAzureProjects } from "@/lib/migration/azure-client";
import { discoverTrelloBoards } from "@/lib/migration/trello-client";
import { parseMigrationCSV } from "@/lib/migration/csv-parser";
import type { MigrationItem } from "@/lib/migration/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { source } = await params;
    const { connectionId } = (await req.json()) as { connectionId: string };

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
    let projects: { id?: string; key?: string; name: string }[] = [];
    let items: MigrationItem[] = [];

    if (source === "jira") {
      projects = await discoverJiraProjects(
        config as {
          baseUrl: string;
          email: string;
          apiToken: string;
          projectKeys?: string[];
        },
      );
      for (const p of projects.slice(0, 5)) {
        const projectItems = await fetchJiraItems(
          config as { baseUrl: string; email: string; apiToken: string },
          p.key ?? p.name,
        );
        items.push(...projectItems);
      }
    } else if (source === "azure") {
      projects = await discoverAzureProjects(
        config as { organization: string; project: string; pat: string },
      );
    } else if (source === "trello") {
      projects = await discoverTrelloBoards(
        config as { apiKey: string; apiToken: string; boardIds?: string[] },
      );
    } else if (source === "csv") {
      items = parseMigrationCSV((config.content as string) ?? "");
      projects = [{ name: "CSV Import", id: "csv" }];
    }

    await database.migrationConnection.update({
      where: { id: connectionId },
      data: {
        discoveryData: {
          projects,
          itemSample: items.slice(0, 20),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      projects,
      itemCount: items.length,
      itemSample: items.slice(0, 20),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Discovery failed",
      },
      { status: 500 },
    );
  }
}

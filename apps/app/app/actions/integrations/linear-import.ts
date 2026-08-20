"use server";

import { database } from "@repo/database";
import {
  linearImportTeamIssues,
  linearStateToStatus,
} from "./connectors/linear";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportInput = {
  tenantId: string;
  apiKey: string;
  selectedTeamIds: string[];
  piPlanId?: string;
};

export type PreviewItem = {
  linearId: string;
  title: string;
  url: string;
  cosmosType: "Feature";
  statusId: string;
  alreadySynced: boolean;
  teamName: string;
  isChild: boolean;
};

export type DryRunResult = {
  preview: PreviewItem[];
  totalIssues: number;
  alreadySyncedCount: number;
};

export type ExecuteResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

// ─── Dry-run ─────────────────────────────────────────────────────────────────

export async function linearDryRun(input: ImportInput): Promise<DryRunResult> {
  const preview: PreviewItem[] = [];

  for (const teamId of input.selectedTeamIds) {
    let cursor: string | null = null;

    do {
      const { issues, nextCursor } = await linearImportTeamIssues(
        input.apiKey,
        teamId,
        cursor ?? undefined
      );

      for (const issue of issues) {
        const existing = await database.linearSync.findUnique({
          where: {
            tenantId_linearId_linearType: {
              tenantId: input.tenantId,
              linearId: issue.id,
              linearType: "issue",
            },
          },
        });

        preview.push({
          linearId: issue.id,
          title: issue.title,
          url: issue.url,
          cosmosType: "Feature",
          statusId: linearStateToStatus(issue.state.type, issue.state.name),
          alreadySynced: !!existing,
          teamName: issue.team.name,
          isChild: !!issue.parent,
        });
      }

      cursor = nextCursor;
    } while (cursor);
  }

  const alreadySyncedCount = preview.filter((p) => p.alreadySynced).length;

  return {
    preview,
    totalIssues: preview.length,
    alreadySyncedCount,
  };
}

// ─── Execute import ───────────────────────────────────────────────────────────

export async function linearExecuteImport(
  input: ImportInput & { previewItems: PreviewItem[] }
): Promise<ExecuteResult> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of input.previewItems) {
    if (item.alreadySynced) {
      skipped += 1;
      continue;
    }

    try {
      const created = await database.feature.create({
        data: {
          tenantId: input.tenantId,
          title: item.title,
          statusId: item.statusId,
          externalId: item.linearId,
          externalSource: "linear",
          externalUrl: item.url,
          ...(input.piPlanId ? { piPlanId: input.piPlanId } : {}),
        },
        select: { id: true },
      });

      await database.linearSync.create({
        data: {
          tenantId: input.tenantId,
          linearId: item.linearId,
          linearType: "issue",
          cosmosId: created.id,
          cosmosType: "Feature",
        },
      });

      imported += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`[${item.linearId}] ${item.title}: ${message}`);
    }
  }

  return { imported, skipped, errors };
}

import { parse } from "csv-parse/sync";
import type { MigrationItem, MigrationItemType } from "./types";

const REQUIRED_COLUMNS = ["type", "title"] as const;

export function parseMigrationCSV(csvContent: string): MigrationItem[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (records.length === 0) {
    return [];
  }

  const cols = Object.keys(records[0]);
  for (const req of REQUIRED_COLUMNS) {
    if (!cols.includes(req)) {
      throw new Error(
        `Missing required columns: ${req}. Found: ${cols.join(", ")}`
      );
    }
  }

  return records
    .filter((r) => r.title?.trim())
    .map((r) => ({
      type: (r.type?.toLowerCase() ?? "story") as MigrationItemType,
      title: r.title.trim(),
      description: r.description?.trim() || undefined,
      status: r.status?.trim() || undefined,
      team: r.team?.trim() || undefined,
      sprint: r.sprint?.trim() || undefined,
      storyPoints: r.storyPoints
        ? Number.parseInt(r.storyPoints, 10) || 0
        : undefined,
      parentTitle: r.parentTitle?.trim() || undefined,
    }));
}

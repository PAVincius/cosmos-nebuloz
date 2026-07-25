// CSV export column spec and large export detection (story-045 AC-004)

export const CSV_COLUMNS = [
  "ART",
  "Feature",
  "State",
  "AssignedTeam",
  "Sprint",
  "StoryPointsCompleted",
  "StoryPointsTotal",
  "WSJF",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

export const LARGE_EXPORT_THRESHOLD = 5000;

export function isLargeExport(rowCount: number): boolean {
  return rowCount > LARGE_EXPORT_THRESHOLD;
}

export type FeatureCsvRow = {
  art: string;
  feature: string;
  state: string;
  assignedTeam: string;
  sprint: string;
  storyPointsCompleted: number;
  storyPointsTotal: number;
  wsjf: number;
};

export function buildCsvHeader(): string {
  return CSV_COLUMNS.join(",");
}

export function buildCsvRow(row: FeatureCsvRow): string {
  return [
    row.art,
    row.feature,
    row.state,
    row.assignedTeam,
    row.sprint,
    row.storyPointsCompleted,
    row.storyPointsTotal,
    row.wsjf,
  ]
    .map(String)
    .join(",");
}

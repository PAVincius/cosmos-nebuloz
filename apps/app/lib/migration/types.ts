export type MigrationItemType = "epic" | "feature" | "story" | "team" | "sprint";

export interface MigrationItem {
  type: MigrationItemType;
  title: string;
  description?: string;
  status?: string;
  team?: string;
  sprint?: string;
  storyPoints?: number;
  parentTitle?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface MappingRule {
  sourceKey: string;
  targetType: "portfolio" | "value_stream" | "art" | "team" | "pi";
  targetName: string;
}

export interface DryRunResult {
  counts: {
    epics: number;
    features: number;
    stories: number;
    teams: number;
    sprints: number;
  };
  conflicts: Array<{ item: string; reason: string }>;
  totalItems: number;
}

export interface ImportReport {
  created: { epics: number; features: number; stories: number; teams: number };
  updated: number;
  errors: Array<{ item: string; error: string }>;
  totalProcessed: number;
}

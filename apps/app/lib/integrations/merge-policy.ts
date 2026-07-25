// Story-024: Field-level merge policy for Linear↔Cosmos bidirectional sync

export type FieldMergePolicy =
  | "LINEAR_WINS"
  | "COSMOS_WINS"
  | "LAST_WRITE_WINS";

export type MergePolicyMap = Record<string, FieldMergePolicy>;

// SAFe fields always COSMOS_WINS; engineering execution fields LINEAR_WINS (AC-002)
export const DEFAULT_LINEAR_FIELD_POLICY: MergePolicyMap = {
  status: "LINEAR_WINS",
  assigneeId: "LINEAR_WINS",
  cycleId: "LINEAR_WINS",
  title: "LAST_WRITE_WINS",
  description: "LAST_WRITE_WINS",
  // SAFe fields — always COSMOS_WINS
  wsjfScore: "COSMOS_WINS",
  investScore: "COSMOS_WINS",
  strategicThemeId: "COSMOS_WINS",
  piPlanId: "COSMOS_WINS",
  featureId: "COSMOS_WINS",
  artId: "COSMOS_WINS",
};

export type FieldResolution =
  | { action: "APPLY"; value: unknown }
  | { action: "SKIP"; linearValue: unknown; cosmosValue: unknown };

export function resolveField(opts: {
  field: string;
  linearValue: unknown;
  cosmosValue: unknown;
  linearUpdatedAt: Date;
  cosmosUpdatedAt: Date;
  policy?: MergePolicyMap;
}): FieldResolution {
  const policyMap = opts.policy ?? DEFAULT_LINEAR_FIELD_POLICY;
  const rule: FieldMergePolicy = policyMap[opts.field] ?? "LINEAR_WINS";

  if (rule === "COSMOS_WINS") {
    return {
      action: "SKIP",
      linearValue: opts.linearValue,
      cosmosValue: opts.cosmosValue,
    };
  }

  if (rule === "LINEAR_WINS") {
    return { action: "APPLY", value: opts.linearValue };
  }

  // LAST_WRITE_WINS
  if (opts.linearUpdatedAt >= opts.cosmosUpdatedAt) {
    return { action: "APPLY", value: opts.linearValue };
  }
  return {
    action: "SKIP",
    linearValue: opts.linearValue,
    cosmosValue: opts.cosmosValue,
  };
}

// Map a Linear issue state name to a Cosmos Story status
const LINEAR_TO_COSMOS_STATUS: Record<string, string> = {
  Todo: "BACKLOG",
  "In Progress": "IN_PROGRESS",
  "In Review": "IN_REVIEW",
  Done: "DONE",
  Cancelled: "CLOSED",
  Canceled: "CLOSED",
  Duplicate: "CLOSED",
};

export function mapLinearStatusToCosmos(linearStateName: string): string {
  return LINEAR_TO_COSMOS_STATUS[linearStateName] ?? "BACKLOG";
}

// Map a Cosmos Story status to a Linear state name (for outbound push)
const COSMOS_TO_LINEAR_STATUS: Record<string, string> = {
  BACKLOG: "Todo",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  CLOSED: "Cancelled",
};

export function mapCosmosStatusToLinear(cosmosStatus: string): string {
  return COSMOS_TO_LINEAR_STATUS[cosmosStatus] ?? "Todo";
}

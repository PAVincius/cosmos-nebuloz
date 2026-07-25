// Anomaly Detection Rule Catalogue — Story-021 (Epic 007)

export type RuleEntry = {
  name: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  defaultThreshold: number;
  bounds: { min: number; max: number } | null; // null = non-configurable (CRITICAL rules)
  critical: boolean; // non-disablable
  suggestedAction: string;
};

export const ANOMALY_RULES: Record<string, RuleEntry> = {
  "R-VEL-01": {
    name: "Velocity Variance",
    type: "VELOCITY_DROP",
    severity: "HIGH",
    defaultThreshold: 0.2,
    bounds: { min: 0.1, max: 0.4 },
    critical: false,
    suggestedAction: "SM to review sprint commitments and team capacity",
  },
  "R-WIP-01": {
    name: "WIP Overload",
    type: "WIP_OVERLOAD",
    severity: "MEDIUM",
    defaultThreshold: 1.5,
    bounds: { min: 1.2, max: 3.0 },
    critical: false,
    suggestedAction: "SM to limit WIP and review in-flight items",
  },
  "R-IMP-01": {
    name: "Impediment Aging (HIGH)",
    type: "IMPEDIMENT_AGING",
    severity: "HIGH",
    defaultThreshold: 48,
    bounds: { min: 24, max: 120 },
    critical: false,
    suggestedAction: "SM to escalate aged impediment to RTE",
  },
  "R-IMP-02": {
    name: "Critical Impediment",
    type: "IMPEDIMENT_AGING",
    severity: "CRITICAL",
    defaultThreshold: 24,
    bounds: null,
    critical: true,
    suggestedAction: "RTE to escalate to Portfolio Risk Register immediately",
  },
  "R-DEP-01": {
    name: "Dependency Cascade Risk",
    type: "DEPENDENCY_RISK",
    severity: "CRITICAL",
    defaultThreshold: 3,
    bounds: null,
    critical: true,
    suggestedAction: "RTE to facilitate dependency resolution in ROAM board",
  },
  "R-OBJ-01": {
    name: "PI Objective at Risk",
    type: "OBJECTIVE_AT_RISK",
    severity: "HIGH",
    defaultThreshold: 0.5,
    bounds: { min: 0.3, max: 0.9 },
    critical: false,
    suggestedAction: "PO to review objective achievability with team",
  },
  "R-RISK-01": {
    name: "OWNED Risk Overdue",
    type: "RISK_OVERDUE",
    severity: "HIGH",
    defaultThreshold: 7,
    bounds: { min: 3, max: 30 },
    critical: false,
    suggestedAction: "Risk owner to update mitigation plan or escalate",
  },
  "R-EPIC-01": {
    name: "Epic Cycle Time Exceeded",
    type: "CYCLE_TIME_DEGRADATION",
    severity: "MEDIUM",
    defaultThreshold: 0.3,
    bounds: { min: 0.1, max: 0.6 },
    critical: false,
    suggestedAction: "LPM to review epic scope and splitting opportunities",
  },
  "R-STALE-01": {
    name: "Stale Defect",
    type: "STALE_DEFECT",
    severity: "LOW",
    defaultThreshold: 48,
    bounds: { min: 24, max: 168 },
    critical: false,
    suggestedAction: "Team to triage or close stale defects",
  },
  "R-FLOW-01": {
    name: "Flow Efficiency Nosedive",
    type: "EFFICIENCY_NOSEDIVE",
    severity: "HIGH",
    defaultThreshold: 0.25,
    bounds: { min: 0.1, max: 0.5 },
    critical: false,
    suggestedAction: "SM to identify and remove active waste in sprint flow",
  },
  "R-OKR-01": {
    name: "OKR at Risk",
    type: "OKR_AT_RISK",
    severity: "MEDIUM",
    defaultThreshold: 0.6,
    bounds: { min: 0.4, max: 0.9 },
    critical: false,
    suggestedAction: "Strategy lead to review OKR alignment with teams",
  },
};

export function getEffectiveThreshold(
  ruleId: string,
  orgOverride?: number
): number {
  const rule = ANOMALY_RULES[ruleId];
  if (!rule) {
    throw new Error(`Unknown rule: ${ruleId}`);
  }
  if (orgOverride === undefined) {
    return rule.defaultThreshold;
  }
  return orgOverride;
}

export function validateThresholdInBounds(
  ruleId: string,
  value: number
): { valid: boolean; bounds: { min: number; max: number } | null } {
  const rule = ANOMALY_RULES[ruleId];
  if (!rule) {
    return { valid: false, bounds: null };
  }
  if (!rule.bounds) {
    return { valid: true, bounds: null };
  }
  const valid = value >= rule.bounds.min && value <= rule.bounds.max;
  return { valid, bounds: rule.bounds };
}

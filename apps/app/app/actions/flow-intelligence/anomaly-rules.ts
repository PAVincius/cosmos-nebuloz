export type AnomalySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AnomalyRuleName =
  | "VelocityCliff"
  | "WIPOverload"
  | "PredictabilityCollapse"
  | "CycleTimeDegradation"
  | "EfficiencyNosedive"
  | "WorkTypeImbalance"
  | "StaleCompetencyAssessment"
  | "ImprovementActionOverdue";

export type DetectedAnomaly = {
  rule: AnomalyRuleName;
  severity: AnomalySeverity;
  metric: string;
  delta: number;
  metadata: Record<string, unknown>;
  suggestedCompetency?: string;
  suggestedMetric?: string;
};

export type AnomalyRuleInput = {
  current: {
    flowVelocityTotal: number;
    flowTimeAvgDays: number;
    flowEfficiency: number;
    flowPredictability: number;
    flowLoadCurrent: number;
    flowDistribution: Record<string, number>;
  };
  history: Array<{
    flowVelocityTotal: number;
    flowPredictability?: number;
    flowTimeAvgDays?: number;
  }>;
  openActions: Array<{ id: string; dueDate: Date | null; status: string }>;
  latestAssessmentAt: Date | null;
  now: Date;
};

function velocityCliff(input: AnomalyRuleInput): DetectedAnomaly | null {
  if (input.history.length < 4) {
    return null;
  }
  const avg =
    input.history.slice(0, 4).reduce((s, h) => s + h.flowVelocityTotal, 0) / 4;
  if (avg === 0) {
    return null;
  }
  const ratio = input.current.flowVelocityTotal / avg;
  if (ratio >= 0.7) {
    return null;
  }
  return {
    rule: "VelocityCliff",
    severity: "HIGH",
    metric: "flowVelocity",
    delta: Math.round((ratio - 1) * 100),
    metadata: {
      current: input.current.flowVelocityTotal,
      historicalAvg: Math.round(avg),
    },
    suggestedCompetency: "AGILE_PRODUCT_DELIVERY",
  };
}

function wipOverload(input: AnomalyRuleInput): DetectedAnomaly | null {
  const { flowLoadCurrent, flowVelocityTotal } = input.current;
  if (flowVelocityTotal === 0 || flowLoadCurrent <= flowVelocityTotal * 2) {
    return null;
  }
  return {
    rule: "WIPOverload",
    severity: "CRITICAL",
    metric: "flowLoad",
    delta: Math.round((flowLoadCurrent / flowVelocityTotal - 2) * 100),
    metadata: { load: flowLoadCurrent, velocity: flowVelocityTotal },
    suggestedMetric: "flow_load",
  };
}

function predictabilityCollapse(
  input: AnomalyRuleInput
): DetectedAnomaly | null {
  if (input.current.flowPredictability >= 0.65) {
    return null;
  }
  return {
    rule: "PredictabilityCollapse",
    severity: "HIGH",
    metric: "flowPredictability",
    delta: Math.round((input.current.flowPredictability - 0.65) * 100),
    metadata: { current: input.current.flowPredictability },
    suggestedCompetency: "TEAM_TECHNICAL_AGILITY",
  };
}

function cycleTimeDegradation(input: AnomalyRuleInput): DetectedAnomaly | null {
  const hist = input.history.filter((h) => (h.flowTimeAvgDays ?? 0) > 0);
  if (hist.length < 2) {
    return null;
  }
  const avg =
    hist.reduce((s, h) => s + (h.flowTimeAvgDays ?? 0), 0) / hist.length;
  if (input.current.flowTimeAvgDays <= avg * 1.5) {
    return null;
  }
  return {
    rule: "CycleTimeDegradation",
    severity: "MEDIUM",
    metric: "flowTime",
    delta: Math.round((input.current.flowTimeAvgDays / avg - 1) * 100),
    metadata: {
      current: input.current.flowTimeAvgDays,
      historicalAvg: Math.round(avg * 10) / 10,
    },
    suggestedCompetency: "ORGANIZATIONAL_AGILITY",
  };
}

function efficiencyNosedive(input: AnomalyRuleInput): DetectedAnomaly | null {
  if (input.current.flowEfficiency >= 0.45) {
    return null;
  }
  return {
    rule: "EfficiencyNosedive",
    severity: "MEDIUM",
    metric: "flowEfficiency",
    delta: Math.round((input.current.flowEfficiency - 0.45) * 100),
    metadata: { current: input.current.flowEfficiency },
    suggestedMetric: "flow_efficiency",
  };
}

function workTypeImbalance(input: AnomalyRuleInput): DetectedAnomaly | null {
  const dist = input.current.flowDistribution;
  const total = Object.values(dist).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return null;
  }
  const defectPct = ((dist.defect ?? 0) / total) * 100;
  if (defectPct <= 40) {
    return null;
  }
  return {
    rule: "WorkTypeImbalance",
    severity: "MEDIUM",
    metric: "flowDistribution",
    delta: Math.round(defectPct - 40),
    metadata: { defectPct: Math.round(defectPct) },
    suggestedMetric: "flow_distribution",
  };
}

function staleCompetencyAssessment(
  input: AnomalyRuleInput
): DetectedAnomaly | null {
  if (!input.latestAssessmentAt) {
    return null;
  }
  const ageDays =
    (input.now.getTime() - input.latestAssessmentAt.getTime()) / 86_400_000;
  if (ageDays <= 180) {
    return null;
  }
  return {
    rule: "StaleCompetencyAssessment",
    severity: "LOW",
    metric: "competencyAssessment",
    delta: Math.round(ageDays - 180),
    metadata: { ageDays: Math.round(ageDays) },
  };
}

function improvementActionOverdue(
  input: AnomalyRuleInput
): DetectedAnomaly | null {
  const overdue = input.openActions.filter(
    (a) =>
      a.dueDate !== null &&
      a.dueDate < input.now &&
      (a.status === "OPEN" || a.status === "IN_PROGRESS")
  );
  if (overdue.length === 0) {
    return null;
  }
  return {
    rule: "ImprovementActionOverdue",
    severity: "MEDIUM",
    metric: "improvementActions",
    delta: overdue.length,
    metadata: {
      overdueCount: overdue.length,
      actionIds: overdue.map((a) => a.id),
    },
  };
}

const RULES = [
  velocityCliff,
  wipOverload,
  predictabilityCollapse,
  cycleTimeDegradation,
  efficiencyNosedive,
  workTypeImbalance,
  staleCompetencyAssessment,
  improvementActionOverdue,
];

export function runAllRules(input: AnomalyRuleInput): DetectedAnomaly[] {
  return RULES.flatMap((rule) => {
    const result = rule(input);
    return result !== null ? [result] : [];
  });
}

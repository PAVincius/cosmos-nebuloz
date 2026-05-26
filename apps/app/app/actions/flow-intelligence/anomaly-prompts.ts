export type AnomalyData = {
  scope: string;
  scopeId: string;
  delta?: number;
  before?: number;
  after?: number;
  value?: number;
  threshold?: number;
  breakdown?: Record<string, number>;
  distribution?: Record<string, number>;
  windowSprints?: number;
  daysStale?: number;
  count?: number;
  avgDaysOverdue?: number;
};

export const RULE_PROMPTS: Record<string, (data: AnomalyData) => string> = {
  VelocityCliff: (d) =>
    `Velocity dropped ${Math.round((d.delta ?? 0) * 100)}% for ${d.scope} ${d.scopeId} (from ${d.before} to ${d.after} SP).
Explain in 2 sentences the likely SAFe causes and recommend 1-2 specific actions an RTE/SM can take.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,

  WIPOverload: (d) =>
    `WIP is ${d.value}, exceeding limit of ${d.threshold} for ${d.scope} ${d.scopeId}.
Reference SAFe Lean principle of limiting WIP. Recommend a drain strategy.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,

  PredictabilityCollapse: (d) =>
    `Predictability fell to ${((d.value ?? 0) * 100).toFixed(0)}% for ${d.scope} ${d.scopeId}.
Diagnose planning vs scope vs capacity root cause. Suggest one PI experiment.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,

  CycleTimeDegradation: (d) =>
    `Flow Time rose from ${d.before}h to ${d.after}h over ${d.windowSprints} sprints for ${d.scope} ${d.scopeId}.
Identify if uniform or concentrated. Recommend work-type focus.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,

  EfficiencyNosedive: (d) =>
    `Flow Efficiency at ${((d.value ?? 0) * 100).toFixed(0)}% for ${d.scope} ${d.scopeId} (healthy=30-50%).
Identify bottleneck. Recommend value stream improvement.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,

  WorkTypeImbalance: (d) =>
    `Work distribution ${JSON.stringify(d.distribution)} for ${d.scope} ${d.scopeId}.
Evaluate imbalance vs business priorities. Suggest rebalancing.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,

  StaleCompetencyAssessment: (d) =>
    `Competency assessment ${d.daysStale} days stale for ${d.scope} ${d.scopeId}.
Identify which SAFe competencies are at risk.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,

  ImprovementActionOverdue: (d) =>
    `${d.count} improvement actions overdue avg ${d.avgDaysOverdue} days for ${d.scope} ${d.scopeId}.
Recommend prioritization strategy.
Return JSON: { "narrative": "...", "actions": ["...", "..."] }`,
};

import { z } from "zod";
import { nnStr, optStr } from "@/app/actions/_base";

// ─── SAFe 7 Core Competencies ────────────────────────────────────────────────

export const SAFE_COMPETENCIES = [
  { key: "TEAM_TECHNICAL_AGILITY", label: "Team & Technical Agility" },
  { key: "AGILE_PRODUCT_DELIVERY", label: "Agile Product Delivery" },
  {
    key: "ENTERPRISE_SOLUTION_DELIVERY",
    label: "Enterprise Solution Delivery",
  },
  { key: "LEAN_PORTFOLIO_MANAGEMENT", label: "Lean Portfolio Management" },
  { key: "ORGANIZATIONAL_AGILITY", label: "Organizational Agility" },
  { key: "CONTINUOUS_LEARNING_CULTURE", label: "Continuous Learning Culture" },
  { key: "LEAN_AGILE_LEADERSHIP", label: "Lean-Agile Leadership" },
] as const;

export type CompetencyKey = (typeof SAFE_COMPETENCIES)[number]["key"];

// ─── Scope ────────────────────────────────────────────────────────────────────

export const ScopeType = z.enum(["team", "art", "value_stream", "portfolio"]);
export type ScopeTypeValue = z.infer<typeof ScopeType>;

// ─── Action Status ────────────────────────────────────────────────────────────

export const ActionStatus = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
]);
export type ActionStatusValue = z.infer<typeof ActionStatus>;

// ─── Flow Metric Keys (match DB comment values) ───────────────────────────────

export const FLOW_METRICS = [
  "flow_distribution",
  "flow_velocity",
  "flow_time",
  "flow_load",
  "flow_efficiency",
  "flow_predictability",
] as const;

export type FlowMetricKey = (typeof FLOW_METRICS)[number];

export const FLOW_METRIC_LABELS: Record<FlowMetricKey, string> = {
  flow_distribution: "Distribuição",
  flow_velocity: "Velocity",
  flow_time: "Flow Time",
  flow_load: "Flow Load (WIP)",
  flow_efficiency: "Flow Efficiency",
  flow_predictability: "Flow Predictability",
};

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const CreateAssessmentSchema = z.object({
  scope: ScopeType,
  scopeId: z.string().min(1),
  competency: z.string().min(1),
  score: z.number().min(1).max(5),
  notes: optStr,
  assessedById: z.string().optional(),
  piPlanId: z.string().optional(),
});

export const CreateImprovementActionSchema = z.object({
  title: nnStr,
  description: optStr,
  scope: ScopeType,
  scopeId: z.string().min(1),
  status: ActionStatus.default("OPEN"),
  relatedMetric: z
    .enum(FLOW_METRICS as unknown as [string, ...string[]])
    .optional(),
  dueDate: z.string().datetime().optional(),
  assessmentId: z.string().optional(),
});

export const UpdateImprovementActionSchema =
  CreateImprovementActionSchema.partial();

export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;
export type CreateImprovementActionInput = z.infer<
  typeof CreateImprovementActionSchema
>;
export type UpdateImprovementActionInput = z.infer<
  typeof UpdateImprovementActionSchema
>;

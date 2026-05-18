import { z } from "zod";
import { nnStr, optStr, optCuid, cuid } from "@/app/actions/_base";

export const GovernanceStatusSchema = z.enum([
  "draft",
  "review",
  "approved",
  "rejected",
  "on_hold",
  "deferred",
]);
export type GovernanceStatus = z.infer<typeof GovernanceStatusSchema>;

export const ApprovalEstadoSchema = z.enum([
  "open",
  "in_review",
  "approved",
  "rejected",
  "cancelled",
]);
export type ApprovalEstado = z.infer<typeof ApprovalEstadoSchema>;

export const StepEstadoSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "skipped",
]);
export type StepEstado = z.infer<typeof StepEstadoSchema>;

export const WorkflowTipoSchema = z.enum([
  "epic_investment",
  "budget_guardrail_change",
  "theme_creation",
]);
export type WorkflowTipo = z.infer<typeof WorkflowTipoSchema>;

export const DecisaoSchema = z.enum([
  "approved",
  "rejected",
  "deferred",
  "changed",
]);
export type Decisao = z.infer<typeof DecisaoSchema>;

export const SubmitEpicForApprovalSchema = z.object({
  epicId: cuid,
  investmentEstimate: z.number().positive().optional(),
  valueStreamId: optCuid,
  themeId: optCuid,
  guardrailFlags: z.array(z.string()).default([]),
});
export type SubmitEpicForApprovalInput = z.infer<
  typeof SubmitEpicForApprovalSchema
>;

export const ReviewStepSchema = z.object({
  stepId: cuid,
  decision: z.enum(["approved", "rejected"]),
  comentario: optStr,
});
export type ReviewStepInput = z.infer<typeof ReviewStepSchema>;

export const GovernedEpicFiltersSchema = z.object({
  status: GovernanceStatusSchema.optional(),
  valueStreamId: optCuid,
  themeId: optCuid,
});
export type GovernedEpicFilters = z.infer<typeof GovernedEpicFiltersSchema>;

export const DecisionLogFiltersSchema = z.object({
  tipo: z
    .enum(["epic_decision", "budget_decision", "theme_decision"])
    .optional(),
  valueStreamId: optCuid,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type DecisionLogFilters = z.infer<typeof DecisionLogFiltersSchema>;

// ─── Public-facing types ──────────────────────────────────────────────────────

export type GovernedEpicWithDetails = {
  id: string;
  tenantId: string;
  epicId: string;
  epicTitle: string;
  governanceStatus: GovernanceStatus;
  guardrailFlags: string[];
  investmentEstimate: number | null;
  valueStreamId: string | null;
  themeId: string | null;
  currentApprovalRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApprovalStepInstancePublic = {
  id: string;
  etapaOrdem: number;
  roleRequired: string;
  approverId: string | null;
  estado: StepEstado;
  comentario: string | null;
  timestamp: Date | null;
};

export type ApprovalRequestWithSteps = {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowNome: string;
  targetType: string;
  targetId: string;
  estado: ApprovalEstado;
  initiatorId: string;
  governedEpicId: string | null;
  epicTitle: string | null;
  steps: ApprovalStepInstancePublic[];
  createdAt: Date;
  updatedAt: Date;
};

export type DecisionLogEntryPublic = {
  id: string;
  tipo: string;
  targetType: string;
  targetId: string;
  valueStreamId: string | null;
  decisao: Decisao;
  justificativa: string;
  dadosSuporte: Record<string, unknown>;
  decisorId: string;
  dataDecisao: Date;
};

export type WorkflowEtapa = {
  order: number;
  roleRequired: string;
  criteria?: string;
};

import type { ActionStatusValue } from "./schema";

export type AssessmentAction = {
  id: string;
  title: string;
  status: ActionStatusValue;
  relatedMetric: string | null;
  dueDate: Date | null;
};

export type AssessmentWithActions = {
  id: string;
  scope: string;
  scopeId: string;
  competency: string;
  competencyLabel: string;
  score: number;
  assessedAt: Date;
  notes: string | null;
  actions: AssessmentAction[];
};

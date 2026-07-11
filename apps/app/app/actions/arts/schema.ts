export type PIObjectiveInput = {
  teamId?: string;
  title: string;
  description?: string;
  businessValue: number;
  isStretch: boolean;
};

export type PIRiskInput = {
  title: string;
  description?: string;
  status: string;
  category?: string;
  impact: string;
  probability: string;
};

export type CreatePIPlanDetailsInput = {
  artId: string;
  /** Ignored server-side — name is always generated as PI-{YYYY}-{Q}. Kept optional for backward compat. */
  name?: string;
  startDate?: string;
  endDate?: string;
  featureIds: string[];
  objectives: PIObjectiveInput[];
  risks: PIRiskInput[];
  includeConfidenceVote?: boolean;
  confidenceThreshold?: number;
};

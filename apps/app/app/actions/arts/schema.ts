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
  name: string;
  startDate?: string;
  endDate?: string;
  featureIds: string[];
  objectives: PIObjectiveInput[];
  risks: PIRiskInput[];
};

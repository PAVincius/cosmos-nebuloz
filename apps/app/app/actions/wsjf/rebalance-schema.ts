export type AIAccessStatus = {
  allowed: boolean;
  plan: string;
  limit: number;
  usedThisPi: number;
  usedTotal: number;
  remainingUses: number; // -1 = unlimited
  reason?: string;
};

type FeatureSuggestion = {
  featureId: string;
  currentBV: number;
  currentTC: number;
  currentRR: number;
  currentJS: number;
  currentWSJF: number;
  suggestedBV: number;
  suggestedTC: number;
  suggestedRR: number;
  suggestedJS: number;
  suggestedWSJF: number;
  delta: number;
  justification: string;
  impactFactor:
    | "team_capacity"
    | "dependency"
    | "deadline"
    | "member_availability"
    | "velocity_trend"
    | "priority_drift";
  confidence: number;
  featureTitle: string;
  epicTitle: string;
};

export type RebalancingResult = {
  modifiedCount: number;
  unchangedCount: number;
  portfolioInsight: string;
  suggestions: FeatureSuggestion[];
};

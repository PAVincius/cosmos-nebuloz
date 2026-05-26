export const GOVERNANCE_STATES = [
  "FUNNEL",
  "ANALYZING",
  "PORTFOLIO_BACKLOG",
  "IMPLEMENTING",
  "DONE",
  "CANCELLED",
] as const;
export type GovernanceState = (typeof GOVERNANCE_STATES)[number];

const TRANSITIONS: Record<GovernanceState, GovernanceState[]> = {
  FUNNEL:            ["ANALYZING", "CANCELLED"],
  ANALYZING:         ["FUNNEL", "PORTFOLIO_BACKLOG", "CANCELLED"],
  PORTFOLIO_BACKLOG: ["ANALYZING", "IMPLEMENTING", "CANCELLED"],
  IMPLEMENTING:      ["DONE", "CANCELLED"],
  DONE:              [],
  CANCELLED:         [],
};

export function canTransition(from: GovernanceState, to: GovernanceState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: GovernanceState): GovernanceState[] {
  return TRANSITIONS[from] ?? [];
}

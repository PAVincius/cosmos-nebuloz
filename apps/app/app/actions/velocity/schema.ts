export type SprintWindow = {
  sprintLabel: string; // "Sprint -1", "Sprint -2", etc relative to today
  startDate: Date;
  endDate: Date;
  spCompleted: number;
  featuresCompleted: number;
};

export type MemberVelocityStats = {
  userId: string;
  totalFeaturesCompleted: number;
  totalSPCompleted: number;
  avgSPPerSprint: number; // normalised to 14-day sprints
  recentSprints: SprintWindow[];
};

export type TeamVelocityStats = {
  teamId: string;
  memberStats: MemberVelocityStats[];
  totalTeamSPPerSprint: number; // sum of avgSPPerSprint for all members
  burndownData: BurndownEntry[];
};

export type BurndownEntry = {
  date: string; // ISO date string
  totalSP: number; // total SP in "current sprint" (last 14 days)
  completedSP: number;
  inProgressSP: number; // IMPLEMENTING status
  remainingSP: number; // total - completed
};

export type BurndownPoint = {
  day: number; // 1-N
  label: string; // "Dia 1", "Dia 2"
  ideal: number; // linear decrease from total to 0
  actual: number | null; // null for future days
  completed: number;
  inProgress: number;
};

export type ProgramBoardFeature = {
  id: string;
  title: string;
  statusId: string;
  storyPoints: number;
  wsjfScore: number;
  assigneeUserId: string | null;
  epicId: string | null;
  epicTitle: string | null;
  externalSource: string | null;
  externalUrl: string | null;
};

export type ProgramBoardCell = {
  teamId: string;
  sprintIndex: number;
  features: ProgramBoardFeature[];
};

export type ProgramBoardDependency = {
  id: string;
  blockingFeatureId: string;
  blockedFeatureId: string;
  blockingFeatureTitle: string;
  blockedFeatureTitle: string;
  status: string;
  severity: string;
  /** True when blocking feature's sprint index >= blocked feature's sprint index (provider delivers too late) */
  isConflict: boolean;
};

export type ProgramBoardData = {
  teams: { id: string; name: string; velocity: number | null }[];
  sprints: string[];
  matrix: ProgramBoardCell[];
  piPlan: {
    id: string;
    name: string;
    startDate: Date | null;
    endDate: Date | null;
  } | null;
  dependencies: ProgramBoardDependency[];
};

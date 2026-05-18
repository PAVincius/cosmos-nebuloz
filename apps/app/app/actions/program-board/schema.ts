export type ProgramBoardFeature = {
  id: string;
  title: string;
  statusId: string;
  storyPoints: number;
  wsjfScore: number;
  assigneeUserId: string | null;
  epicId: string | null;
  epicTitle: string | null;
};

export type ProgramBoardCell = {
  teamId: string;
  sprintIndex: number;
  features: ProgramBoardFeature[];
};

export type ProgramBoardData = {
  teams: { id: string; name: string; velocity: number | null }[];
  sprints: string[];
  matrix: ProgramBoardCell[];
  piPlan: { id: string; name: string; startDate: Date | null; endDate: Date | null } | null;
};

export type FeatureRow = {
  id: string;
  title: string;
  statusId: string;
  storyPoints: number;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  wsjfScore: number;
  epicId: string | null;
  assigneeUserId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  externalSource: string | null;
  externalUrl: string | null;
};

export type FeatureDetail = {
  id: string;
  title: string;
  statusId: string;
  storyPoints: number;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  wsjfScore: number;
  epicId: string | null;
  piPlanId: string | null;
  assigneeUserId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  epic: { id: string; title: string } | null;
  piPlan: { id: string; name: string } | null;
  externalSource: string | null;
  externalUrl: string | null;
};

export type DependencyWithFeatures = {
  id: string;
  blockingFeatureId: string;
  blockedFeatureId: string;
  description: string | null;
  status: string;
  type: string;
  severity: string;
  ownerUserId: string | null;
  notes: string | null;
  dueDate: Date | null;
  createdAt: Date;
  blockingFeature: { id: string; title: string; statusId: string; epicId: string | null; epic: { id: string; title: string } | null };
  blockedFeature: { id: string; title: string; statusId: string; epicId: string | null; epic: { id: string; title: string } | null };
};

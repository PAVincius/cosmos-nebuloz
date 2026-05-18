export type RiskWithPI = {
  id: string;
  tenantId: string;
  piPlanId: string | null;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  impact: string;
  probability: string;
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  piPlan: { id: string; name: string } | null;
};

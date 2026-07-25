export type ImpedimentWithTeam = {
  id: string;
  tenantId: string;
  teamId: string | null;
  teamName: string | null;
  title: string;
  description: string | null;
  status: string;
  ownerUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ageDays: number;
  isEscalated: boolean;
};

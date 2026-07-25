export type TeamVelocitySummary = {
  teamId: string;
  teamName: string;
  artId: string | null;
  artName: string | null;
  avgSPPerSprint: number;
  lastSprintSP: number;
  trend: "up" | "down" | "neutral";
  sprints: { label: string; sp: number }[];
};

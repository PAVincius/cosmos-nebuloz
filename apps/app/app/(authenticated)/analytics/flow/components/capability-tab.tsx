"use client";

import { TASK_TYPES } from "@/app/actions/flow-intelligence/capability-planning/capability-schema";
import { CapabilityGapCard } from "./capability-gap-card";
import { CapabilityMatrix } from "./capability-matrix";
import { CapabilityPrivacyNotice } from "./capability-privacy-notice";

type TeamRow = {
  id: string;
  name: string;
  capabilities: Partial<Record<string, { deliveredSp: number; confidenceLevel: number }>>;
};

type GapRow = {
  teamId: string;
  initiativeId: string;
  teamName: string;
  initiativeTitle: string;
  overallScore: number;
  topGap: { category: string; gap: number };
  recommendation: string;
};

type Props = {
  teams: TeamRow[];
  gaps: GapRow[];
};

export function CapabilityTab({ teams, gaps }: Props) {
  return (
    <div className="space-y-4 p-4">
      <CapabilityPrivacyNotice />

      <div>
        <h3 className="mb-1 text-sm font-semibold">Team Capability Matrix</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Capacidade técnica agregada por time × skill. Sem dados individuais.
        </p>
        <CapabilityMatrix teams={teams} taskTypes={TASK_TYPES} />
      </div>

      {gaps.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Capability Gaps</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {gaps.map((g) => (
              <CapabilityGapCard key={`${g.teamId}-${g.initiativeId}`} gap={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

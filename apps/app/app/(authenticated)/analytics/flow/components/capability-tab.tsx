"use client";

import { TASK_TYPES } from "@/app/actions/flow-intelligence/capability-planning/capability-schema";
import { CapabilityGapCard } from "./capability-gap-card";
import { CapabilityMatrix } from "./capability-matrix";
import { CapabilityPrivacyNotice } from "./capability-privacy-notice";

type TeamRow = {
  id: string;
  name: string;
  capabilities: Partial<
    Record<string, { deliveredSp: number; confidenceLevel: number }>
  >;
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
        <h3 className="mb-1 font-semibold text-sm">Team Capability Matrix</h3>
        <p className="mb-2 text-muted-foreground text-xs">
          Capacidade técnica agregada por time × skill. Sem dados individuais.
        </p>
        <CapabilityMatrix taskTypes={TASK_TYPES} teams={teams} />
      </div>

      {gaps.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-sm">Capability Gaps</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {gaps.map((g) => (
              <CapabilityGapCard
                gap={g}
                key={`${g.teamId}-${g.initiativeId}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

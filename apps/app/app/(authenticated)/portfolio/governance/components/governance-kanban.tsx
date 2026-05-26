"use client";

import {
  GOVERNANCE_STATES,
  type GovernanceState,
} from "@/app/actions/governance/state-machine";
import { EpicGovernanceCard } from "./epic-governance-card";

type EpicRow = {
  id: string;
  title: string;
  investScore: number | null;
  valueStream?: string | null;
  governanceStatus: GovernanceState;
};

type Props = { epics: EpicRow[] };

const COLUMN_LABELS: Record<GovernanceState, string> = {
  FUNNEL: "Funnel",
  ANALYZING: "Analisando",
  PORTFOLIO_BACKLOG: "Portfolio Backlog",
  IMPLEMENTING: "Implementando",
  DONE: "Concluído",
  CANCELLED: "Cancelado",
};

export function GovernanceKanban({ epics }: Props) {
  const byState = Object.fromEntries(
    GOVERNANCE_STATES.map((s) => [
      s,
      epics.filter((e) => e.governanceStatus === s),
    ]),
  ) as Record<GovernanceState, EpicRow[]>;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {GOVERNANCE_STATES.map((state) => (
        <div key={state} className="min-w-[200px] shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {COLUMN_LABELS[state]}
            </h3>
            <span className="text-xs text-muted-foreground">
              {byState[state].length}
            </span>
          </div>
          <div className="space-y-2">
            {byState[state].map((epic) => (
              <EpicGovernanceCard key={epic.id} epic={epic} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

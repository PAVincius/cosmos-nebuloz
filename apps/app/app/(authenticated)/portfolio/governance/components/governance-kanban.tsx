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
    ])
  ) as Record<GovernanceState, EpicRow[]>;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {GOVERNANCE_STATES.map((state) => (
        <div className="min-w-[200px] shrink-0" key={state}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              {COLUMN_LABELS[state]}
            </h3>
            <span className="text-muted-foreground text-xs">
              {byState[state].length}
            </span>
          </div>
          <div className="space-y-2">
            {byState[state].map((epic) => (
              <EpicGovernanceCard epic={epic} key={epic.id} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

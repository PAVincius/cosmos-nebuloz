import { listGovernedEpics, listApprovalRequests } from "@/app/actions/governance";
import { GovernanceBoard } from "./components/governance-board";
import { GovernanceKanban } from "./components/governance-kanban";
import {
  GOVERNANCE_STATES,
  type GovernanceState,
} from "@/app/actions/governance/state-machine";

export const metadata = { title: "Governance Board — COSMOS" };

function toKanbanState(status: string): GovernanceState {
  if ((GOVERNANCE_STATES as readonly string[]).includes(status)) {
    return status as GovernanceState;
  }
  const legacyMap: Record<string, GovernanceState> = {
    draft: "FUNNEL",
    review: "ANALYZING",
    approved: "PORTFOLIO_BACKLOG",
    rejected: "CANCELLED",
    on_hold: "PORTFOLIO_BACKLOG",
    deferred: "FUNNEL",
  };
  return legacyMap[status] ?? "FUNNEL";
}

export default async function GovernancePage() {
  const [epicsResult, requestsResult] = await Promise.all([
    listGovernedEpics(),
    listApprovalRequests(),
  ]);

  const epics = epicsResult.ok ? epicsResult.data : [];
  const requests = requestsResult.ok ? requestsResult.data : [];

  const kanbanEpics = epics.map((ge) => ({
    id: ge.epicId,
    title: ge.epicTitle ?? "Untitled",
    investScore: null as number | null,
    valueStream: null as string | null,
    governanceStatus: toKanbanState(ge.governanceStatus),
  }));

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Portfolio Governance Board
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Épicos em fluxo de aprovação LPM — SAFe 6.0
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-6 space-y-10">
        <section>
          <h2 className="mb-4 text-lg font-semibold">Fluxo de Aprovação</h2>
          <GovernanceBoard epics={epics} requests={requests} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Pipeline de Governança</h2>
          <GovernanceKanban epics={kanbanEpics} />
        </section>
      </div>
    </div>
  );
}

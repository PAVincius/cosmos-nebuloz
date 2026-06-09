import { PageHeader } from "@/app/(authenticated)/components/page-header";
import {
  listApprovalRequests,
  listGovernedEpics,
} from "@/app/actions/governance";
import {
  GOVERNANCE_STATES,
  type GovernanceState,
} from "@/app/actions/governance/state-machine";
import { appDesign } from "@/lib/app-design";
import { GovernanceBoard } from "./components/governance-board";
import { GovernanceKanban } from "./components/governance-kanban";

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
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Governance" },
        ]}
        subtitle="Épicos em fluxo de aprovação LPM — SAFe 6.0"
        title="Portfolio Governance Board"
      />
      <div className={`${appDesign.bodyScroll} flex flex-col gap-10`}>
        <section>
          <h2 className="mb-4 font-semibold text-base tracking-tight">
            Fluxo de Aprovação
          </h2>
          <GovernanceBoard epics={epics} requests={requests} />
        </section>
        <section>
          <h2 className="mb-4 font-semibold text-base tracking-tight">
            Pipeline de Governança
          </h2>
          <GovernanceKanban epics={kanbanEpics} />
        </section>
      </div>
    </div>
  );
}

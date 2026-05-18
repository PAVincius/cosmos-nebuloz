import { listGovernedEpics, listApprovalRequests } from "@/app/actions/governance";
import { GovernanceBoard } from "./components/governance-board";

export const metadata = { title: "Governance Board — COSMOS" };

export default async function GovernancePage() {
  const [epicsResult, requestsResult] = await Promise.all([
    listGovernedEpics(),
    listApprovalRequests(),
  ]);

  const epics = epicsResult.ok ? epicsResult.data : [];
  const requests = requestsResult.ok ? requestsResult.data : [];

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

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <GovernanceBoard epics={epics} requests={requests} />
      </div>
    </div>
  );
}

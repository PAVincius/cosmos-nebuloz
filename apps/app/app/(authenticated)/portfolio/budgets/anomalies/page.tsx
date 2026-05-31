import { listRecentAnomalies } from "@/app/actions/flow-intelligence/list-anomalies";
import { AnomalyList } from "./components/anomaly-list";

export const metadata = {
  title: "Anomalias de Flow — COSMOS",
  description:
    "Histórico de anomalias detectadas pelo Copilot AI nos snapshots de Flow Metrics.",
};

export default async function AnomaliesPage() {
  const { anomalies, stats } = await listRecentAnomalies(100);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">
            Anomalias de Flow
          </h1>
          <p className="mt-0.5 text-muted-foreground text-sm">
            Anomalias detectadas pelo Copilot AI nas últimas análises de Flow
            Metrics.
          </p>
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <AnomalyList anomalies={anomalies} stats={stats} />
      </div>
    </div>
  );
}

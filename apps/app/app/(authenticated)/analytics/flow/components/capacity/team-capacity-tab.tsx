import { Suspense } from "react";
import { getTeamCapacityDashboard } from "@/app/actions/flow-intelligence/capacity";
import { CapacityForecastChart } from "./capacity-forecast-chart";
import { CapacitySummaryCard } from "./capacity-summary-card";
import { MemberBreakdownTable } from "./member-breakdown-table";

async function TeamCapacityContent({ teamId }: { teamId: string }) {
  const result = await getTeamCapacityDashboard(teamId);

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground text-sm">
        {result.error}
      </div>
    );
  }

  const { members, totalExpected, totalMin, totalMax } = result.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <CapacitySummaryCard
          memberCount={members.length}
          totalExpected={totalExpected}
          totalMax={totalMax}
          totalMin={totalMin}
        />
        <CapacityForecastChart
          totalExpected={totalExpected}
          totalMax={totalMax}
          totalMin={totalMin}
        />
      </div>
      <MemberBreakdownTable members={members} />
    </div>
  );
}

export function TeamCapacityTab({ teamId }: { teamId: string }) {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground text-sm">
          Carregando dados de capacidade...
        </div>
      }
    >
      <TeamCapacityContent teamId={teamId} />
    </Suspense>
  );
}

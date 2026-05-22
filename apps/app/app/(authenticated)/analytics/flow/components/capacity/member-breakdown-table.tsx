import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

type Member = {
  userId: string;
  role: string | null;
  capacityFactor: number;
  avgSpPerSprint: number;
  trend: string;
  sprintCount: number;
  expectedSp: number;
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "UP") {
    return <TrendingUpIcon className="h-3.5 w-3.5 text-green-500" />;
  }
  if (trend === "DOWN") {
    return <TrendingDownIcon className="h-3.5 w-3.5 text-red-500" />;
  }
  return <MinusIcon className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function MemberBreakdownTable({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground text-sm">
        Nenhum baseline calculado. Execute o cálculo ao fechar um sprint.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Membro
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Capacidade
            </th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">
              SP médio
            </th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">
              Estimado
            </th>
            <th className="px-4 py-2 text-center font-medium text-muted-foreground">
              Trend
            </th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">
              Sprints
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              className="border-b last:border-0 hover:bg-muted/20"
              key={m.userId}
            >
              <td className="max-w-[120px] truncate px-4 py-2 font-medium">
                {m.userId}
              </td>
              <td className="px-4 py-2 text-muted-foreground text-xs">
                {m.role ?? "—"} · {Math.round(m.capacityFactor * 100)}%
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {m.avgSpPerSprint.toFixed(1)}
              </td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">
                {m.expectedSp}
              </td>
              <td className="px-4 py-2">
                <div className="flex justify-center">
                  <TrendIcon trend={m.trend} />
                </div>
              </td>
              <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                {m.sprintCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

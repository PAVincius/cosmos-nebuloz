import type { RiskWithPI } from "@/app/actions/risks";

const ROAM_CONFIG: { status: string; label: string; color: string; bg: string }[] = [
  { status: "RESOLVED",   label: "Resolvidos",  color: "text-green-700 dark:text-green-400",   bg: "bg-green-500/10" },
  { status: "OWNED",      label: "Atribuídos",  color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-500/10" },
  { status: "ACCEPTED",   label: "Aceitos",     color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-500/10" },
  { status: "MITIGATED",  label: "Mitigados",   color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-500/10" },
  { status: "IDENTIFIED", label: "Identificados", color: "text-gray-700 dark:text-gray-400",  bg: "bg-gray-500/10" },
];

const IMPACT_CONFIG: { impact: string; label: string; color: string }[] = [
  { impact: "critical", label: "Crítico", color: "bg-red-500" },
  { impact: "high",     label: "Alto",    color: "bg-orange-500" },
  { impact: "medium",   label: "Médio",   color: "bg-yellow-500" },
  { impact: "low",      label: "Baixo",   color: "bg-green-500" },
];

type Props = { risks: RiskWithPI[] };

export function ROAMMetricsStrip({ risks }: Props) {
  if (risks.length === 0) return null;

  const total = risks.length;
  const resolved = risks.filter((r) => r.status === "RESOLVED" || r.status === "MITIGATED").length;
  const resolvedPct = Math.round((resolved / total) * 100);
  const critical = risks.filter((r) => r.impact === "critical" && r.status !== "RESOLVED").length;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ROAM_CONFIG.map((cfg) => {
          const count = risks.filter((r) => r.status === cfg.status).length;
          return (
            <div key={cfg.status} className={`rounded-lg border p-3 ${cfg.bg}`}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {cfg.label}
              </p>
              <p className={`text-xl font-bold tabular-nums ${cfg.color}`}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Distribution bar + summary */}
      <div className="rounded-lg border p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground uppercase tracking-wide">Distribuição por Impacto</span>
          <span className={`font-semibold ${critical > 0 ? "text-red-600" : "text-green-600"}`}>
            {critical > 0 ? `${critical} crítico(s) em aberto` : "Sem críticos em aberto"}
          </span>
        </div>

        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5">
          {IMPACT_CONFIG.map((cfg) => {
            const count = risks.filter((r) => r.impact === cfg.impact).length;
            const pct = total > 0 ? (count / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={cfg.impact}
                className={`${cfg.color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${cfg.label}: ${count}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {IMPACT_CONFIG.map((cfg) => {
            const count = risks.filter((r) => r.impact === cfg.impact).length;
            return (
              <div key={cfg.impact} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${cfg.color}`} />
                {cfg.label}: <span className="font-semibold text-foreground">{count}</span>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">Resolução:</span>
            <span className={`font-semibold ${resolvedPct >= 50 ? "text-green-600" : "text-amber-600"}`}>
              {resolvedPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type ObjectiveValue = {
  id: string;
  title: string;
  plannedValue: number;
  achievedValue: number;
  isStretch: boolean;
};

type PiBurnupChartProps = {
  objectives: ObjectiveValue[];
  currentWeek: number;
  totalWeeks: number;
};

const CHART_HEIGHT = 180;
const CHART_WIDTH = 640;

/**
 * Burnup tab — DESIGN.md `.chart` pattern (svg line + grid + legend).
 * Deviation: the prototype's burnup is a fabricated weekly time series; this route's
 * data source only exposes current-state planned/achieved business value (no per-week
 * history table exists yet), so we render an honest current-state burnup (planned vs.
 * achieved cumulative value) instead of inventing historical points.
 */
export function PiBurnupChart({
  objectives,
  currentWeek,
  totalWeeks,
}: PiBurnupChartProps) {
  const committed = objectives.filter((o) => !o.isStretch);
  const totalPlanned = committed.reduce((sum, o) => sum + o.plannedValue, 0);
  const totalAchieved = committed.reduce(
    (sum, o) => sum + Math.min(o.achievedValue, o.plannedValue),
    0
  );

  if (totalPlanned === 0) {
    return (
      <div
        className="flex min-h-[180px] items-center justify-center rounded-lg border text-sm"
        style={{ borderColor: "var(--hairline)", color: "var(--ink-faint)" }}
      >
        Nenhum objetivo committed com Business Value planejado ainda.
      </div>
    );
  }

  const progressRatio = totalAchieved / totalPlanned;
  const weekRatio = totalWeeks > 0 ? currentWeek / totalWeeks : 0;
  const plannedY = CHART_HEIGHT - weekRatio * CHART_HEIGHT;
  const achievedY = CHART_HEIGHT - progressRatio * CHART_HEIGHT;

  return (
    <div className="flex flex-col gap-4">
      <div className="chart" style={{ position: "relative", width: "100%" }}>
        <svg
          height={CHART_HEIGHT + 24}
          role="img"
          style={{ display: "block", width: "100%", overflow: "visible" }}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`}
        >
          <title>Burnup de Business Value do PI</title>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              stroke="var(--hairline)"
              strokeWidth={1}
              x1={0}
              x2={CHART_WIDTH}
              y1={CHART_HEIGHT - f * CHART_HEIGHT}
              y2={CHART_HEIGHT - f * CHART_HEIGHT}
            />
          ))}
          <line
            stroke="var(--ink-faint)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            x1={0}
            x2={CHART_WIDTH}
            y1={plannedY}
            y2={plannedY}
          />
          <rect
            fill="var(--accent-c)"
            height={Math.max(CHART_HEIGHT - achievedY, 0)}
            opacity={0.85}
            rx={4}
            width={64}
            x={CHART_WIDTH / 2 - 32}
            y={achievedY}
          />
          <text
            className="axis-lbl"
            fill="var(--ink-faint)"
            fontFamily="'JetBrains Mono', monospace"
            fontSize={10}
            x={4}
            y={CHART_HEIGHT + 18}
          >
            Planejado (meta da semana atual): {Math.round(weekRatio * 100)}%
          </text>
        </svg>
      </div>
      <div className="legend" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span
          className="legend-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: "var(--ink-muted)",
          }}
        >
          <span
            className="lk"
            style={{ width: 14, height: 3, borderRadius: 2, background: "var(--accent-c)" }}
          />
          Achieved Value: {totalAchieved}
        </span>
        <span
          className="legend-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: "var(--ink-muted)",
          }}
        >
          <span
            className="lk"
            style={{ width: 14, height: 3, borderRadius: 2, background: "var(--ink-faint)" }}
          />
          Planned Value: {totalPlanned}
        </span>
      </div>
    </div>
  );
}

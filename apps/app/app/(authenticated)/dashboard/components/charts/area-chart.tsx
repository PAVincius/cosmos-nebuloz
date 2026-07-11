// Ported 1:1 from design/components/screen-dashboard.jsx's AreaChart —
// used for the "Throughput por sprint" line/area chart.

export type ChartTone = "green" | "red" | "amber" | "blue" | "purple" | "accent";

const TONE_VAR: Record<ChartTone, string> = {
  green: "var(--green)",
  red: "var(--red)",
  amber: "var(--amber)",
  blue: "var(--blue)",
  purple: "var(--purple)",
  accent: "var(--accent-c)",
};

const TONE_RGB: Record<ChartTone, string> = {
  green: "52,211,153",
  red: "251,113,133",
  amber: "251,191,36",
  blue: "91,141,239",
  purple: "167,139,250",
  accent: "0,212,255",
};

export type AreaChartProps = {
  data: number[];
  tone?: ChartTone;
  height?: number;
  labels?: string[];
};

export function AreaChart({
  data,
  tone = "accent",
  height = 132,
  labels,
}: AreaChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height,
          fontSize: 12,
          color: "var(--ink-faint)",
        }}
      >
        Sem dados suficientes ainda.
      </div>
    );
  }

  const w = 560;
  const h = height;
  const pad = 6;
  const max = Math.max(...data) * 1.12;
  const min = Math.min(...data) * 0.85;
  const range = max - min || 1;
  const denom = data.length - 1 || 1;
  const xs = (i: number) => pad + (i * (w - pad * 2)) / denom;
  const ys = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2 - 16);

  const line = data
    .map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xs(data.length - 1)} ${h - pad} L${xs(0)} ${h - pad} Z`;
  const color = TONE_VAR[tone];
  const rgb = TONE_RGB[tone];
  const gid = `ag_${tone}`;

  return (
    <div>
      <svg
        aria-hidden
        height={h}
        preserveAspectRatio="none"
        style={{ display: "block" }}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            stroke="var(--hairline)"
            strokeWidth="1"
            x1="0"
            x2={w}
            y1={pad + g * (h - pad * 2 - 16)}
            y2={pad + g * (h - pad * 2 - 16)}
          />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          style={{ filter: `drop-shadow(0 4px 8px rgba(${rgb},.4))` }}
        />
        {data.map((v, i) => (
          <circle
            cx={xs(i)}
            cy={ys(v)}
            fill="var(--surface)"
            key={`${i}-${v}`}
            r={i === data.length - 1 ? 4 : 2.6}
            stroke={color}
            strokeWidth="2.2"
          />
        ))}
      </svg>
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {labels.map((l) => (
            <span
              className="font-mono"
              key={l}
              style={{ fontSize: 11, color: "var(--ink-subtle)" }}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

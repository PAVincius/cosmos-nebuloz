// Ported from design/components/screen-dashboard.jsx's VBars —
// used for the "Predictability por PI" bar chart.

import type { ChartTone } from "./area-chart";

export type VBarDatum = {
  label: string;
  value: number;
  tone: ChartTone;
};

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

export function VBars({ data }: { data: VBarDatum[] }) {
  if (data.length === 0) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: 150,
          fontSize: 12,
          color: "var(--ink-faint)",
        }}
      >
        Nenhum PI em execução.
      </div>
    );
  }

  const max = 100;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 14,
        height: 150,
        padding: "0 4px",
      }}
    >
      {data.map((d) => (
        <div
          key={d.label}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            className="font-mono"
            style={{ fontSize: 12, fontWeight: 700, color: TONE_VAR[d.tone] }}
          >
            {Math.round(d.value)}
          </div>
          <div
            style={{
              width: "100%",
              height: Math.max((d.value / max) * 100, 4),
              borderRadius: "6px 6px 0 0",
              background: `linear-gradient(180deg, ${TONE_VAR[d.tone]}, rgba(${TONE_RGB[d.tone]},.4))`,
              boxShadow: `0 -2px 12px -4px rgba(${TONE_RGB[d.tone]},.5)`,
            }}
          />
          <div
            className="font-mono"
            style={{ fontSize: 11, color: "var(--ink-faint)" }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

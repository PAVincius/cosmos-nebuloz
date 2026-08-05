"use client";

import {
  ChartTip,
  CopilotInsightBar,
  NavButton,
  useNav,
} from "@repo/design-system/cosmos/kit";
// dashboard-client.tsx — client-only pieces of the Dashboard screen: charts
// with hover state (need useState/useId) and small navigation wrappers (need
// useNav). Split out so dashboard.tsx can be a real async server component
// that fetches epics via listEpics(), matching the pattern used by
// epic-detail.tsx / feature-detail.tsx.
import { type ReactNode, useId, useState } from "react";

// ── AreaChart ──
export function AreaChart({
  data,
  tone = "accent",
  height = 132,
  labels,
}: {
  data: number[];
  tone?: string;
  height?: number;
  labels?: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  const w = 520,
    h = height,
    pad = 6;
  const max = Math.max(...data),
    min = Math.min(...data);
  const xs = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const ys = (v: number) =>
    pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2);
  const line = data
    .map((v, i) => `${i ? "L" : "M"}${xs(i)} ${ys(v)}`)
    .join(" ");
  const area = `${line} L${xs(data.length - 1)} ${h} L${xs(0)} ${h} Z`;
  return (
    <div style={{ position: "relative" }}>
      <svg
        height={h}
        preserveAspectRatio="none"
        style={{ overflow: "visible", display: "block" }}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={`var(--${tone})`} stopOpacity="0.32" />
            <stop offset="1" stopColor={`var(--${tone})`} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        {hover !== null && (
          <line
            stroke="var(--ink-faint)"
            strokeDasharray="3 3"
            strokeWidth="1"
            x1={xs(hover)}
            x2={xs(hover)}
            y1={0}
            y2={h}
          />
        )}
        <path
          d={line}
          fill="none"
          stroke={`var(--${tone})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          style={{
            filter: `drop-shadow(0 4px 8px rgba(var(--${tone}-rgb),.4))`,
          }}
        />
        {data.map((v, i) => (
          <g key={i}>
            <circle
              className="chart-hit"
              cx={xs(i)}
              cy={ys(v)}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              r="12"
            />
            <circle
              cx={xs(i)}
              cy={ys(v)}
              fill="var(--surface)"
              r={hover === i ? 5.5 : i === data.length - 1 ? 4 : 2.6}
              stroke={`var(--${tone})`}
              strokeWidth={hover === i ? 2.8 : 2.2}
              style={{
                transition: "r .15s ease",
                pointerEvents: "none",
                filter:
                  hover === i ? `drop-shadow(0 0 6px var(--${tone}))` : "none",
              }}
            />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <ChartTip
          left={(xs(hover) / w) * 100}
          top={(ys(data[hover]) / h) * 100}
        >
          <b>{labels ? labels[hover] : `#${hover + 1}`}</b> ·{" "}
          <span className="mono">{data[hover]} SP</span>
        </ChartTip>
      )}
    </div>
  );
}

// ── VBars — vertical bar chart ──
export function VBars({ data }: { data: { label: string; v: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.v), 100);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        height: 150,
        paddingTop: 8,
      }}
    >
      {data.map((d, i) => {
        const pct = (d.v / max) * 100;
        const good = d.v >= 80;
        const tone = good ? "green" : d.v >= 60 ? "amber" : "red";
        return (
          <div
            className="chart-hit"
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              height: "100%",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 34,
                height: `${pct}%`,
                borderRadius: "6px 6px 2px 2px",
                background: `var(--${tone})`,
                boxShadow:
                  hover === i
                    ? `0 0 14px rgba(var(--${tone}-rgb),.55)`
                    : `0 0 8px rgba(var(--${tone}-rgb),.4)`,
                transition:
                  "height .6s cubic-bezier(.2,.8,.3,1), box-shadow .15s ease",
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ink-muted)",
              }}
            >
              {d.v}%
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: "var(--ink-faint)",
                fontWeight: 600,
              }}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── OrbitButton — "Perguntar ao ORBIT" nav trigger ──
export function OrbitButton() {
  return (
    <NavButton icon="sparkles" to="copilot" variant="primary">
      Perguntar ao ORBIT
    </NavButton>
  );
}

// ── AnomaliesCopilotBar — CopilotInsightBar wired to the anomalies screen ──
export function AnomaliesCopilotBar({ children }: { children: ReactNode }) {
  const { navigate } = useNav();
  return (
    <CopilotInsightBar onAction={() => navigate("anomalies")}>
      {children}
    </CopilotInsightBar>
  );
}

// ── EpicRow — clickable in-flight epic row, navigates to epic detail ──
export function EpicRow({ id, children }: { id: string; children: ReactNode }) {
  const { navigate } = useNav();
  return (
    <div
      className="chart-hit"
      onClick={() => navigate("epic", id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </div>
  );
}

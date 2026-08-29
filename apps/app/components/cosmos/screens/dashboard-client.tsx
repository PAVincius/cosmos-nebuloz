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
  const seriesSummary = data
    .map((v, i) => `${labels?.[i] ?? `#${i + 1}`}: ${v} SP`)
    .join(", ");

  return (
    <div style={{ position: "relative" }}>
      <svg
        aria-label={`Velocity por sprint — ${seriesSummary}`}
        height={h}
        preserveAspectRatio="none"
        role="img"
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
          vectorEffect="non-scaling-stroke"
        />
        {data.map((v, i) => (
          // O valor de cada ponto só existia no hover: em toque o gráfico era
          // uma silhueta sem um único número, e por teclado não havia como
          // chegar nele. O <g> é o alvo — foco, toque e mouse abrem o mesmo
          // ChartTip. Raio 22 (era 12) para o alvo passar o mínimo da SC 2.5.8.
          // biome-ignore lint/a11y/useSemanticElements: SVG não tem <button>; o alvo precisa viver dentro do <svg> para acompanhar as coordenadas do ponto
          <g
            aria-label={`${labels?.[i] ?? `#${i + 1}`}: ${v} SP`}
            className="chart-hit"
            key={labels?.[i] ?? i}
            onBlur={() => setHover(null)}
            onClick={() => setHover((cur) => (cur === i ? null : i))}
            onFocus={() => setHover(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setHover((cur) => (cur === i ? null : i));
              }
            }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            role="button"
            tabIndex={0}
          >
            <circle cx={xs(i)} cy={ys(v)} fill="transparent" r="22" />
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
        // Em painel estreito o tip do primeiro/último ponto saía pela borda:
        // translate(-50%) sobre left ~1% joga metade dele para fora.
        <ChartTip
          left={Math.min(88, Math.max(12, (xs(hover) / w) * 100))}
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
            key={d.label}
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
            {/* Track claims whatever height the column has left below the
                two label rows, so its full height is always the 100% mark —
                the fill inside only ever scales, it never sets height. */}
            <div style={{ flex: 1, minHeight: 0, width: "100%", maxWidth: 34 }}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "6px 6px 2px 2px",
                  background: `var(--${tone})`,
                  boxShadow:
                    hover === i
                      ? `0 0 14px rgba(var(--${tone}-rgb),.55)`
                      : `0 0 8px rgba(var(--${tone}-rgb),.4)`,
                  transform: `scaleY(${pct / 100})`,
                  transformOrigin: "bottom",
                  transition:
                    "transform .6s cubic-bezier(.2,.8,.3,1), box-shadow .15s ease",
                }}
              />
            </div>
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
  const open = () => navigate("epic", id);
  // Era <div onClick> puro: abrir um épico exigia mouse. Mesmo contrato de
  // teclado que SectionCard já usa no kit, mais Espaço além de Enter.
  return (
    // biome-ignore lint/a11y/useSemanticElements: a linha contém CopyId e badges clicáveis; <button> aninhando interativos é HTML inválido e pior que role+tabIndex
    <div
      className="chart-hit"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      role="button"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
      }}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

"use client";

// charts.tsx — gráficos próprios do Meridian.
//
// Três peças que o kit compartilhado não tem porque só este produto precisa:
// o anel de score (usado em card de eixo e no relatório), o radar pentagonal
// (gráfico-herói do relatório) e a banda de percentil da coorte.
//
// Todos usam as variáveis de tom da raiz — nada de cor literal, para o tema
// claro e o escuro saírem certos sem segunda implementação.

import type { MeridianAxis } from "@repo/database";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import type { Band } from "@/lib/meridian/benchmark";
import { scoreTone, type Tone } from "@/lib/meridian/composite";

export function ScoreRing({
  value,
  size = 54,
  tone,
  label,
}: {
  value: number;
  size?: number;
  tone?: Tone | "accent";
  label?: string;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const t = tone ?? scoreTone(value);
  return (
    <svg
      aria-label={`${label ?? "Score"}: ${value} de 100`}
      height={size}
      role="img"
      width={size}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={r}
        stroke="var(--surface-3)"
        strokeWidth="5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={r}
        stroke={`var(--${t})`}
        strokeDasharray={`${(c * value) / 100} ${c}`}
        strokeLinecap="round"
        strokeWidth="5"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        dy=".36em"
        fill="var(--ink)"
        style={{
          fontSize: size * 0.3,
          fontWeight: 800,
          fontFamily: "var(--font-display, inherit)",
        }}
        textAnchor="middle"
        x="50%"
        y="50%"
      >
        {value}
      </text>
    </svg>
  );
}

export type RadarScore = { axis: MeridianAxis; score: number };

/** Radar pentagonal. A coorte entra como polígono tracejado atrás — e só entra
 *  quando a leitura foi liberada: desenhar a mediana de uma coorte de três
 *  organizações seria estatística de mentira. */
export function Radar({
  scores,
  bands,
  size = 270,
}: {
  scores: RadarScore[];
  bands?: Record<MeridianAxis, Band> | null;
  size?: number;
}) {
  // Os rótulos ficam FORA do pentágono, então o SVG precisa ser mais largo que
  // alto: "Infrastructure 42" com âncora no meio, a 19px da borda, saía
  // cortado como "astructure 42" em qualquer largura de tela. A margem
  // lateral dá espaço ao rótulo mais longo, e a âncora segue o lado — quem
  // está à esquerda do centro termina no ponto, quem está à direita começa
  // nele — para o texto crescer para fora, nunca por cima do gráfico.
  const LABEL_MARGIN = 56;
  const c = size / 2;
  const cx = c + LABEL_MARGIN;
  const R = c - 40;
  const byAxis = new Map(scores.map((s) => [s.axis, s.score]));
  const mine = AXIS_IDS.map((a) => byAxis.get(a) ?? 0);
  const median = bands ? AXIS_IDS.map((a) => bands[a].p50) : null;

  const angle = (i: number) =>
    -Math.PI / 2 + (i * 2 * Math.PI) / AXIS_IDS.length;
  const pt = (i: number, v: number): [number, number] => {
    const ang = angle(i);
    return [
      cx + R * (v / 100) * Math.cos(ang),
      c + R * (v / 100) * Math.sin(ang),
    ];
  };
  const poly = (vals: number[]) =>
    vals.map((v, i) => pt(i, v).join(",")).join(" ");
  const anchorFor = (i: number): "start" | "middle" | "end" => {
    const cos = Math.cos(angle(i));
    if (Math.abs(cos) < 0.2) {
      return "middle";
    }
    return cos < 0 ? "end" : "start";
  };

  return (
    <svg
      aria-label={`Radar de prontidão: ${AXIS_IDS.map((a, i) => `${AXES[a].label} ${mine[i]}`).join(", ")}`}
      height={size}
      role="img"
      width={size + LABEL_MARGIN * 2}
    >
      {[25, 50, 75, 100].map((ring) => (
        <polygon
          fill="none"
          key={ring}
          points={poly(AXIS_IDS.map(() => ring))}
          stroke="var(--hairline)"
          strokeWidth="1"
        />
      ))}
      {AXIS_IDS.map((a, i) => {
        const [px, py] = pt(i, 100);
        return (
          <line
            key={a}
            stroke="var(--hairline)"
            strokeWidth="1"
            x1={cx}
            x2={px}
            y1={c}
            y2={py}
          />
        );
      })}
      {median && (
        <polygon
          fill="rgba(var(--neutral-rgb),.12)"
          points={poly(median)}
          stroke="var(--neutral)"
          strokeDasharray="4 3"
          strokeWidth="1.4"
        />
      )}
      <polygon
        fill="rgba(var(--accent-rgb),.18)"
        points={poly(mine)}
        stroke="var(--accent)"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      {AXIS_IDS.map((a, i) => {
        const [px, py] = pt(i, mine[i] as number);
        return (
          <circle
            cx={px}
            cy={py}
            fill={`var(--${scoreTone(mine[i] as number)})`}
            key={a}
            r="3.4"
            stroke="var(--surface)"
            strokeWidth="1.5"
          />
        );
      })}
      {AXIS_IDS.map((a, i) => {
        const [px, py] = pt(i, 100);
        const lx = cx + (px - cx) * 1.14;
        const ly = c + (py - c) * 1.18;
        return (
          <text
            dy=".34em"
            fill="var(--ink-muted)"
            key={a}
            style={{ fontSize: 10.5, fontWeight: 700 }}
            textAnchor={anchorFor(i)}
            x={lx}
            y={ly}
          >
            {AXES[a].label}{" "}
            <tspan
              className="mono"
              fill={`var(--${scoreTone(mine[i] as number)})`}
              style={{ fontWeight: 800, fontSize: 10 }}
            >
              {mine[i]}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

/** Banda p25–p75 da coorte com o marcador da organização. O traço no meio é a
 *  mediana; a posição do marcador é a leitura que o patrocinador faz em um
 *  segundo. */
export function BenchBand({
  axis,
  mine,
  band,
}: {
  axis: MeridianAxis;
  mine: number;
  band: Band;
}) {
  const ahead = mine >= band.p50;
  const delta = mine - band.p50;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>
          {AXES[axis].label}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: `var(--${ahead ? "green" : "amber"}-text)`,
          }}
        >
          {delta >= 0 ? "+" : ""}
          {delta} vs. p50
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 22,
          borderRadius: 6,
          background: "var(--surface-3)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${band.p25}%`,
            width: `${band.p75 - band.p25}%`,
            background: "rgba(var(--neutral-rgb),.3)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${band.p50}%`,
            width: 2,
            background: "var(--ink-faint)",
          }}
          title={`p50: ${band.p50}`}
        />
        <div
          style={{
            position: "absolute",
            top: 2,
            bottom: 2,
            left: `calc(${mine}% - 5px)`,
            width: 10,
            borderRadius: 3,
            background: `var(--${ahead ? "green" : "amber"})`,
            boxShadow: `0 0 8px rgba(var(--${ahead ? "green" : "amber"}-rgb),.6)`,
          }}
          title={`${AXES[axis].label}: ${mine}`}
        />
      </div>
    </div>
  );
}

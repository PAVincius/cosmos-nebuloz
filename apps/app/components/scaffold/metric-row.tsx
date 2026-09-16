"use client";

// Uma métrica do caso de negócio: linha de base, meta, delta e confiança.

import { Icon } from "@repo/design-system/cosmos/icons";
import type { BusinessCaseDetail } from "@/app/(scaffold)/actions/business-case";
import { Eyebrow } from "./base";

const CONFIDENCE: Record<
  string,
  { label: string; tone: "green" | "amber" | "neutral"; hint: string }
> = {
  MEASURED: {
    label: "medido",
    tone: "green",
    hint: "tem série de dados por trás",
  },
  ESTIMATED: {
    label: "estimado",
    tone: "amber",
    hint: "tem cálculo, não série",
  },
  DECLARED: {
    label: "declarado",
    tone: "neutral",
    hint: "alguém afirmou; nada mediu",
  },
};

type Metric = BusinessCaseDetail["metrics"][number];

/** Delta percentual entre linha de base e meta. Derivado, nunca armazenado:
 *  guardar o delta criaria uma segunda fonte de verdade para a mesma
 *  aritmética, e as duas divergem no primeiro arredondamento. */
function deltaPct(m: Metric): number {
  const base = Number(m.baseValue);
  const target = Number(m.targetValue);
  if (!base) {
    return 0;
  }
  return Math.round(((target - base) / base) * 1000) / 10;
}

function ConfPill({ conf }: { conf: string }) {
  const c = CONFIDENCE[conf] ?? CONFIDENCE.DECLARED;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 99,
        background: `var(--${c?.tone}-soft)`,
        border: `1px solid rgba(var(--${c?.tone}-rgb),.3)`,
        fontSize: 10.5,
        fontWeight: 700,
        color: `var(--${c?.tone}-text)`,
      }}
      title={c?.hint}
    >
      {c?.label}
    </span>
  );
}

export function MetricRow({ m, last }: { m: Metric; last: boolean }) {
  const d = deltaPct(m);
  const good = m.direction === "DOWN" ? d < 0 : d > 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(150px,1.6fr) 88px 88px 92px minmax(120px,1fr)",
        gap: 12,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: last ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          {m.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
          {m.sourceLabel} · {m.sampleLabel}
        </div>
      </div>
      <div>
        <Eyebrow style={{ fontSize: 10.5, marginBottom: 3 }}>
          Linha de base
        </Eyebrow>
        <div
          className="mono"
          style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}
        >
          {m.baseValue}
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--ink-faint)",
              marginLeft: 3,
            }}
          >
            {m.unit}
          </span>
        </div>
      </div>
      <div>
        <Eyebrow style={{ fontSize: 10.5, marginBottom: 3 }}>Meta</Eyebrow>
        <div
          className="mono"
          style={{ fontSize: 14, fontWeight: 800, color: "var(--accent-text)" }}
        >
          {m.targetValue}
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--ink-faint)",
              marginLeft: 3,
            }}
          >
            {m.unit}
          </span>
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon
          name={m.direction === "DOWN" ? "trendingDown" : "trendingUp"}
          size={14}
          strokeWidth={2.2}
          style={{ color: good ? "var(--green-text)" : "var(--red-text)" }}
        />
        <span
          className="mono"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: good ? "var(--green-text)" : "var(--red-text)",
          }}
        >
          {d > 0 ? "+" : ""}
          {d}%
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ConfPill conf={m.confidence} />
      </div>
    </div>
  );
}

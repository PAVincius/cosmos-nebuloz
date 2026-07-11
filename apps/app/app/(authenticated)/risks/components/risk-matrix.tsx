import type { RiskWithPI } from "@/app/actions/risks/schema";
import {
  IMPACT_LABELS,
  IMPACT_VALUE,
  PROBABILITY_LABELS,
  PROBABILITY_VALUE,
  severityTone,
} from "./roam-constants";

// screen-risks.jsx (RiskMatrix) — eixos probabilidade × impacto, células
// coloridas por severidade. Schema real persiste 3 níveis de probabilidade
// (não 5) e 4 de impacto (não 5), então a grade é 3×4 em vez de 5×5 — a
// escala de severidade (prob × impact) e os cortes de cor são preservados.
const PROB_ROWS = ["high", "medium", "low"] as const;
const IMPACT_COLS = ["low", "medium", "high", "critical"] as const;

const LEGEND = [
  { tone: "green", label: "Baixo" },
  { tone: "blue", label: "Moderado" },
  { tone: "amber", label: "Alto" },
  { tone: "red", label: "Crítico" },
] as const;

type Props = { risks: RiskWithPI[] };

export function RiskMatrix({ risks }: Props) {
  return (
    <div className="flex gap-3">
      <div className="flex items-center">
        <span
          className="whitespace-nowrap font-bold text-[10.5px] text-ink-muted uppercase tracking-[.08em]"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Probabilidade →
        </span>
      </div>

      <div className="flex-1">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${IMPACT_COLS.length}, 1fr)`,
            gridTemplateRows: `repeat(${PROB_ROWS.length}, 1fr)`,
            aspectRatio: `${IMPACT_COLS.length} / ${PROB_ROWS.length * 1.3}`,
          }}
        >
          {PROB_ROWS.map((prob) =>
            IMPACT_COLS.map((impact) => {
              const pVal = PROBABILITY_VALUE[prob];
              const iVal = IMPACT_VALUE[impact];
              const items = risks.filter(
                (r) => r.probability === prob && r.impact === impact
              );
              const tone = severityTone(pVal * iVal);
              return (
                <div
                  className="relative flex flex-wrap content-start gap-1 rounded-cosmos-sm p-1.5"
                  key={`${prob}-${impact}`}
                  style={{
                    border: `1px solid rgba(var(--${tone}-rgb),.28)`,
                    background: `rgba(var(--${tone}-rgb),${items.length ? 0.16 : 0.055})`,
                  }}
                  title={`${PROBABILITY_LABELS[prob]} probabilidade · ${IMPACT_LABELS[impact]} impacto`}
                >
                  {items.map((r) => (
                    <span
                      className="cursor-default rounded-[5px] px-[5px] py-0.5 font-bold font-mono text-[10px] text-white"
                      key={r.id}
                      style={{
                        background: `var(--${tone})`,
                        boxShadow: `0 2px 6px -1px rgba(var(--${tone}-rgb),.6)`,
                      }}
                      title={`${r.id.slice(0, 8)} · ${r.title}`}
                    >
                      {r.id.slice(0, 4)}
                    </span>
                  ))}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-2 text-center font-bold text-[10.5px] text-ink-muted uppercase tracking-[.08em]">
          Impacto →
        </div>
      </div>
    </div>
  );
}

export function RiskMatrixLegend() {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-3.5">
      {LEGEND.map((x) => (
        <span
          className="inline-flex items-center gap-1.5 font-medium text-[11.5px] text-ink-muted"
          key={x.label}
        >
          <span
            className="h-[9px] w-[9px] rounded-[3px]"
            style={{ background: `var(--${x.tone})` }}
          />
          {x.label}
        </span>
      ))}
    </div>
  );
}

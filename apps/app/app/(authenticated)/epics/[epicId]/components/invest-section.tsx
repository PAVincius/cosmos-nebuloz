import { GaugeIcon } from "lucide-react";
import { Gauge } from "@/app/(authenticated)/components/gauge";
import { SectionCard } from "@/app/(authenticated)/components/section-card";

const CRITERIA = [
  { key: "I", label: "Independent" },
  { key: "N", label: "Negotiable" },
  { key: "V", label: "Valuable" },
  { key: "E", label: "Estimable" },
  { key: "S", label: "Small" },
  { key: "T", label: "Testable" },
] as const;

const PLACEHOLDER_BREAKDOWN = { I: 8, N: 6, V: 8, E: 7, S: 6, T: 9 };

type InvestSectionProps = {
  investScore: number;
  investBreakdown: unknown;
};

export function InvestSection({ investScore, investBreakdown }: InvestSectionProps) {
  const score = Math.round(investScore);
  const ready = score >= 70;

  let breakdown: Record<string, number> = PLACEHOLDER_BREAKDOWN;
  if (
    investBreakdown &&
    typeof investBreakdown === "object" &&
    !Array.isArray(investBreakdown)
  ) {
    const raw = investBreakdown as Record<string, unknown>;
    const parsed: Record<string, number> = {};
    for (const k of ["I", "N", "V", "E", "S", "T"]) {
      const v = raw[k];
      parsed[k] = typeof v === "number" ? Math.round(v) : (PLACEHOLDER_BREAKDOWN as Record<string, number>)[k] ?? 0;
    }
    breakdown = parsed;
  }

  const badge = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: ready ? "rgba(52,211,153,.14)" : "rgba(251,191,36,.14)",
        color: ready ? "var(--green-text)" : "var(--amber-text)",
        border: `1px solid ${ready ? "rgba(52,211,153,.22)" : "rgba(251,191,36,.22)"}`,
      }}
    >
      {ready ? "Pronto" : "Em análise"}
    </span>
  );

  return (
    <SectionCard
      actions={badge}
      icon={GaugeIcon}
      subtitle="Avaliação de prontidão do épico"
      title="INVEST Score"
    >
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        {/* Donut gauge */}
        <div style={{ flexShrink: 0 }}>
          <Gauge label="INVEST" size={120} tone={ready ? "green" : "amber"} value={score} />
        </div>

        {/* Bars */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {CRITERIA.map(({ key, label }) => {
            const val = breakdown[key] ?? 0;
            const pct = (val / 10) * 100;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--ink-faint)", fontWeight: 500, width: 10, flexShrink: 0 }}>
                  {key}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-subtle)", width: 88, flexShrink: 0 }}>
                  {label}
                </span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 3,
                      background: "linear-gradient(90deg, rgba(96,165,250,.7), rgba(96,165,250,1))",
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", width: 16, textAlign: "right", flexShrink: 0, fontFamily: "ui-monospace, monospace" }}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

"use client";

// horizon-detail-client.tsx — per-InvestmentHorizon drilldown (design
// handoff screen-bundle-4.jsx HorizonDetailScreen). Target % (stored) vs.
// actual % (derived live from LeanBudget rows classified into this
// horizon) and the value streams (ARTs) it groups. Honestly empty when no
// value stream has been classified into this horizon yet.
import type { InvestmentHorizonDetailView } from "@/app/(cosmos)/actions/horizons";
import { EmptyState } from "../empty-state";
import { Badge, KpiCard, PageHeader, SectionCard, useNav } from "../kit";

export default function HorizonDetailClient({
  initial,
}: {
  initial: InvestmentHorizonDetailView;
}) {
  const { navigate } = useNav();
  const gap =
    initial.actualPct === null ? null : initial.actualPct - initial.targetPct;
  const gapTone = gap === null || Math.abs(gap) <= 2 ? "green" : "amber";
  const totalAllocated = initial.valueStreams.reduce(
    (s, v) => s + v.budgetAllocated,
    0
  );

  return (
    <div className="fade-in">
      <button
        className="btn"
        onClick={() => navigate("budgets")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--ink-muted)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 14,
          padding: 0,
        }}
        type="button"
      >
        ← Lean Budgets
      </button>

      <PageHeader
        eyebrow="Lean Budget · Investment Horizon"
        meta={
          <>
            <Badge tone="neutral">{initial.label}</Badge>
            {gap !== null && (
              <Badge dot tone={gapTone}>
                {gap === 0
                  ? "no alvo"
                  : gap > 0
                    ? `+${gap.toFixed(1)}pp acima da meta`
                    : `${gap.toFixed(1)}pp abaixo da meta`}
              </Badge>
            )}
          </>
        }
        title={initial.name}
        tone="amber"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <KpiCard
          hint={`alvo ${initial.targetPct}%`}
          icon="layers"
          label="Alocação atual do portfólio"
          tone="amber"
          unit={initial.actualPct === null ? undefined : "%"}
          value={initial.actualPct ?? "—"}
        />
        <KpiCard
          hint="soma dos value streams classificados"
          icon="wallet"
          label="Orçamento total no horizonte"
          tone="accent"
          unit="$"
          value={totalAllocated.toLocaleString()}
        />
        <KpiCard
          hint="neste horizonte de investimento"
          icon="wallet"
          label="Value Streams"
          tone="blue"
          value={initial.valueStreams.length}
        />
      </div>

      <SectionCard
        icon="wallet"
        subtitle="Clique para abrir o detalhe do fluxo de valor"
        title="Value Streams neste horizonte"
        tone="green"
      >
        {initial.valueStreams.length === 0 ? (
          <EmptyState
            description="Nenhum value stream (LeanBudget.horizonId) foi classificado neste horizonte ainda."
            icon="wallet"
            title="Nenhum value stream classificado"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {initial.valueStreams.map((v) => (
              <button
                className="lift"
                key={v.artId}
                onClick={() => navigate("vs", v.artId)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--hairline)",
                  background: "var(--surface)",
                }}
                type="button"
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {v.artName}
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-faint)" }}
                  >
                    ${v.budgetAllocated.toLocaleString()} alocado
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

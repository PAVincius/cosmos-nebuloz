"use client";

// piplanning.tsx — PI Planning (confidence vote, objectives, ROAM risks),
// wired to getActivePiPlanning(). Team-level fist-of-five breakdown isn't in
// scope for this read pass — shown as a single "Confiança média" KPI.

import { useEffect, useState } from "react";
import {
  getActivePiPlanning,
  type PiPlanningView,
} from "@/app/(cosmos)/actions/piplanning";
import { Badge, ErrorState, KpiCard, PageHeader, SectionCard } from "../kit";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "amber",
  ACHIEVED: "green",
  MISSED: "red",
};

const ROAM_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  UNCLASSIFIED: "neutral",
  RESOLVED: "green",
  OWNED: "amber",
  ACCEPTED: "neutral",
  MITIGATED: "green",
};

export default function PiPlanningScreen() {
  const [plan, setPlan] = useState<PiPlanningView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivePiPlanning().then((r) => {
      if (r.ok) {
        setPlan(r.data);
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
  }, []);

  const committedBV =
    plan?.objectives
      .filter((o) => !o.isStretch)
      .reduce((s, o) => s + o.businessValue, 0) ?? 0;
  const stretchBV =
    plan?.objectives
      .filter((o) => o.isStretch)
      .reduce((s, o) => s + o.businessValue, 0) ?? 0;
  const openRisks =
    plan?.risks.filter((r) => r.roamStatus === "OWNED").length ?? 0;

  return (
    <div className="fade-in" style={{ paddingBottom: 76 }}>
      <PageHeader
        meta={
          plan && (
            <Badge dot tone="accent">
              {plan.piPlanName}
            </Badge>
          )
        }
        subtitle="Planejamento incremental do ART. Confiança do time, objetivos e riscos ROAM."
        title="PI Planning"
      />

      {error && <ErrorState message={error} />}

      {!(error || loading) && plan === null && (
        <KpiCard
          hint="Nenhum PI em Planning, Committed ou Executing"
          icon="target"
          label="Nenhum PI ativo"
          tone="accent"
          value="—"
        />
      )}

      {plan && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: "var(--gap)",
              marginBottom: "var(--gap)",
            }}
          >
            <KpiCard
              hint={`${plan.objectives.filter((o) => !o.isStretch).length} objetivos`}
              icon="target"
              label="Business Value committed"
              tone="green"
              value={committedBV}
            />
            <KpiCard
              hint="não committed"
              icon="zap"
              label="Business Value stretch"
              tone="purple"
              value={stretchBV}
            />
            <KpiCard
              hint="fist-of-five"
              icon="gauge"
              label="Confiança média"
              tone="accent"
              unit="/5"
              value={
                plan.confidenceAvg === null
                  ? "—"
                  : plan.confidenceAvg.toFixed(1)
              }
            />
            <KpiCard
              hint={`${plan.risks.length} no ROAM`}
              icon="alert"
              label="Riscos a endereçar"
              tone="amber"
              value={openRisks}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.45fr 1fr",
              gap: "var(--gap)",
            }}
          >
            {/* objectives */}
            <SectionCard
              action={
                <Badge tone="neutral">{plan.objectives.length} objetivos</Badge>
              }
              bodyStyle={{ padding: 12 }}
              icon="target"
              subtitle="Committed e stretch · com business value"
              title="PI Objectives"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.objectives.map((o) => (
                  <div
                    className="lift"
                    key={o.id}
                    style={{
                      display: "flex",
                      gap: 13,
                      alignItems: "center",
                      padding: "13px 14px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--hairline)",
                      background: o.isStretch
                        ? "var(--surface-2)"
                        : "var(--surface)",
                      opacity: o.isStretch ? 0.92 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Badge tone={STATUS_TONE[o.status] ?? "neutral"}>
                          {o.status}
                        </Badge>
                        {o.isStretch && <Badge tone="neutral">stretch</Badge>}
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                          lineHeight: 1.35,
                          textWrap: "pretty",
                        }}
                      >
                        {o.title}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        className="mono"
                        style={{
                          fontSize: 21,
                          fontWeight: 800,
                          color: o.isStretch
                            ? "var(--ink-faint)"
                            : "var(--green-text)",
                          letterSpacing: "-.02em",
                        }}
                      >
                        {o.businessValue}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--ink-subtle)",
                          fontWeight: 700,
                          letterSpacing: ".06em",
                        }}
                      >
                        BV
                      </div>
                    </div>
                  </div>
                ))}
                {plan.objectives.length === 0 && (
                  <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
                    Nenhum objetivo cadastrado.
                  </span>
                )}
              </div>
            </SectionCard>

            {/* ROAM */}
            <SectionCard
              action={<Badge tone="amber">{openRisks} abertos</Badge>}
              bodyStyle={{ padding: 12 }}
              icon="alert"
              subtitle="Resolved · Owned · Accepted · Mitigated"
              title="Riscos · ROAM"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.risks.map((r) => (
                  <div
                    className="lift"
                    key={r.id}
                    style={{
                      padding: "12px 13px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Badge tone={ROAM_TONE[r.roamStatus] ?? "neutral"}>
                        {r.roamStatus}
                      </Badge>
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--ink)",
                        lineHeight: 1.4,
                        textWrap: "pretty",
                      }}
                    >
                      {r.title}
                    </div>
                  </div>
                ))}
                {plan.risks.length === 0 && (
                  <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
                    Nenhum risco cadastrado.
                  </span>
                )}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

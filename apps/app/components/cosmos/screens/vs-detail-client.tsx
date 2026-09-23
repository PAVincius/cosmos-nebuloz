"use client";

import {
  Badge,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "@repo/design-system/cosmos/kit";
// vs-detail.tsx — per-value-stream financial detail (design handoff
// screen-bundle-4.jsx ValueStreamDetailScreen). "Value stream" has no
// dedicated model — governance.prisma's GovernedEpic.valueStreamId comment
// says plainly it IS the ART id, so this screen is an ART's LeanBudget
// rollup. guardrailPct (spent vs. LeanBudget.spendLimitUsd — the schema's
// own guardrail field) is shown separately from utilizationPct (spent vs.
// total allocated budget) because they have different denominators; a
// fabricated "burn MTD" from the mock is intentionally omitted — no
// time-series spend model exists to back it honestly.
import type { ValueStreamDetailView } from "@/app/(cosmos)/actions/budgets";
import { EmptyState } from "../empty-state";

export default function ValueStreamDetailClient({
  initial,
}: {
  initial: ValueStreamDetailView;
}) {
  const { navigate } = useNav();
  const over = initial.guardrailPct !== null && initial.guardrailPct >= 100;
  const nearGuardrail =
    initial.guardrailPct !== null &&
    initial.guardrailPct >= 85 &&
    initial.guardrailPct < 100;
  const guardrailTone = over ? "red" : nearGuardrail ? "amber" : "green";

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
          fontSize: "var(--fs-base)",
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
        eyebrow="Lean Budget · Value Stream (ART)"
        meta={
          <>
            <Badge tone="neutral">
              {initial.budgetCount} orçamento
              {initial.budgetCount === 1 ? "" : "s"}
            </Badge>
            {initial.guardrailPct !== null && (
              <Badge dot tone={over ? "red" : "green"}>
                {over ? "guardrail rompido" : "dentro do guardrail"}
              </Badge>
            )}
            {initial.horizon && (
              <button
                onClick={() => navigate("horizon", initial.horizon?.id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                type="button"
              >
                <Badge icon="layers" tone="amber">
                  {initial.horizon.name}
                </Badge>
              </button>
            )}
          </>
        }
        subtitle="Financiamento contínuo deste fluxo de valor de ponta a ponta."
        title={initial.name}
        tone={guardrailTone}
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
          icon="wallet"
          label="Orçamento alocado"
          tone="accent"
          unit="$"
          value={initial.budgetAllocated}
        />
        <KpiCard
          hint={`${initial.utilizationPct}% do orçamento`}
          icon="dollar"
          label="Gasto até agora"
          tone="blue"
          unit="$"
          value={initial.spent}
        />
        <KpiCard
          hint={
            initial.guardrailPct === null
              ? "nenhum limite definido"
              : over
                ? "rompido — revisar alocação"
                : "dentro do limite"
          }
          icon="gauge"
          label="Guardrail"
          tone={guardrailTone}
          unit={initial.guardrailPct === null ? undefined : "%"}
          value={initial.guardrailPct ?? "—"}
        />
        <KpiCard
          hint="apontados a este value stream"
          icon="layers"
          label="Épicos financiados"
          tone="purple"
          value={initial.epicCount}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 16,
        }}
      >
        <SectionCard
          icon="dollar"
          subtitle="Gasto acumulado vs. orçamento alocado"
          title="Consumo do orçamento"
          tone={guardrailTone}
        >
          {initial.budgetAllocated === 0 ? (
            <EmptyState
              description="Nenhum orçamento (LeanBudget) foi alocado a este value stream ainda."
              icon="dollar"
              title="Sem orçamento alocado"
            />
          ) : (
            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--fs-base)",
                  marginBottom: 8,
                }}
              >
                <span
                  className="mono"
                  style={{ fontWeight: 700, color: "var(--ink-muted)" }}
                >
                  ${initial.spent.toLocaleString()}{" "}
                  <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}>
                    / ${initial.budgetAllocated.toLocaleString()}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{ fontWeight: 700, color: "var(--ink-muted)" }}
                >
                  {initial.utilizationPct}%
                </span>
              </div>
              <Progress
                height={12}
                tone={guardrailTone}
                value={initial.utilizationPct}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon="gauge"
          subtitle="Gasto vs. limite de gasto (spendLimitUsd)"
          title="Guardrail de gasto"
          tone={guardrailTone}
        >
          {initial.guardrailPct === null ? (
            <EmptyState
              description="Nenhum orçamento deste value stream tem um limite de gasto (guardrail) configurado ainda."
              icon="gauge"
              title="Sem guardrail definido"
            />
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--fs-base)",
                  marginBottom: 8,
                }}
              >
                <span
                  className="mono"
                  style={{ fontWeight: 700, color: "var(--ink-muted)" }}
                >
                  ${initial.spent.toLocaleString()}
                  {initial.spendLimitUsd !== null && (
                    <span
                      style={{ color: "var(--ink-faint)", fontWeight: 500 }}
                    >
                      {" "}
                      / ${initial.spendLimitUsd.toLocaleString()}
                    </span>
                  )}
                </span>
                <span
                  className="mono"
                  style={{
                    fontWeight: 700,
                    color: `var(--${guardrailTone}-text)`,
                  }}
                >
                  {initial.guardrailPct}%
                </span>
              </div>
              <Progress
                height={12}
                tone={guardrailTone}
                value={initial.guardrailPct}
              />
            </div>
          )}
        </SectionCard>
      </div>

      <div style={{ marginTop: 16 }}>
        <SectionCard
          icon="kanban"
          subtitle={`${initial.epicCount} épicos apontados a este value stream`}
          title="Épicos financiados"
          tone={guardrailTone}
        >
          {initial.epics.length === 0 ? (
            <EmptyState
              description="Nenhum épico foi vinculado explicitamente ainda — vincule um GovernedEpic com valueStreamId apontando para este ART."
              icon="kanban"
              title="Nenhum épico vinculado"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {initial.epics.map((e) => (
                <button
                  className="lift"
                  key={e.id}
                  onClick={() => navigate("epic", e.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                  }}
                  type="button"
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "var(--fs-base)",
                        fontWeight: 600,
                        color: "var(--ink)",
                      }}
                    >
                      {e.title}
                    </div>
                    {e.wsjf !== null && (
                      <span
                        className="mono"
                        style={{
                          fontSize: "var(--fs-nota)",
                          color: "var(--ink-faint)",
                        }}
                      >
                        WSJF {e.wsjf}
                      </span>
                    )}
                  </div>
                  <Badge tone="neutral">{e.progressPct}%</Badge>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

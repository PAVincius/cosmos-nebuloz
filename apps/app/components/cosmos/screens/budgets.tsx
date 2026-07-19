"use client";

// budgets.tsx — Lean Budgets, wired to listLeanBudgets(). Lists real LeanBudget
// rows (name, theme, amount vs. spent, CapEx/OpEx split) — the design's
// "Value Stream" concept has no dedicated model, so this lists budgets directly.
import { useEffect, useState } from "react";
import {
  type LeanBudgetView,
  listLeanBudgets,
} from "@/app/(cosmos)/actions/budgets";
import { Badge, KpiCard, PageHeader, Progress, SectionCard } from "../kit";

function utilizationTone(pct: number): "green" | "amber" | "red" {
  if (pct >= 95) {
    return "red";
  }
  if (pct >= 80) {
    return "amber";
  }
  return "green";
}

function BudgetRow({ b }: { b: LeanBudgetView }) {
  const tone = utilizationTone(b.utilizationPct);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 160px 80px",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 12,
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {b.name}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
          {b.themeName ?? "Sem tema"} · {b.period}
        </div>
      </div>
      <span
        className="mono"
        style={{ fontSize: 12.5, color: "var(--ink-muted)" }}
      >
        ${b.spent.toLocaleString()} / ${b.amount.toLocaleString()}
      </span>
      <Progress tone={tone} value={b.utilizationPct} />
      <Badge tone={tone}>{b.utilizationPct}%</Badge>
    </div>
  );
}

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<LeanBudgetView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listLeanBudgets().then((r) => {
      if (r.ok) {
        setBudgets(r.data);
      }
      setLoading(false);
    });
  }, []);

  const totalAmount = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalUtilizationPct =
    totalAmount > 0 ? Math.round((totalSpent / totalAmount) * 100) : 0;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Financeiro"
        meta={<Badge tone="accent">{budgets.length} orçamentos</Badge>}
        subtitle="Orçamentos por PI/ART, consumo vs. alocado."
        title="Lean Budgets"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          icon="dollar"
          label="Total alocado"
          tone="accent"
          unit="$"
          value={totalAmount.toLocaleString()}
        />
        <KpiCard
          icon="trendingUp"
          label="Total consumido"
          tone="green"
          unit="$"
          value={totalSpent.toLocaleString()}
        />
      </div>
      <SectionCard
        icon="wallet"
        subtitle={`${totalUtilizationPct}% do orçamento total consumido`}
        title="Orçamentos por período"
      >
        {loading ? (
          <div style={{ padding: 16, color: "var(--ink-faint)" }}>
            Carregando…
          </div>
        ) : budgets.length === 0 ? (
          <div style={{ padding: 16, color: "var(--ink-faint)" }}>
            Nenhum orçamento encontrado.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 16,
            }}
          >
            {budgets.map((b) => (
              <BudgetRow b={b} key={b.id} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

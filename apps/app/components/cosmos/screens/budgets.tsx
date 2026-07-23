"use client";

// budgets.tsx — Lean Budgets, wired to listLeanBudgets(). Lists real LeanBudget
// rows (name, theme, amount vs. spent, CapEx/OpEx split) — the design's
// "Value Stream" concept has no dedicated model, so this lists budgets directly.
// Also hosts GuardrailsModal, a per-row edit affordance for the CapEx/OpEx
// split and the spend-limit/approval-threshold guardrails.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type LeanBudgetView,
  listLeanBudgets,
  updateLeanBudgetGuardrails,
} from "@/app/(cosmos)/actions/budgets";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

function utilizationTone(pct: number): "green" | "amber" | "red" {
  if (pct >= 95) {
    return "red";
  }
  if (pct >= 80) {
    return "amber";
  }
  return "green";
}

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
};

function GuardrailsModal({
  budget,
  onSuccess,
}: {
  budget: LeanBudgetView;
  onSuccess?: () => void;
}) {
  const { close } = useModal();
  const [capexPct, setCapexPct] = useState(String(budget.capexPct ?? ""));
  const [opexPct, setOpexPct] = useState(String(budget.opexPct ?? ""));
  const [spendLimitUsd, setSpendLimitUsd] = useState(
    String(budget.spendLimitUsd ?? "")
  );
  const [approvalThresholdUsd, setApprovalThresholdUsd] = useState(
    String(budget.approvalThresholdUsd ?? "")
  );
  const [saving, setSaving] = useState(false);

  const capex = Number.parseFloat(capexPct);
  const opex = Number.parseFloat(opexPct);
  const splitValid =
    Number.isFinite(capex) && Number.isFinite(opex) && capex + opex === 100;

  const save = async () => {
    if (!splitValid || saving) {
      return;
    }
    setSaving(true);
    const limit = Number.parseFloat(spendLimitUsd);
    const threshold = Number.parseFloat(approvalThresholdUsd);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        updateLeanBudgetGuardrails({
          budgetId: budget.id,
          capexPct: capex,
          opexPct: opex,
          spendLimitUsd: Number.isFinite(limit) ? limit : undefined,
          approvalThresholdUsd: Number.isFinite(threshold)
            ? threshold
            : undefined,
        }),
      {
        loading: "Salvando guardrails...",
        success: "Guardrails atualizados.",
        error: (err: string) => `Não foi possível salvar: ${err}`,
      }
    );
    setSaving(false);
    close();
    if (res.ok) {
      onSuccess?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="shield" size={16} strokeWidth={2.4} />}
      subtitle={`Editar guardrails de ${budget.name}`}
      title="Guardrails do orçamento"
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="guardrails-capex" style={fieldLabelStyle}>
              CapEx %
            </label>
            <input
              id="guardrails-capex"
              max={100}
              min={0}
              onChange={(e) => setCapexPct(e.target.value)}
              style={inputStyle}
              type="number"
              value={capexPct}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="guardrails-opex" style={fieldLabelStyle}>
              OpEx %
            </label>
            <input
              id="guardrails-opex"
              max={100}
              min={0}
              onChange={(e) => setOpexPct(e.target.value)}
              style={inputStyle}
              type="number"
              value={opexPct}
            />
          </div>
        </div>
        {!splitValid && (
          <div style={{ fontSize: 12, color: "var(--red-text)" }}>
            CapEx % + OpEx % devem somar 100.
          </div>
        )}

        <div>
          <label htmlFor="guardrails-spend-limit" style={fieldLabelStyle}>
            Limite de gasto (USD, opcional)
          </label>
          <input
            id="guardrails-spend-limit"
            min={0}
            onChange={(e) => setSpendLimitUsd(e.target.value)}
            style={inputStyle}
            type="number"
            value={spendLimitUsd}
          />
        </div>

        <div>
          <label
            htmlFor="guardrails-approval-threshold"
            style={fieldLabelStyle}
          >
            Limite de aprovação (USD, opcional)
          </label>
          <input
            id="guardrails-approval-threshold"
            min={0}
            onChange={(e) => setApprovalThresholdUsd(e.target.value)}
            style={inputStyle}
            type="number"
            value={approvalThresholdUsd}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={save} size="sm" variant="primary">
            Salvar guardrails
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function BudgetRow({
  b,
  onGuardrailsSaved,
}: {
  b: LeanBudgetView;
  onGuardrailsSaved: () => void;
}) {
  const modal = useModal();
  const tone = utilizationTone(b.utilizationPct);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 160px 80px auto",
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
      <Button
        icon="shield"
        onClick={() =>
          modal.open(
            <GuardrailsModal budget={b} onSuccess={onGuardrailsSaved} />
          )
        }
        size="sm"
        variant="secondary"
      >
        Guardrails
      </Button>
    </div>
  );
}

function BudgetsBody() {
  const [budgets, setBudgets] = useState<LeanBudgetView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listLeanBudgets().then((r) => {
      if (r.ok) {
        setBudgets(r.data);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
              <BudgetRow b={b} key={b.id} onGuardrailsSaved={load} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function BudgetsScreen() {
  return (
    <ModalProvider>
      <BudgetsBody />
    </ModalProvider>
  );
}

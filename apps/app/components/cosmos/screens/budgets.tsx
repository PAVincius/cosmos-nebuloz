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
import { createLeanBudget } from "@/app/actions/lean-budget";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

function utilizationTone(pct: number | null): "green" | "amber" | "red" {
  if (pct === null) {
    return "green";
  }
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
    if (res.ok) {
      close();
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
  const { navigate } = useNav();
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
        {b.artId && (
          <button
            onClick={() => navigate("vs", b.artId as string)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              marginTop: 4,
              cursor: "pointer",
            }}
            type="button"
          >
            <Badge icon="layers" tone="accent">
              {b.artName ?? "Value stream"}
            </Badge>
          </button>
        )}
      </div>
      <span
        className="mono"
        style={{ fontSize: 12.5, color: "var(--ink-muted)" }}
      >
        ${b.spent.toLocaleString()} / ${b.amount.toLocaleString()}
      </span>
      <Progress tone={tone} value={b.utilizationPct ?? 0} />
      <Badge tone={tone}>
        {b.utilizationPct === null ? "—" : `${b.utilizationPct}%`}
      </Badge>
      {b.immutableAt ? (
        // story-025 AC-005: PI encerrado deixa o orçamento somente leitura. A
        // action recusa a escrita; oferecer o botão mesmo assim seria uma
        // armadilha, não uma proteção.
        <Badge icon="lock" tone="neutral">
          Orçamento do PI encerrado — valores finais
        </Badge>
      ) : (
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
      )}
    </div>
  );
}

// story-062 — não existia caminho nenhum, em tela nenhuma, para criar um Lean
// Budget: (cosmos)/actions/budgets só lista e ajusta guardrails, e
// createLeanBudget morava em app/actions/lean-budget sem chamador. Orçamento só
// nascia por seed ou SQL. ART e tema ficam de fora deste formulário de
// propósito — a ação já os aceita e valida, mas vincular pede o seletor de
// entidade, que é outra história.
function NovoBudgetModal({ onCreated }: { onCreated: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const valor = Number(amount);
    if (!(name.trim() && period.trim() && valor > 0) || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createLeanBudget({
          name: name.trim(),
          amount: valor,
          period: period.trim(),
        }),
      {
        loading: "Criando orçamento...",
        success: "Orçamento criado.",
        error: (err: string) =>
          err === "FORBIDDEN"
            ? "Só ADMIN ou RTE cria Lean Budget."
            : `Não foi possível criar o orçamento: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onCreated();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="wallet" size={16} strokeWidth={2.4} />}
      subtitle="Lean Budget é o envelope de gasto de um PI — depois de fechado ele congela"
      title="Novo orçamento"
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="budget-name" style={fieldLabelStyle}>
            Nome do orçamento
          </label>
          <input
            autoFocus
            id="budget-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Budget Pagamentos"
            style={inputStyle}
            value={name}
          />
        </div>
        <div>
          <label htmlFor="budget-amount" style={fieldLabelStyle}>
            Valor alocado
          </label>
          <input
            id="budget-amount"
            min={1}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000000"
            style={inputStyle}
            type="number"
            value={amount}
          />
        </div>
        <div>
          <label htmlFor="budget-period" style={fieldLabelStyle}>
            Período
          </label>
          <input
            id="budget-period"
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="Ex: PI-2026-Q1"
            style={inputStyle}
            value={period}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar orçamento
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function BudgetsBody() {
  const modal = useModal();
  const [budgets, setBudgets] = useState<LeanBudgetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    listLeanBudgets().then((r) => {
      if (r.ok) {
        setBudgets(r.data);
        setError(false);
      } else {
        // Antes daqui a falha caía no mesmo texto do vazio, dizendo ao
        // Business Owner que o portfólio dele não tem orçamento nenhum.
        setError(true);
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
    totalAmount > 0 ? Math.round((totalSpent / totalAmount) * 100) : null;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Financeiro"
        meta={<Badge tone="accent">{budgets.length} orçamentos</Badge>}
        subtitle="Orçamentos por PI/ART, consumo vs. alocado."
        title="Lean Budgets"
      >
        <Button
          onClick={() => modal.open(<NovoBudgetModal onCreated={load} />)}
          size="sm"
          variant="primary"
        >
          Novo orçamento
        </Button>
      </PageHeader>
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
      {error && (
        <ErrorState message="Não foi possível carregar os orçamentos." />
      )}
      <SectionCard
        icon="wallet"
        subtitle={
          totalUtilizationPct === null
            ? "Sem orçamento alocado para medir consumo"
            : `${totalUtilizationPct}% do orçamento total consumido`
        }
        title="Orçamentos por período"
      >
        {loading || error ? (
          <div style={{ padding: 16, color: "var(--ink-faint)" }}>
            {error ? "" : "Carregando…"}
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

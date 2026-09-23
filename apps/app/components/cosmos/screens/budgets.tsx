"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "@repo/design-system/cosmos/kit";
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
import {
  ModalCard,
  ModalProvider,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import { DirtyProvider, FormField, TextInput } from "../modal-form";
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
  fontSize: "var(--fs-nota)",
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "var(--fs-forte)",
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
          <div style={{ fontSize: "var(--fs-base)", color: "var(--red-text)" }}>
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
        <div
          style={{
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {b.name}
        </div>
        <div style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
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
        style={{ fontSize: "var(--fs-base)", color: "var(--ink-muted)" }}
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
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const valor = Number(amount);
  const valorValido = Number.isFinite(valor) && valor > 0;

  const create = async () => {
    if (!(name.trim() && period.trim() && valorValido) || saving) {
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

  useModalSubmitShortcut(create, !saving);

  return (
    <DirtyProvider value={{ markDirty: () => setDirty(true) }}>
      <ModalCard
        footer={
          confirmandoSaida ? (
            <>
              <span
                style={{
                  color: "var(--ink-subtle)",
                  fontSize: "var(--fs-base)",
                }}
              >
                Descartar o que você preencheu?
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => setConfirmandoSaida(false)}
                  size="sm"
                  variant="secondary"
                >
                  Continuar editando
                </Button>
                <Button onClick={close} size="sm" variant="secondary">
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <>
              <ModalShortcutHint salvar="criar" />
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => {
                    // Confirma só quando há o que perder.
                    if (dirty) {
                      setConfirmandoSaida(true);
                      return;
                    }
                    close();
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  icon="check"
                  onClick={create}
                  size="sm"
                  variant="primary"
                >
                  {saving ? "Criando..." : "Criar orçamento"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="wallet" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Financiamento contínuo de um fluxo de valor — depois que o PI fecha, o envelope congela"
        title="Novo orçamento"
        tone="green"
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid rgba(var(--green-rgb),.25)",
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <Badge icon="wallet" tone="green">
                {period.trim() || "Período do PI"}
              </Badge>
              <div
                className="display"
                style={{
                  fontSize: "var(--fs-forte)",
                  fontWeight: 700,
                  margin: "10px 0",
                }}
              >
                {name || "Nome do orçamento"}
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  marginTop: 14,
                  paddingTop: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "var(--fs-base)",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="mono"
                    style={{ color: "var(--ink-muted)", fontWeight: 700 }}
                  >
                    {valorValido ? `$${valor.toLocaleString()}` : "$—"}
                  </span>
                  <span style={{ color: "var(--ink-faint)" }}>alocado</span>
                </div>
                {/* Zero não é enfeite: o envelope nasce sem consumo e só a
                    apropriação de custo do PI move esta barra. */}
                <Progress height={8} tone="green" value={0} />
              </div>
              <div
                style={{
                  color: "var(--ink-faint)",
                  fontSize: "var(--fs-nota)",
                  lineHeight: 1.6,
                  marginTop: 12,
                }}
              >
                0% consumido — o gasto entra pelos custos apropriados ao PI, não
                por edição manual.
              </div>
              <div
                style={{
                  color: "var(--ink-faint)",
                  fontSize: "var(--fs-nota)",
                  lineHeight: 1.6,
                  marginTop: 6,
                }}
              >
                CapEx/OpEx e limites de aprovação se ajustam depois, em
                Guardrails.
              </div>
            </div>
          }
        >
          <FormField label="Nome do orçamento" required>
            <TextInput
              onChange={setName}
              placeholder="ex: Budget Pagamentos"
              required
              value={name}
            />
          </FormField>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <FormField label="Valor alocado" required>
              <TextInput
                onChange={setAmount}
                placeholder="1000000"
                required
                type="number"
                value={amount}
              />
            </FormField>
            <FormField
              hint="O PI que este envelope financia"
              label="Período"
              required
            >
              <TextInput
                onChange={setPeriod}
                placeholder="ex: PI-2026-Q1"
                required
                value={period}
              />
            </FormField>
          </div>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
          value={totalAmount}
        />
        <KpiCard
          icon="trendingUp"
          label="Total consumido"
          tone="green"
          unit="$"
          value={totalSpent}
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

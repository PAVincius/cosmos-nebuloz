"use client";

import {
  CheckCircle2Icon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TrendingUpIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DataTable,
  type DataTableColumn,
} from "@/app/(authenticated)/components/data-table";
import { Gauge } from "@/app/(authenticated)/components/gauge";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";
import {
  createLeanBudget,
  deleteLeanBudget,
  updateLeanBudget,
} from "@/app/actions/lean-budget";
import {
  getPortfolioAllocation,
  type PortfolioAllocation,
} from "@/app/actions/lean-budget/portfolio-allocation";
import type { LeanBudgetWithUsage } from "@/app/actions/lean-budget/schema";
import { updateStrategicTheme } from "@/app/actions/strategic-themes";
import type { ThemeListItem } from "@/app/actions/strategic-themes/schema";
import { BudgetAllocationPanel } from "./budget-allocation-panel";
import {
  FieldRow,
  FormField,
  ModalFooterActions,
  Select,
  TextArea,
  TextInput,
} from "./cosmos-form";
import { FinOpsSection } from "./finops-section";
import { UsageBar } from "./usage-bar";

// ─── Icon paths (single-`d` lucide glyphs, safe across Server→Client) ────────

const ICON_WALLET =
  "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z";
const ICON_TRENDING = "M22 7L13.5 15.5 8.5 10.5 2 17M16 7h6v6";
const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_SHIELD_ALERT =
  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM12 8v4M12 16h.01";

// ─── Types ────────────────────────────────────────────────────────────────

type ARTOption = { id: string; name: string };

type BillingIntegration = {
  id: string;
  name: string;
  source: string;
  status: string;
  lastSyncAt: Date | null;
};

type Props = {
  initialBudgets: LeanBudgetWithUsage[];
  arts: ARTOption[];
  overviewData: BudgetOverviewItem[];
  billingIntegrations: BillingIntegration[];
  artFilter?: string;
  themes: ThemeListItem[];
  initialAllocation: PortfolioAllocation | null;
  availablePeriods: string[];
};

type BudgetFormState = {
  name: string;
  artId: string;
  themeId: string;
  period: string;
  amount: string;
  spent: string;
  capex: string;
  opex: string;
};

const DEFAULT_BUDGET_FORM: BudgetFormState = {
  name: "",
  artId: "",
  themeId: "",
  period: "",
  amount: "",
  spent: "",
  capex: "",
  opex: "",
};

type BudgetModalState =
  | { mode: "create" }
  | { mode: "edit"; id: string }
  | null;

type HorizonFormState = {
  themeId: string;
  horizon: string;
  description: string;
  budgetTotal: string;
};

const DEFAULT_HORIZON_FORM: HorizonFormState = {
  themeId: "",
  horizon: "",
  description: "",
  budgetTotal: "",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Manifest guardrail thresholds: green <75%, amber ≥75%, red ≥90%. */
function utilTone(pct: number): "green" | "amber" | "red" {
  if (pct >= 90) {
    return "red";
  }
  if (pct >= 75) {
    return "amber";
  }
  return "green";
}

const ART_PALETTE = ["91,141,239", "167,139,250", "52,211,153", "251,191,36"];

// ─── Capital Allocation Flow (simplified two-tier proportional flow) ───────

function CapitalFlowBar({
  segments,
}: {
  segments: Array<{ id: string; label: string; value: number; rgb: string }>;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) {
    return null;
  }
  return (
    <div className="flex h-7 w-full overflow-hidden rounded-md border border-hairline">
      {segments.map((seg) => (
        <div
          className="flex items-center justify-center overflow-hidden whitespace-nowrap px-1.5 font-bold font-mono text-[9.5px] text-white"
          key={seg.id}
          style={{
            width: `${(seg.value / total) * 100}%`,
            background: `rgb(${seg.rgb})`,
          }}
          title={`${seg.label}: ${formatCurrency(seg.value)}`}
        >
          {(seg.value / total) * 100 >= 8 ? seg.label : ""}
        </div>
      ))}
    </div>
  );
}

function CapitalAllocationFlow({
  budgets,
  arts,
  allocation,
}: {
  budgets: LeanBudgetWithUsage[];
  arts: ARTOption[];
  allocation: PortfolioAllocation | null;
}) {
  const artSegments = arts
    .map((art, i) => ({
      id: art.id,
      label: art.name,
      value: budgets
        .filter((b) => b.artId === art.id)
        .reduce((s, b) => s + b.amount, 0),
      rgb: ART_PALETTE[i % ART_PALETTE.length],
    }))
    .filter((s) => s.value > 0);

  const themeSegments = (allocation?.themes ?? [])
    .map((t) => {
      const rgbMatch = /^#?([0-9A-Fa-f]{6})$/.exec(t.themeColor ?? "");
      const rgb = rgbMatch
        ? `${Number.parseInt(rgbMatch[1].slice(0, 2), 16)},${Number.parseInt(rgbMatch[1].slice(2, 4), 16)},${Number.parseInt(rgbMatch[1].slice(4, 6), 16)}`
        : "124,135,255";
      return {
        id: t.themeId ?? "unallocated",
        label: t.themeName,
        value: t.totalAmount,
        rgb,
      };
    })
    .filter((s) => s.value > 0);

  if (artSegments.length === 0 && themeSegments.length === 0) {
    return null;
  }

  return (
    <SectionCard
      accentRgb="0,212,255"
      icon={TrendingUpIcon}
      subtitle="Como o capital flui dos ARTs para os Temas Estratégicos"
      title="Capital Allocation Flow"
    >
      <div className="space-y-3">
        {artSegments.length > 0 && (
          <div>
            <p className="mb-1.5 font-mono text-[10px] text-ink-muted uppercase tracking-[0.08em]">
              Por ART
            </p>
            <CapitalFlowBar segments={artSegments} />
          </div>
        )}
        <div className="flex justify-center text-ink-muted">↓</div>
        {themeSegments.length > 0 && (
          <div>
            <p className="mb-1.5 font-mono text-[10px] text-ink-muted uppercase tracking-[0.08em]">
              Por Tema Estratégico (Investment Horizon)
            </p>
            <CapitalFlowBar segments={themeSegments} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function BudgetDashboard({
  initialBudgets,
  arts,
  overviewData,
  billingIntegrations,
  artFilter,
  themes,
  initialAllocation,
  availablePeriods,
}: Props) {
  const router = useRouter();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [, startTransition] = useTransition();

  // ── Investment Horizons (Theme allocation) state — lifted up so the KPI
  // row and the M7 preview-rail can share the same live data. ──────────────
  const [period, setPeriod] = useState(
    initialAllocation?.period ?? availablePeriods[0] ?? ""
  );
  const [allocation, setAllocation] = useState(initialAllocation);
  const [isAllocationPending, startAllocationTransition] = useTransition();

  function loadPeriod(nextPeriod: string) {
    setPeriod(nextPeriod);
    startAllocationTransition(async () => {
      const result = await getPortfolioAllocation(nextPeriod);
      setAllocation(result);
    });
  }

  // ── M6 — Value Stream (Lean Budget) modal ────────────────────────────────
  const [budgetModal, setBudgetModal] = useState<BudgetModalState>(null);
  const [budgetForm, setBudgetForm] =
    useState<BudgetFormState>(DEFAULT_BUDGET_FORM);
  const [isSavingBudget, startBudgetSave] = useTransition();

  // ── M7 — Investment Horizon modal ────────────────────────────────────────
  const [horizonModalOpen, setHorizonModalOpen] = useState(false);
  const [horizonForm, setHorizonForm] =
    useState<HorizonFormState>(DEFAULT_HORIZON_FORM);
  const [isSavingHorizon, startHorizonSave] = useTransition();

  const artMap = new Map(arts.map((a) => [a.id, a.name]));
  const themeMap = new Map(themes.map((t) => [t.id, t]));

  const sortedBudgets = useMemo(() => {
    if (!artFilter) {
      return budgets;
    }
    return [...budgets].sort((a, b) => {
      const aMatch = a.artId === artFilter ? 0 : 1;
      const bMatch = b.artId === artFilter ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [budgets, artFilter]);

  const scopedBudgets = artFilter
    ? budgets.filter((b) => b.artId === artFilter)
    : budgets;

  // Consolidated totals per period (unchanged real logic)
  const periodTotals = Array.from(
    budgets.reduce((map, b) => {
      const existing = map.get(b.period) ?? { amount: 0, spent: 0 };
      return map.set(b.period, {
        amount: existing.amount + b.amount,
        spent: existing.spent + (b.spentDecimal ?? 0),
      });
    }, new Map<string, { amount: number; spent: number }>())
  )
    .map(([period, totals]) => ({ period, ...totals }))
    .sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0));

  const overGuardrailCount = scopedBudgets.filter(
    (b) => b.isOverGuardrail
  ).length;
  const approachingGuardrailBudgets = budgets.filter(
    (b) => !b.isOverGuardrail && b.percentUsed >= 75
  );

  const totalAllocated = scopedBudgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = scopedBudgets.reduce(
    (s, b) => s + (b.spentDecimal ?? 0),
    0
  );
  const totalUsedPct =
    totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
  // ── Value Stream (M6) handlers ───────────────────────────────────────────

  function openCreateBudget() {
    setBudgetForm(DEFAULT_BUDGET_FORM);
    setBudgetModal({ mode: "create" });
  }

  function openEditBudget(budget: LeanBudgetWithUsage) {
    setBudgetForm({
      name: budget.name,
      artId: budget.artId ?? "",
      themeId: budget.themeId ?? "",
      period: budget.period,
      amount: String(budget.amount),
      spent: String(budget.spentDecimal ?? 0),
      capex: budget.guardrails ? String(budget.guardrails.capex) : "",
      opex: budget.guardrails ? String(budget.guardrails.opex) : "",
    });
    setBudgetModal({ mode: "edit", id: budget.id });
  }

  function handleDelete(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    startTransition(() => {
      deleteLeanBudget(id).then((result) => {
        if (result.ok) {
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    });
  }

  function handleBudgetSubmit() {
    if (!budgetModal) {
      return;
    }
    const amount = Number.parseFloat(budgetForm.amount);
    if (
      !budgetForm.name.trim() ||
      Number.isNaN(amount) ||
      amount <= 0 ||
      !budgetForm.period.trim()
    ) {
      toast.error("Preencha nome, valor alocado e período.");
      return;
    }
    const spent = Number.parseFloat(budgetForm.spent) || 0;
    const capex = Number.parseFloat(budgetForm.capex) || 0;
    const opex = Number.parseFloat(budgetForm.opex) || 0;
    const guardrails = capex > 0 || opex > 0 ? { capex, opex } : undefined;

    if (budgetModal.mode === "create") {
      const optimistic: LeanBudgetWithUsage = {
        id: `tmp-${Date.now()}`,
        name: budgetForm.name,
        amount,
        spentDecimal: spent,
        period: budgetForm.period,
        artId: budgetForm.artId || null,
        themeId: budgetForm.themeId || null,
        guardrails: guardrails ?? null,
        percentUsed: amount > 0 ? Math.round((spent / amount) * 100) : 0,
        isOverGuardrail: amount > 0 && spent / amount > 0.8,
        isOverBudget: spent > amount,
        isNearLimit: amount > 0 && spent / amount > 0.8,
        tenantId: "",
        spentSource: "manual",
        spentManualOverride: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as LeanBudgetWithUsage;

      setBudgets((prev) => [optimistic, ...prev]);
      setBudgetModal(null);
      startBudgetSave(async () => {
        const result = await createLeanBudget({
          name: budgetForm.name,
          amount,
          spent,
          period: budgetForm.period,
          artId: budgetForm.artId || undefined,
          themeId: budgetForm.themeId || undefined,
          guardrails,
        });
        if (result.ok) {
          toast.success("Value Stream criado.");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
      return;
    }

    const { id } = budgetModal;
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              name: budgetForm.name,
              amount,
              spentDecimal: spent,
              period: budgetForm.period,
              guardrails: guardrails ?? null,
              percentUsed: amount > 0 ? Math.round((spent / amount) * 100) : 0,
            }
          : b
      )
    );
    setBudgetModal(null);
    startBudgetSave(async () => {
      try {
        await updateLeanBudget(id, {
          name: budgetForm.name,
          amount,
          spent,
          period: budgetForm.period,
          guardrails,
        });
        toast.success("Value Stream atualizado.");
        router.refresh();
      } catch {
        toast.error("Não foi possível atualizar o Value Stream.");
      }
    });
  }

  // ── Investment Horizon (M7) handlers ─────────────────────────────────────

  function openCreateHorizon() {
    setHorizonForm(DEFAULT_HORIZON_FORM);
    setHorizonModalOpen(true);
  }

  function openEditHorizon(themeId: string) {
    const theme = themeMap.get(themeId);
    if (!theme) {
      return;
    }
    setHorizonForm({
      themeId: theme.id,
      horizon: theme.horizon ?? "",
      description: theme.description ?? "",
      budgetTotal: theme.budgetTotal != null ? String(theme.budgetTotal) : "",
    });
    setHorizonModalOpen(true);
  }

  function handleHorizonThemeChange(themeId: string) {
    const theme = themeMap.get(themeId);
    setHorizonForm({
      themeId,
      horizon: theme?.horizon ?? "",
      description: theme?.description ?? "",
      budgetTotal: theme?.budgetTotal != null ? String(theme.budgetTotal) : "",
    });
  }

  function handleHorizonSubmit() {
    if (!horizonForm.themeId) {
      toast.error("Selecione o Tema Estratégico (Investment Horizon).");
      return;
    }
    const { themeId } = horizonForm;
    const budgetTotal = horizonForm.budgetTotal
      ? Number.parseFloat(horizonForm.budgetTotal)
      : undefined;

    setHorizonModalOpen(false);
    startHorizonSave(async () => {
      const result = await updateStrategicTheme(themeId, {
        horizon: horizonForm.horizon.trim() || undefined,
        description: horizonForm.description.trim() || undefined,
        budgetTotal,
      });
      if (result.ok) {
        toast.success("Investment Horizon atualizado.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const selectedHorizonTheme = themeMap.get(horizonForm.themeId);
  const selectedHorizonAllocation = allocation?.themes.find(
    (t) => t.themeId === horizonForm.themeId
  );
  const horizonLinkedBudgets = budgets.filter(
    (b) => b.themeId === horizonForm.themeId
  );

  const budgetColumns: DataTableColumn<LeanBudgetWithUsage>[] = [
    {
      key: "name",
      label: "Value Stream",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-[13px] text-ink">
            {row.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {row.artId && (
              <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-muted">
                {artMap.get(row.artId) ?? row.artId}
              </span>
            )}
            {row.themeId && (
              <span className="flex items-center gap-1 rounded-pill bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: themeMap.get(row.themeId)?.color ?? "#888",
                  }}
                />
                {themeMap.get(row.themeId)?.title ?? row.themeId}
              </span>
            )}
          </div>
        </div>
      ),
    },
    { key: "period", label: "Período", mono: true },
    {
      key: "spent",
      label: "Consumido vs. guardrail",
      render: (row) => (
        <UsageBar
          amount={row.amount}
          percentUsed={row.percentUsed}
          spent={row.spentDecimal ?? 0}
          tone={utilTone(row.percentUsed)}
        />
      ),
    },
    {
      key: "guardrail",
      label: "Guardrail",
      render: (row) => {
        if (row.isOverGuardrail) {
          return (
            <span
              className="flex items-center gap-1 font-semibold text-[11.5px]"
              style={{ color: "var(--red-text)" }}
            >
              <ShieldAlertIcon size={12} /> violado
            </span>
          );
        }
        if (row.percentUsed >= 75) {
          return (
            <span
              className="flex items-center gap-1 font-semibold text-[11.5px]"
              style={{ color: "var(--amber-text)" }}
            >
              <ShieldAlertIcon size={12} /> atenção
            </span>
          );
        }
        return (
          <span
            className="flex items-center gap-1 font-semibold text-[11.5px]"
            style={{ color: "var(--green-text)" }}
          >
            <CheckCircle2Icon size={12} /> ok
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            aria-label="Editar"
            className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              openEditBudget(row);
            }}
            type="button"
          >
            <PencilIcon size={12} />
          </button>
          <button
            aria-label="Remover"
            className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition-colors hover:bg-red-soft hover:text-red-text"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.id);
            }}
            type="button"
          >
            <Trash2Icon size={12} />
          </button>
        </div>
      ),
    },
  ];

  const periodColumns: DataTableColumn<{
    period: string;
    amount: number;
    spent: number;
  }>[] = [
    {
      key: "period",
      label: "Período",
      mono: true,
      render: (row) => row.period,
    },
    {
      key: "amount",
      label: "Total Alocado",
      align: "right",
      mono: true,
      render: (row) => formatCurrency(row.amount),
    },
    {
      key: "spentT",
      label: "Total Gasto",
      align: "right",
      mono: true,
      render: (row) => formatCurrency(row.spent),
    },
    {
      key: "pct",
      label: "Utilização",
      align: "right",
      render: (row) => {
        const pct =
          row.amount > 0
            ? Math.min(100, Math.round((row.spent / row.amount) * 100))
            : 0;
        const tone = utilTone(pct);
        return (
          <span
            className="font-mono font-semibold text-[11.5px]"
            style={{
              color:
                tone === "red"
                  ? "var(--red-text)"
                  : tone === "amber"
                    ? "var(--amber-text)"
                    : "var(--green-text)",
            }}
          >
            {pct}%
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* FinOps overview (unmapped-cost banner, connector CTA) — untouched real wiring */}
      <FinOpsSection
        billingIntegrations={billingIntegrations}
        overviewData={overviewData}
      />

      {/* KPI row */}
      <KpiGrid cols={4}>
        <KpiCard
          badge={`${scopedBudgets.length} value streams`}
          iconPath={ICON_WALLET}
          label="Orçamento total alocado"
          tone="accent"
          value={formatCurrency(totalAllocated)}
        />
        <KpiCard
          badge={`${totalUsedPct}% do orçamento alocado`}
          iconPath={ICON_TRENDING}
          label="Comprometido até agora"
          tone={utilTone(totalUsedPct)}
          value={formatCurrency(totalSpent)}
        />
        <KpiCard
          badge={
            totalUsedPct >= 80 ? "acima do saudável" : "dentro do saudável"
          }
          iconPath={ICON_ACTIVITY}
          label="Utilização do portfólio"
          tone={utilTone(totalUsedPct)}
          unit="%"
          value={totalUsedPct}
        />
        <KpiCard
          badge={`de ${scopedBudgets.length} streams`}
          iconPath={ICON_SHIELD_ALERT}
          label="Guardrails rompidos"
          tone={overGuardrailCount > 0 ? "red" : "green"}
          value={overGuardrailCount}
        />
      </KpiGrid>

      {/* Guardrail alert banners — unchanged real logic, restyled to tokens */}
      {overGuardrailCount > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3"
          style={{
            borderColor: "rgba(var(--red-rgb),.35)",
            background: "rgba(var(--red-rgb),.08)",
          }}
        >
          <ShieldAlertIcon
            className="mt-0.5 shrink-0"
            size={16}
            style={{ color: "var(--red-text)" }}
          />
          <div className="min-w-0">
            <p
              className="font-semibold text-[13px]"
              style={{ color: "var(--red-text)" }}
            >
              {overGuardrailCount} value stream
              {overGuardrailCount > 1 ? "s" : ""} com guardrail violado
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {budgets
                .filter((b) => b.isOverGuardrail)
                .map((b) => b.name)
                .join(", ")}{" "}
              — revise alocações e obtenha aprovação do LPM.
            </p>
          </div>
        </div>
      )}
      {approachingGuardrailBudgets.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3"
          style={{
            borderColor: "rgba(var(--amber-rgb),.35)",
            background: "rgba(var(--amber-rgb),.08)",
          }}
        >
          <ShieldAlertIcon
            className="mt-0.5 shrink-0"
            size={16}
            style={{ color: "var(--amber-text)" }}
          />
          <div className="min-w-0">
            <p
              className="font-semibold text-[13px]"
              style={{ color: "var(--amber-text)" }}
            >
              {approachingGuardrailBudgets.length} value stream
              {approachingGuardrailBudgets.length > 1 ? "s" : ""} se aproximando
              do guardrail (≥75%)
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {approachingGuardrailBudgets
                .map((b) => `${b.name} (${b.percentUsed}%)`)
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* ART filter context chip */}
      {artFilter && (
        <div className="inline-flex w-fit items-center gap-2 rounded-pill border border-hairline bg-surface-2 px-3 py-1.5 text-[12px]">
          <span className="text-ink-muted">Filtrado por:</span>
          <span className="font-semibold text-ink">
            {artMap.get(artFilter) ?? artFilter}
          </span>
          <a
            className="ml-1 text-ink-muted transition-colors hover:text-ink"
            href="/portfolio/budgets"
          >
            <XIcon size={13} />
          </a>
        </div>
      )}

      {/* Capital Allocation Flow — simplified two-tier proportional flow */}
      <CapitalAllocationFlow
        allocation={allocation}
        arts={arts}
        budgets={budgets}
      />

      {/* Value Streams */}
      <SectionCard
        accentRgb="91,141,239"
        actions={
          <button
            className="flex items-center gap-1.5 rounded-cosmos-md bg-accent-c px-3 py-1.5 font-semibold text-[12px] text-[color:var(--on-accent)] transition-opacity hover:opacity-90"
            onClick={openCreateBudget}
            type="button"
          >
            <PlusIcon size={13} /> Novo Value Stream
          </button>
        }
        icon={WalletIcon}
        noPadding
        subtitle="Lean Budgets por ART e Tema Estratégico"
        title="Value Streams"
      >
        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <WalletIcon className="text-ink-muted" size={32} />
            <div>
              <p className="font-semibold text-[13px] text-ink">
                Nenhum Value Stream configurado
              </p>
              <p className="mt-1 text-[12px] text-ink-muted">
                Configure budgets por ART e período para acompanhar gastos com
                guardrails Lean.
              </p>
            </div>
            <button
              className="rounded-cosmos-md bg-accent-c px-3.5 py-2 font-semibold text-[13px] text-[color:var(--on-accent)] transition-opacity hover:opacity-90"
              onClick={openCreateBudget}
              type="button"
            >
              Criar Value Stream
            </button>
          </div>
        ) : (
          <DataTable
            columns={budgetColumns}
            getRowKey={(row) => row.id}
            onRowClick={(row) => {
              if (!row.id.startsWith("tmp-")) {
                router.push(`/portfolio/budgets/${row.id}`);
              }
            }}
            rows={sortedBudgets}
          />
        )}
      </SectionCard>

      {/* Investment Horizons */}
      <SectionCard
        accentRgb="167,139,250"
        actions={
          <button
            className="flex items-center gap-1.5 rounded-cosmos-md bg-accent-c px-3 py-1.5 font-semibold text-[12px] text-[color:var(--on-accent)] transition-opacity hover:opacity-90"
            onClick={openCreateHorizon}
            type="button"
          >
            <PlusIcon size={13} /> Novo Horizon
          </button>
        }
        icon={TrendingUpIcon}
        subtitle="Alocação do portfólio por Tema Estratégico (H1/H2/H3)"
        title="Investment Horizons"
      >
        <BudgetAllocationPanel
          availablePeriods={availablePeriods}
          data={allocation}
          isPending={isAllocationPending}
          onEditTheme={openEditHorizon}
          onPeriodChange={loadPeriod}
          period={period}
          themes={themes}
        />
      </SectionCard>

      {/* Consolidated by period */}
      {periodTotals.length > 0 && (
        <SectionCard
          icon={TrendingUpIcon}
          noPadding
          title="Consolidado por Período"
        >
          <DataTable
            columns={periodColumns}
            getRowKey={(row) => row.period}
            rows={periodTotals}
          />
        </SectionCard>
      )}

      {/* ── M6 — Value Stream modal ─────────────────────────────────────── */}
      <ModalShell
        eyebrow="Value Stream · Lean Budget"
        footer={
          <ModalFooterActions
            onCancel={() => setBudgetModal(null)}
            onSubmit={handleBudgetSubmit}
            submitDisabled={isSavingBudget}
            submitLabel={
              budgetModal?.mode === "edit" ? "Salvar" : "Criar Value Stream"
            }
          />
        }
        onClose={() => setBudgetModal(null)}
        open={budgetModal !== null}
        title={
          budgetModal?.mode === "edit"
            ? "Editar Value Stream"
            : "Novo Value Stream"
        }
      >
        <div className="flex gap-5">
          <div className="flex flex-1 flex-col gap-3.5">
            <FormField label="Nome" required>
              <TextInput
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, name: e.target.value })
                }
                placeholder="Ex: Q1 2026 - ART Platform"
                value={budgetForm.name}
              />
            </FormField>
            <FieldRow>
              <FormField
                hint={
                  budgetModal?.mode === "edit"
                    ? "Não editável após criação"
                    : undefined
                }
                label="ART"
              >
                <Select
                  aria-label="ART"
                  disabled={budgetModal?.mode === "edit"}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, artId: e.target.value })
                  }
                  value={budgetForm.artId}
                >
                  <option value="">Nenhuma</option>
                  {arts.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                hint={
                  budgetModal?.mode === "edit"
                    ? "Não editável após criação"
                    : undefined
                }
                label="Tema Estratégico"
              >
                <Select
                  aria-label="Tema Estratégico"
                  disabled={budgetModal?.mode === "edit"}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, themeId: e.target.value })
                  }
                  value={budgetForm.themeId}
                >
                  <option value="">Nenhum</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.title}
                    </option>
                  ))}
                </Select>
              </FormField>
            </FieldRow>
            <FieldRow>
              <FormField label="Período" required>
                <TextInput
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, period: e.target.value })
                  }
                  placeholder="Ex: 2026-Q1"
                  value={budgetForm.period}
                />
              </FormField>
              <FormField label="Alocado (R$)" required>
                <TextInput
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, amount: e.target.value })
                  }
                  placeholder="1000000"
                  type="number"
                  value={budgetForm.amount}
                />
              </FormField>
            </FieldRow>
            <FormField hint="Opcional — padrão 0" label="Consumido (R$)">
              <TextInput
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, spent: e.target.value })
                }
                placeholder="0"
                type="number"
                value={budgetForm.spent}
              />
            </FormField>
            <FieldRow>
              <FormField hint="Opcional" label="Guardrail CapEx (R$)">
                <TextInput
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, capex: e.target.value })
                  }
                  placeholder="400000"
                  type="number"
                  value={budgetForm.capex}
                />
              </FormField>
              <FormField hint="Opcional" label="Guardrail OpEx (R$)">
                <TextInput
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, opex: e.target.value })
                  }
                  placeholder="600000"
                  type="number"
                  value={budgetForm.opex}
                />
              </FormField>
            </FieldRow>
          </div>

          {/* Preview rail */}
          <div className="flex w-[296px] shrink-0 flex-col gap-3 rounded-cosmos-md border border-hairline bg-surface-2 p-4">
            <p className="font-mono text-[10px] text-ink-muted uppercase tracking-[0.08em]">
              Preview
            </p>
            <p className="truncate font-semibold text-[14px] text-ink">
              {budgetForm.name || "Nome do Value Stream"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {budgetForm.artId && (
                <span className="rounded-pill bg-surface-3 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-muted">
                  {artMap.get(budgetForm.artId)}
                </span>
              )}
              {budgetForm.themeId && (
                <span className="rounded-pill bg-surface-3 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-muted">
                  {themeMap.get(budgetForm.themeId)?.title}
                </span>
              )}
            </div>
            <div className="grid place-items-center py-2">
              <Gauge
                label="Utilização"
                max={Number.parseFloat(budgetForm.amount) || 1}
                size={104}
                tone={utilTone(
                  budgetForm.amount && Number.parseFloat(budgetForm.amount) > 0
                    ? Math.round(
                        ((Number.parseFloat(budgetForm.spent) || 0) /
                          Number.parseFloat(budgetForm.amount)) *
                          100
                      )
                    : 0
                )}
                value={Number.parseFloat(budgetForm.spent) || 0}
              />
            </div>
            <div className="space-y-1 border-hairline border-t pt-3 text-[11.5px]">
              <div className="flex justify-between">
                <span className="text-ink-muted">Alocado</span>
                <span className="font-mono text-ink">
                  {formatCurrency(Number.parseFloat(budgetForm.amount) || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Consumido</span>
                <span className="font-mono text-ink">
                  {formatCurrency(Number.parseFloat(budgetForm.spent) || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* ── M7 — Investment Horizon modal ───────────────────────────────── */}
      <ModalShell
        eyebrow="Investment Horizon · Tema Estratégico"
        footer={
          <ModalFooterActions
            onCancel={() => setHorizonModalOpen(false)}
            onSubmit={handleHorizonSubmit}
            submitDisabled={isSavingHorizon || !horizonForm.themeId}
            submitLabel="Salvar Horizon"
          />
        }
        onClose={() => setHorizonModalOpen(false)}
        open={horizonModalOpen}
        title="Investment Horizon"
      >
        <div className="flex gap-5">
          <div className="flex flex-1 flex-col gap-3.5">
            <FormField
              hint="Investment Horizons são mapeados aos Temas Estratégicos do portfólio."
              label="Tema Estratégico"
              required
            >
              <Select
                aria-label="Tema Estratégico"
                onChange={(e) => handleHorizonThemeChange(e.target.value)}
                value={horizonForm.themeId}
              >
                <option value="">Selecione um tema…</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField hint="Ex: H1, H2, H3" label="Horizonte">
              <TextInput
                onChange={(e) =>
                  setHorizonForm({ ...horizonForm, horizon: e.target.value })
                }
                placeholder="H1"
                value={horizonForm.horizon}
              />
            </FormField>
            <FormField label="Descrição">
              <TextArea
                onChange={(e) =>
                  setHorizonForm({
                    ...horizonForm,
                    description: e.target.value,
                  })
                }
                placeholder="Missão deste horizonte de investimento…"
                value={horizonForm.description}
              />
            </FormField>
            <FormField hint="Opcional" label="Budget do Tema (R$)">
              <TextInput
                onChange={(e) =>
                  setHorizonForm({
                    ...horizonForm,
                    budgetTotal: e.target.value,
                  })
                }
                placeholder="5000000"
                type="number"
                value={horizonForm.budgetTotal}
              />
            </FormField>
          </div>

          {/* Preview rail */}
          <div className="flex w-[296px] shrink-0 flex-col gap-3 rounded-cosmos-md border border-hairline bg-surface-2 p-4">
            <p className="font-mono text-[10px] text-ink-muted uppercase tracking-[0.08em]">
              Preview
            </p>
            {selectedHorizonTheme ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: selectedHorizonTheme.color }}
                  />
                  <p className="truncate font-semibold text-[14px] text-ink">
                    {selectedHorizonTheme.title}
                  </p>
                </div>
                {horizonForm.horizon && (
                  <span className="w-fit rounded-pill bg-surface-3 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-muted">
                    {horizonForm.horizon}
                  </span>
                )}
                {selectedHorizonAllocation && (
                  <p className="text-[11.5px] text-ink-muted">
                    {selectedHorizonAllocation.percentOfPortfolio}% do portfólio
                    · {selectedHorizonAllocation.percentUsed}% consumido
                  </p>
                )}
                <div className="border-hairline border-t pt-3">
                  <p className="mb-1.5 font-mono text-[9.5px] text-ink-muted uppercase tracking-[0.08em]">
                    Value Streams vinculados ({horizonLinkedBudgets.length})
                  </p>
                  {horizonLinkedBudgets.length === 0 ? (
                    <p className="text-[11.5px] text-ink-muted">
                      Nenhum Value Stream neste tema ainda.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {horizonLinkedBudgets.map((b) => (
                        <li
                          className="truncate text-[11.5px] text-ink-muted"
                          key={b.id}
                        >
                          {b.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[12px] text-ink-muted">
                Selecione um Tema Estratégico para ver o preview do horizonte.
              </p>
            )}
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

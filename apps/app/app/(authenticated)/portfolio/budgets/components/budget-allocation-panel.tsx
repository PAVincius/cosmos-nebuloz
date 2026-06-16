"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  PieChartIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  getPortfolioAllocation,
  type PortfolioAllocation,
  type ThemeAllocation,
} from "@/app/actions/lean-budget/portfolio-allocation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

function StatusIcon({ status }: { status: "ok" | "warn" | "over" }) {
  if (status === "over") {
    return <ShieldAlertIcon className="h-3.5 w-3.5 text-red-500" />;
  }
  if (status === "warn") {
    return <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />;
  }
  return <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />;
}

function spendBarColor(pct: number): string {
  if (pct > 100) {
    return "bg-red-500";
  }
  if (pct > 80) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
}

function spendTextColor(pct: number): string {
  if (pct > 100) {
    return "text-red-600";
  }
  if (pct > 80) {
    return "text-amber-600";
  }
  return "text-foreground";
}

function GuardrailStatus({
  overCount,
  warnCount,
}: {
  overCount: number;
  warnCount: number;
}) {
  if (overCount > 0) {
    return (
      <span className="flex items-center gap-1 font-semibold text-red-600 text-sm">
        <ShieldAlertIcon className="h-4 w-4" />
        {overCount} violação{overCount > 1 ? "ões" : ""}
      </span>
    );
  }
  if (warnCount > 0) {
    return (
      <span className="flex items-center gap-1 font-semibold text-amber-600 text-sm">
        <AlertTriangleIcon className="h-4 w-4" />
        {warnCount} atenção
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 font-semibold text-emerald-600 text-sm">
      <CheckCircle2Icon className="h-4 w-4" />
      Todos OK
    </span>
  );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({ theme }: { theme: ThemeAllocation }) {
  const spendPct = Math.min(theme.percentUsed, 100);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: theme.themeColor }}
          />
          <span className="font-medium text-sm leading-snug">
            {theme.themeName}
          </span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase">
          {theme.percentOfPortfolio}% do portfólio
        </span>
      </div>

      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${theme.percentOfPortfolio}%`,
            backgroundColor: theme.themeColor,
          }}
        />
      </div>

      <div className="mb-3 flex items-center justify-between text-muted-foreground text-xs">
        <span>{BRL(theme.totalAmount)} alocado</span>
        <span>{BRL(theme.totalSpent)} gasto</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Consumo</span>
          <span
            className={
              theme.percentUsed > 100 ? "font-semibold text-red-600" : ""
            }
          >
            {theme.percentUsed}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${spendBarColor(theme.percentUsed)}`}
            style={{ width: `${spendPct}%` }}
          />
        </div>
      </div>

      {theme.guardrails !== null && theme.guardrails !== undefined && (
        <div className="mt-3 flex items-center gap-4 border-t pt-3">
          <div className="flex items-center gap-1.5 text-[11px]">
            <StatusIcon status={theme.capexStatus} />
            <span className="text-muted-foreground">
              CapEx: {BRL(theme.guardrails.capex)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <StatusIcon status={theme.opexStatus} />
            <span className="text-muted-foreground">
              OpEx: {BRL(theme.guardrails.opex)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type Props = {
  initialData: PortfolioAllocation | null;
  availablePeriods: string[];
};

export function BudgetAllocationPanel({
  initialData,
  availablePeriods,
}: Props) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState(
    initialData?.period ?? availablePeriods[0] ?? ""
  );
  const [isPending, startTransition] = useTransition();

  const overCount =
    data?.themes.filter(
      (t) => t.capexStatus === "over" || t.opexStatus === "over"
    ).length ?? 0;
  const warnCount =
    data?.themes.filter(
      (t) => t.capexStatus === "warn" || t.opexStatus === "warn"
    ).length ?? 0;
  const portfolioUsedPct =
    data && data.portfolioTotal > 0
      ? Math.round((data.portfolioSpent / data.portfolioTotal) * 100 * 10) / 10
      : 0;

  function loadPeriod(p: string) {
    setPeriod(p);
    startTransition(async () => {
      const result = await getPortfolioAllocation(p);
      setData(result);
    });
  }

  if (availablePeriods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <PieChartIcon className="mb-4 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium text-sm">Nenhum orçamento cadastrado</p>
        <p className="mt-1 text-muted-foreground text-xs">
          Crie orçamentos na aba principal para ver a alocação
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-base">
            Alocação por Tema Estratégico
          </h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Distribuição do orçamento do portfólio entre temas SAFe
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <RefreshCwIcon className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : null}
          <select
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            onChange={(e) => loadPeriod(e.target.value)}
            value={period}
          >
            {availablePeriods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Portfolio summary row */}
      {data !== null && data !== undefined && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-muted-foreground text-xs uppercase tracking-wide">
              Total alocado
            </p>
            <p className="font-bold text-xl tabular-nums">
              {BRL(data.portfolioTotal)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-muted-foreground text-xs uppercase tracking-wide">
              Total gasto
            </p>
            <p
              className={`font-bold text-xl tabular-nums ${spendTextColor(portfolioUsedPct)}`}
            >
              {BRL(data.portfolioSpent)}
              <span className="ml-2 font-normal text-muted-foreground text-sm">
                ({portfolioUsedPct}%)
              </span>
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-muted-foreground text-xs uppercase tracking-wide">
              Guardrails
            </p>
            <div className="mt-1 flex items-center gap-3">
              <GuardrailStatus overCount={overCount} warnCount={warnCount} />
            </div>
          </div>
        </div>
      )}

      {/* Theme grid */}
      {data !== null && data !== undefined && data.themes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.themes.map((theme) => (
            <ThemeCard key={theme.themeId ?? "unallocated"} theme={theme} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <PieChartIcon className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Nenhum orçamento para o período {period}
          </p>
        </div>
      )}
    </div>
  );
}
